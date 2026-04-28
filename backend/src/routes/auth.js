const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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

  if (!user.approved) {
    return res.status(403).json({ error: 'Conta pendente de aprovação pelo administrador' });
  }

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
  const isAdmin = email === process.env.ADMIN_EMAIL;
  const role = isAdmin ? 'admin' : 'editor';
  const approved = isAdmin ? 1 : 0;

  db.prepare('INSERT INTO users (id, email, name, password_hash, role, approved) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email, name, password_hash, role, approved);

  if (!isAdmin) {
    return res.status(202).json({ pending: true, message: 'Conta criada. Aguarda aprovação do administrador.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: makeToken(id), user: safeUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ── Admin: gestão de utilizadores ────────────────────────────────

// GET /api/auth/admin/users — lista todos os utilizadores
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, approved, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/auth/admin/users/:id/approve
router.post('/admin/users/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
  db.prepare('UPDATE users SET approved = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/auth/admin/users/:id
router.delete('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Não podes eliminar a tua própria conta' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
