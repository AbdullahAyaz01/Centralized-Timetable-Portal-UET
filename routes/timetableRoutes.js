const express = require('express');
const router = express.Router();
const { query, run, get } = require('../db/database');
const { isAuthenticated, canManageDepartment } = require('../middleware/auth');

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

// GET /api/timetable - Get entries with filters (LOGIN REQUIRED)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { department_id, semester, day, room_id, search } = req.query;

    let sql = `
      SELECT t.*, 
             c.course_code, c.course_name, c.credit_hours, c.program,
             i.name as instructor_name, i.email as instructor_email, i.designation as instructor_designation,
             r.room_name, r.building as room_building, r.capacity as room_capacity, r.room_type, r.projector as room_projector, r.computers_count as room_computers,
             d.name as department_name, d.code as department_code, d.color as department_color
      FROM timetable_entries t
      JOIN courses c ON t.course_id = c.id
      JOIN instructors i ON t.instructor_id = i.id
      JOIN rooms r ON t.room_id = r.id
      JOIN departments d ON t.department_id = d.id
      WHERE 1=1
    `;

    const params = [];

    if (department_id) {
      sql += ' AND t.department_id = ?';
      params.push(department_id);
    }
    if (semester) {
      sql += ' AND t.semester = ?';
      params.push(semester);
    }
    if (day) {
      sql += ' AND t.day_of_week = ?';
      params.push(day);
    }
    if (room_id) {
      sql += ' AND t.room_id = ?';
      params.push(room_id);
    }
    if (search) {
      sql += ' AND (c.course_code LIKE ? OR c.course_name LIKE ? OR i.name LIKE ? OR r.room_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY t.day_of_week ASC, t.start_time ASC';

    const entries = await query(sql, params);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timetable entries.' });
  }
});

// POST /api/timetable - Add new timetable slot (Dept Coordinator ONLY)
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { department_id, course_id, instructor_id, room_id, day_of_week, start_time, end_time, section, semester, session_type, notes } = req.body;

    if (!department_id || !course_id || !room_id || !day_of_week || !start_time || !end_time || !section || !semester) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!canManageDepartment(req.session.user, department_id)) {
      return res.status(403).json({ error: 'Forbidden. You can only edit your assigned department schedule.' });
    }

    const roomConflict = await isRoomOccupied(room_id, day_of_week, start_time, end_time);
    if (roomConflict) {
      return res.status(409).json({ 
        error: `Room "${roomConflict.room_name}" is ALREADY occupied by ${roomConflict.course_code} on ${day_of_week} (${roomConflict.start_time} - ${roomConflict.end_time})!` 
      });
    }

    const result = await run(
      `INSERT INTO timetable_entries 
       (department_id, course_id, instructor_id, room_id, day_of_week, start_time, end_time, section, semester, session_type, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [department_id, course_id, instructor_id || 1, room_id, day_of_week, start_time, end_time, section.toUpperCase(), semester, session_type || 'Lecture', notes || '']
    );

    res.json({ message: 'Timetable slot created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create timetable slot: ' + err.message });
  }
});

// PUT /api/timetable/:id - Edit timetable slot (Dept Coordinator ONLY)
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const entryId = req.params.id;
    const { department_id, course_id, instructor_id, room_id, day_of_week, start_time, end_time, section, semester, session_type, notes } = req.body;

    const existing = await get('SELECT * FROM timetable_entries WHERE id = ?', [entryId]);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable slot not found.' });
    }

    if (!canManageDepartment(req.session.user, existing.department_id) || !canManageDepartment(req.session.user, department_id)) {
      return res.status(403).json({ error: 'Forbidden. You can only edit your assigned department schedule.' });
    }

    const roomConflict = await isRoomOccupied(room_id, day_of_week, start_time, end_time, entryId);
    if (roomConflict) {
      return res.status(409).json({ 
        error: `Room "${roomConflict.room_name}" is ALREADY occupied by ${roomConflict.course_code} on ${day_of_week} (${roomConflict.start_time} - ${roomConflict.end_time})!` 
      });
    }

    await run(
      `UPDATE timetable_entries 
       SET department_id = ?, course_id = ?, instructor_id = ?, room_id = ?, day_of_week = ?, start_time = ?, end_time = ?, section = ?, semester = ?, session_type = ?, notes = ? 
       WHERE id = ?`,
      [department_id, course_id, instructor_id || 1, room_id, day_of_week, start_time, end_time, section.toUpperCase(), semester, session_type || 'Lecture', notes || '', entryId]
    );

    res.json({ message: 'Timetable slot updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update timetable slot: ' + err.message });
  }
});

// DELETE /api/timetable/clear-department/:deptId - Clear ALL slots for a department in 1 click (Dept Coordinator ONLY)
router.delete('/clear-department/:deptId', isAuthenticated, async (req, res) => {
  try {
    const deptId = Number(req.params.deptId);

    if (!canManageDepartment(req.session.user, deptId)) {
      return res.status(403).json({ error: 'Forbidden. You can only clear timetable slots for your own department!' });
    }

    const result = await run('DELETE FROM TIMETABLE_ENTRIES WHERE DEPARTMENT_ID = ?', [deptId]);
    res.json({ message: `Successfully cleared ${result.changes} scheduled timetable slots for this department. Rooms and credentials remain intact!` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear department timetable: ' + err.message });
  }
});

// DELETE /api/timetable/:id - Delete single timetable slot (Dept Coordinator ONLY)
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const entryId = req.params.id;
    const existing = await get('SELECT * FROM timetable_entries WHERE id = ?', [entryId]);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable slot not found.' });
    }

    if (!canManageDepartment(req.session.user, existing.department_id)) {
      return res.status(403).json({ error: 'Forbidden. You can only delete your assigned department schedule.' });
    }

    await run('DELETE FROM timetable_entries WHERE id = ?', [entryId]);
    res.json({ message: 'Timetable slot deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete timetable slot.' });
  }
});

module.exports = router;
