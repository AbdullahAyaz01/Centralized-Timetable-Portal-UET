const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const { run, query, get } = require('../db/database');
const { isAuthenticated } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Helper to check room collision
const isRoomOccupied = async (roomId, dayOfWeek, startTime, endTime, excludeId = null) => {
  let sql = `
    SELECT t.*, c.course_code, c.course_name, d.name as department_name, r.room_name 
    FROM timetable_entries t
    JOIN courses c ON t.course_id = c.id
    JOIN departments d ON t.department_id = d.id
    JOIN rooms r ON t.room_id = r.id
    WHERE t.day_of_week = ? AND t.room_id = ? 
    AND (t.start_time < ? AND t.end_time > ?)
  `;
  let params = [dayOfWeek, roomId, endTime, startTime];
  if (excludeId) {
    sql += ' AND t.id != ?';
    params.push(excludeId);
  }
  return await get(sql, params);
};

const parseTimeHeader = (headerStr) => {
  if (!headerStr) return null;
  const str = String(headerStr).trim().toUpperCase();

  if (str.includes('8-9')) return { start: '08:00', end: '09:00' };
  if (str.includes('9-10')) return { start: '09:00', end: '10:00' };
  if (str.includes('10-11')) return { start: '10:00', end: '11:00' };
  if (str.includes('11-12')) return { start: '11:00', end: '12:00' };
  if (str.includes('1-2')) return { start: '13:00', end: '14:00' };
  if (str.includes('2-3')) return { start: '14:00', end: '15:00' };
  if (str.includes('3-4')) return { start: '15:00', end: '16:00' };

  return null;
};

