const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canEdit(user, story) {
  return user.role === 'admin' || story.created_by === user.id;
}

// GET /api/stories
router.get('/', requireAuth, (req, res) => {
  const base = req.user.role === 'admin'
    ? db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM sync_notifications sn WHERE sn.story_id = s.id AND sn.dismissed = 0) as pending_sync FROM stories s ORDER BY s.updated_at DESC`).all()
    : db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM sync_notifications sn WHERE sn.story_id = s.id AND sn.dismissed = 0) as pending_sync FROM stories s WHERE s.created_by = ? ORDER BY s.updated_at DESC`).all(req.user.id);
  res.json(base);
});

// POST /api/stories
router.post('/', requireAuth, (req, res) => {
  const { title, description, immich_album_ids, sync_mode } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = uuidv4();
  let slug = slugify(title);

  // ensure slug uniqueness
  const existing = db.prepare('SELECT id FROM stories WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${Date.now()}`;

  db.prepare(`
    INSERT INTO stories (id, slug, title, description, immich_album_ids, sync_mode, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, slug, title,
    description || null,
    JSON.stringify(immich_album_ids || []),
    sync_mode || 'notify',
    req.user.id
  );

  res.status(201).json(db.prepare('SELECT * FROM stories WHERE id = ?').get(id));
});

// GET /api/stories/:id
router.get('/:id', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  res.json(story);
});

// PUT /api/stories/:id
router.put('/:id', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const { title, description, cover_asset_id, immich_album_ids, sync_mode, slug, theme } = req.body;

  // validate new slug uniqueness if changing
  if (slug && slug !== story.slug) {
    const taken = db.prepare('SELECT id FROM stories WHERE slug = ? AND id != ?').get(slug, story.id);
    if (taken) return res.status(409).json({ error: 'Slug already in use' });
  }

  db.prepare(`
    UPDATE stories SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      cover_asset_id = COALESCE(?, cover_asset_id),
      immich_album_ids = COALESCE(?, immich_album_ids),
      sync_mode = COALESCE(?, sync_mode),
      slug = COALESCE(?, slug),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title || null,
    description || null,
    cover_asset_id || null,
    immich_album_ids ? JSON.stringify(immich_album_ids) : null,
    sync_mode || null,
    slug || null,
    story.id
  );

  // theme updated separately so null (clear) is distinguishable from "not sent"
  if (theme !== undefined) {
    db.prepare('UPDATE stories SET theme = ? WHERE id = ?').run(
      theme === null ? null : JSON.stringify(theme),
      story.id
    );
  }

  res.json(db.prepare('SELECT * FROM stories WHERE id = ?').get(story.id));
});

// DELETE /api/stories/:id
router.delete('/:id', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM stories WHERE id = ?').run(story.id);
  res.status(204).end();
});

// POST /api/stories/:id/publish
router.post('/:id/publish', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  const newState = story.published ? 0 : 1;
  db.prepare('UPDATE stories SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newState, story.id);
  res.json({ published: !!newState });
});

// POST /api/stories/:id/password
router.post('/:id/password', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const { password } = req.body;
  const hash = password ? bcrypt.hashSync(password, 10) : null;
  db.prepare('UPDATE stories SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, story.id);
  res.json({ has_password: !!hash });
});

// GET /api/stories/:id/sync/status
router.get('/:id/sync/status', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const notifications = db.prepare(
    'SELECT * FROM sync_notifications WHERE story_id = ? AND dismissed = 0 ORDER BY created_at DESC'
  ).all(story.id);

  const newAssetIds = notifications.flatMap((n) => JSON.parse(n.new_asset_ids || '[]'));
  res.json({ notifications, new_asset_count: newAssetIds.length });
});

// POST /api/stories/:id/sync/dismiss
router.post('/:id/sync/dismiss', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE sync_notifications SET dismissed = 1 WHERE story_id = ?').run(story.id);
  res.json({ ok: true });
});

module.exports = router;
