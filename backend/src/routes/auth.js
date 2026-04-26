const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function safeUser(user) {
  const { password_hash, immich_token, ...safe } = user;
  return safe;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: makeToken(user.id), user: safeUser(user) });
});

// POST /api/auth/register (local account creation)
router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password and name required' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'editor';

  db.prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, email, name, password_hash, role);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: makeToken(id), user: safeUser(user) });
});

// POST /api/auth/immich
router.post('/immich', async (req, res) => {
  const { immich_url, api_key } = req.body;
  if (!immich_url || !api_key) return res.status(400).json({ error: 'immich_url and api_key required' });

  try {
    const baseUrl = immich_url.replace(/\/$/, '');
    const { data: immichUser } = await axios.get(`${baseUrl}/api/users/me`, {
      headers: { 'x-api-key': api_key },
    });

    const email = immichUser.email;
    const name = immichUser.name || email;

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const id = uuidv4();
      const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'editor';
      db.prepare('INSERT INTO users (id, email, name, immich_token, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, email, name, api_key, role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      db.prepare('UPDATE users SET immich_token = ?, name = ? WHERE id = ?')
        .run(api_key, name, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (err) {
    if (err.response?.status === 401) return res.status(401).json({ error: 'Invalid Immich API key' });
    res.status(502).json({ error: 'Could not reach Immich server' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

module.exports = router;