// POST /api/upload/excel - Parse and import Excel timetable sheet (Dept Coordinator ONLY)
router.post('/excel', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    if (req.session.user.role === 'admin') {
      return res.status(403).json({ error: 'Forbidden. Super Admin cannot upload department timetable sheets. Only department coordinators can upload schedules!' });
    }

    const deptId = Number(req.body.department_id || req.session.user.department_id || 1);

    let workbook;

    if (req.body.fileData === 'preset' || (!req.file && !req.body.fileData)) {
      const excelFilePath = path.join(__dirname, '..', 'dashboard.xlsx');
      workbook = XLSX.readFile(excelFilePath);
    } else if (req.file) {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } else if (req.body.fileData) {
      const base64Str = req.body.fileData.split(',')[1] || req.body.fileData;
      const buffer = Buffer.from(base64Str, 'base64');
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    if (!workbook || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'Invalid Excel file format.' });
    }

    let importedCount = 0;
    let conflictCount = 0;
    let roomCreatedCount = 0;
    let conflictMessages = [];

    // Step 1: Parse Room Specs Sheet (First Sheet)
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows1 = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    if (rows1 && rows1.length > 0) {
      let isLabSection = false;

      for (let i = 0; i < rows1.length; i++) {
        const row = rows1[i];
        if (!row || row.length === 0) continue;

        const firstCol = String(row[0] || '').trim();

        if (firstCol.toLowerCase().includes('lab')) {
          isLabSection = true;
          continue;
        }

        if (firstCol.toLowerCase().includes('room no') || firstCol.toLowerCase() === 'labs') {
          continue;
        }

        if (firstCol.length > 0 && (firstCol.startsWith('G-') || firstCol.startsWith('F-') || firstCol.length >= 2)) {
          const roomName = firstCol;
          const chairs = parseInt(row[1]) || (isLabSection ? 40 : 50);
          const projStr = String(row[2] || '').trim().toLowerCase();
          const hasProj = projStr === 'yes' || projStr === '1' ? 1 : 0;
          const roomType = isLabSection ? 'Computer Lab' : 'Lecture Hall';
          const comps = isLabSection ? (parseInt(row[3]) || 40) : 0;

          let existingRoom = await get('SELECT * FROM rooms WHERE room_name = ?', [roomName]);
          if (!existingRoom) {
            await run(
              'INSERT INTO rooms (room_name, building, capacity, room_type, department_id, chairs_count, projector, computers_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [roomName, 'Main Academic Block', chairs, roomType, deptId, chairs, hasProj, comps]
            );
            roomCreatedCount++;
          } else {
            await run(
              'UPDATE rooms SET department_id = ?, capacity = ?, chairs_count = ?, room_type = ?, projector = ?, computers_count = ? WHERE room_name = ?',
              [deptId, chairs, chairs, roomType, hasProj, comps, roomName]
            );
          }
        }
      }
    }

    // Step 2: Ensure course & instructor stubs exist for department
    const allCourses = await query('SELECT * FROM courses WHERE department_id = ?', [deptId]);
    const allInst = await query('SELECT * FROM instructors WHERE department_id = ?', [deptId]);

    let defaultCourseId = allCourses[0] ? allCourses[0].id : 1;
    let defaultInstId = allInst[0] ? allInst[0].id : 1;

    // Step 3: Parse Timetable Matrix Sheets (Sheets named after room, e.g. "G-10", "G-11")
    for (let sIdx = 1; sIdx < workbook.SheetNames.length; sIdx++) {
      const sheetName = workbook.SheetNames[sIdx].trim();
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (!rows || rows.length < 2) continue;

      let targetRoom = await get('SELECT * FROM rooms WHERE room_name = ? AND department_id = ?', [sheetName, deptId]);
      if (!targetRoom) {
        targetRoom = await get('SELECT * FROM rooms WHERE room_name = ?', [sheetName]);
      }

      if (!targetRoom) {
        const resRoom = await run(
          'INSERT INTO rooms (room_name, building, capacity, room_type, department_id, chairs_count, projector, computers_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [sheetName, 'Main Academic Block', 50, 'Lecture Hall', deptId, 50, 1, 0]
        );
        targetRoom = { id: resRoom.id, room_name: sheetName, room_type: 'Lecture Hall' };
        roomCreatedCount++;
      }

      const headerRow = rows[0];
      const slotMap = [];

      for (let col = 1; col < headerRow.length; col++) {
        const slotTime = parseTimeHeader(headerRow[col]);
        if (slotTime) {
          slotMap.push({ colIndex: col, start: slotTime.start, end: slotTime.end, label: headerRow[col] });
        }
      }

      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;

        const dayName = String(row[0]).trim();
        if (!validDays.includes(dayName)) continue;

        for (const slotInfo of slotMap) {
          const cellVal = row[slotInfo.colIndex];
          if (cellVal === 1 || cellVal === '1' || String(cellVal).trim().toLowerCase() === 'yes') {
            
            const conflict = await isRoomOccupied(targetRoom.id, dayName, slotInfo.start, slotInfo.end);
            if (conflict) {
              conflictCount++;
              conflictMessages.push(`Room "${targetRoom.room_name}" is ALREADY occupied on ${dayName} (${slotInfo.start}-${slotInfo.end}). Skipped duplicate slot.`);
              continue;
            }

            await run(
              `INSERT INTO timetable_entries 
               (department_id, course_id, instructor_id, room_id, day_of_week, start_time, end_time, section, semester, session_type, notes) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                deptId,
                defaultCourseId,
                defaultInstId,
                targetRoom.id,
                dayName,
                slotInfo.start,
                slotInfo.end,
                'CS-1A',
                1,
                targetRoom.room_type === 'Computer Lab' ? 'Lab' : 'Lecture',
                `Imported from sheet ${sheetName}`
              ]
            );
            importedCount++;
          }
        }
      }
    }

    res.json({
      message: 'Excel timetable processing complete!',
      importedSlots: importedCount,
      conflictsSkipped: conflictCount,
      newRooms: roomCreatedCount,
      conflictMessages
    });

  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ error: 'Failed to process Excel file: ' + err.message });
  }
});

module.exports = router;
