const express = require('express');
const router = express.Router();
const { query, run } = require('../db/database');
const { isAuthenticated, requireDepartmentAccess } = require('../middleware/auth');

// GET /api/instructors - List instructors
router.get('/', async (req, res) => {
  try {
    const { department_id } = req.query;
    let sql = `
      SELECT i.*, d.name as department_name, d.code as department_code 
      FROM instructors i 
      JOIN departments d ON i.department_id = d.id
    `;
    let params = [];

    if (department_id) {
      sql += ' WHERE i.department_id = ?';
      params.push(department_id);
    }

    sql += ' ORDER BY i.name ASC';
    const instructors = await query(sql, params);
    res.json(instructors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instructors.' });
  }
});

// POST /api/instructors - Add instructor (RBAC protected)
router.post('/', isAuthenticated, requireDepartmentAccess('department_id'), async (req, res) => {
  try {
    const { name, email, designation, department_id } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ error: 'Instructor name and department ID are required.' });
    }

    const result = await run(
      'INSERT INTO instructors (name, email, designation, department_id) VALUES (?, ?, ?, ?)',
      [name, email || '', designation || 'Lecturer', department_id]
    );

    res.json({ message: 'Instructor added successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add instructor.' });
  }
});

module.exports = router;
