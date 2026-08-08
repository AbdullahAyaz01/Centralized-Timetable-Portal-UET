const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, run, get } = require('../db/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// GET /api/departments - List departments (LOGIN REQUIRED)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const departments = await query('SELECT * FROM departments ORDER BY name ASC');
    const rooms = await query('SELECT * FROM rooms');

    const result = departments.map(d => {
      const deptRooms = rooms.filter(r => Number(r.department_id) === Number(d.id));
      return { ...d, rooms: deptRooms };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

// GET /api/departments/credentials - List all coordinator credentials (Super Admin ONLY)
router.get('/credentials', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, u.created_at,
             d.name as department_name, d.code as department_code, d.color as department_color
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.role ASC, d.name ASC
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coordinator credentials.' });
  }
});

// GET /api/departments/:id/rooms - Get rooms for a department (LOGIN REQUIRED)
router.get('/:id/rooms', isAuthenticated, async (req, res) => {
  try {
    const deptId = req.params.id;
    const rooms = await query('SELECT * FROM rooms WHERE department_id = ? ORDER BY room_name ASC', [deptId]);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms for department.' });
  }
});

// POST /api/departments - Add department AND coordinator credentials (Super Admin ONLY)
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, code, color, building, coordinator_username, coordinator_password, coordinator_name, coordinator_email } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }

    const deptResult = await run(
      'INSERT INTO departments (name, code, color, building) VALUES (?, ?, ?, ?)',
      [name, code.toUpperCase(), color || '#006633', building || 'UET KSK Campus']
    );

    const newDeptId = deptResult.id;
    let userId = null;

    if (coordinator_username && coordinator_password) {
      const passHash = await bcrypt.hash(coordinator_password, 10);
      const userResult = await run(
        'INSERT INTO users (username, password_hash, full_name, email, role, department_id) VALUES (?, ?, ?, ?, ?, ?)',
        [coordinator_username, passHash, coordinator_name || `${code} Head`, coordinator_email || `${code.toLowerCase()}@uet.edu.pk`, 'dept_admin', newDeptId]
      );
      userId = userResult.id;
    }

    res.json({ message: 'Department and coordinator created successfully', id: newDeptId, userId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create department: ' + err.message });
  }
});

// DELETE /api/departments/:id - Delete department and ALL related data (Super Admin ONLY)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deptId = Number(req.params.id);

    const dept = await get('SELECT * FROM departments WHERE id = ?', [deptId]);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    await run('DELETE FROM DEPARTMENTS WHERE id = ?', [deptId]);

    res.json({ message: `Department "${dept.name}" (${dept.code}) and ALL associated rooms, login credentials, and schedule slots have been deleted permanently.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete department: ' + err.message });
  }
});

module.exports = router;
