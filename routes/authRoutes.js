const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, run, query } = require('../db/database');
const { isAuthenticated } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await get(
      `SELECT u.*, d.name as department_name, d.code as department_code, d.color as department_color 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.username = ?`,
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Set Session
    const userData = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      department_code: user.department_code,
      department_color: user.department_color
    };

    req.session.user = userData;

    res.json({
      message: 'Login successful',
      user: userData
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false, user: null });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

module.exports = router;
