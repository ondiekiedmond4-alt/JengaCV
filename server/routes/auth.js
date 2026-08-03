const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, downloads_remaining)
       VALUES ($1, $2, $3, 0) RETURNING id, name, downloads_remaining`,
      [normalizedEmail, passwordHash, name.trim()]
    );
    const user = inserted.rows[0];
    const token = signToken(user.id);
    res.json({ token, name: user.name, downloadsRemaining: user.downloads_remaining });
  } catch (err) {
    console.error('auth/register error:', err.message);
    res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    // Deliberately generic error for both "no such user" and "wrong password" —
    // avoids revealing which emails are registered.
    if (!result.rows.length || !result.rows[0].password_hash) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken(user.id);
    res.json({ token, name: user.name, downloadsRemaining: user.downloads_remaining });
  } catch (err) {
    console.error('auth/login error:', err.message);
    res.status(500).json({ error: 'Could not log you in. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, email, downloads_remaining FROM users WHERE id = $1',
      [req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Account not found.' });
    const user = result.rows[0];
    res.json({ name: user.name, email: user.email, downloadsRemaining: user.downloads_remaining });
  } catch (err) {
    console.error('auth/me error:', err.message);
    res.status(500).json({ error: 'Could not load your account.' });
  }
});

module.exports = router;
