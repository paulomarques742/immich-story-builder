const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many unlock attempts, please try again later' },
});

function hasGroupAccess(req, group) {
  if (!group.password_hash) return true;
  const token = req.headers['x-group-token'];
  if (!token) return false;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).group_id === group.id;
  } catch {
    return false;
  }
}

// GET /api/g/:slug — página pública do grupo
// Só lista stories publicadas. Quem tem acesso ao grupo recebe um token por story
// protegida, para a abrir sem password (o link individual continua a pedi-la).
router.get('/:slug', (req, res) => {
  const group = db.prepare('SELECT * FROM share_groups WHERE slug = ?').get(req.params.slug);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const info = {
    name: group.name,
    description: group.description,
    slug: group.slug,
    has_password: !!group.password_hash,
  };
  if (!hasGroupAccess(req, group)) return res.json({ group: info, stories: null, locked: true });

  const stories = db.prepare(`
    SELECT s.id, s.slug, s.title, s.description, s.cover_asset_id, s.password_hash,
           s.created_at, s.updated_at, gs.added_at,
           (SELECT json_extract(b.content, '$.asset_id') FROM blocks b
            WHERE b.story_id = s.id AND b.type = 'hero'
              AND json_extract(b.content, '$.asset_id') != ''
            ORDER BY b.position ASC LIMIT 1) AS hero_asset_id
    FROM share_group_stories gs
    JOIN stories s ON s.id = gs.story_id
    WHERE gs.group_id = ? AND s.published = 1
    ORDER BY gs.added_at DESC, s.created_at DESC
  `).all(group.id).map(({ password_hash, ...story }) => ({
    ...story,
    access_token: password_hash
      ? jwt.sign({ story_id: story.id }, process.env.JWT_SECRET, { expiresIn: '24h' })
      : null,
  }));

  res.json({ group: info, stories, locked: false });
});

// POST /api/g/:slug/unlock — { password } → token do grupo (30 dias)
router.post('/:slug/unlock', unlockLimiter, (req, res) => {
  const group = db.prepare('SELECT * FROM share_groups WHERE slug = ?').get(req.params.slug);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!group.password_hash) return res.json({ token: null });

  const { password } = req.body;
  if (!password || !bcrypt.compareSync(password, group.password_hash)) {
    return res.status(401).json({ error: 'Password incorrecta' });
  }
  const token = jwt.sign({ group_id: group.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

module.exports = router;
