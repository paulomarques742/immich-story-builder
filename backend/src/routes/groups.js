const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
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

function validSlug(s) {
  return typeof s === 'string' && s.length >= 2 && /^[a-z0-9][a-z0-9-]*$/.test(s);
}

function canEdit(user, row) {
  return user.role === 'admin' || row.created_by === user.id;
}

// Grupo para o dashboard: sem password_hash, com has_password e ids das stories
function serialize(group) {
  const { password_hash, ...rest } = group;
  const storyIds = db.prepare(
    'SELECT story_id FROM share_group_stories WHERE group_id = ? ORDER BY added_at DESC'
  ).all(group.id).map((r) => r.story_id);
  return { ...rest, has_password: !!password_hash, story_ids: storyIds };
}

function loadEditable(req, res) {
  const group = db.prepare('SELECT * FROM share_groups WHERE id = ?').get(req.params.id);
  if (!group) { res.status(404).json({ error: 'Not found' }); return null; }
  if (!canEdit(req.user, group)) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return group;
}

// GET /api/groups
router.get('/groups', requireAuth, (req, res) => {
  const groups = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM share_groups ORDER BY name COLLATE NOCASE').all()
    : db.prepare('SELECT * FROM share_groups WHERE created_by = ? ORDER BY name COLLATE NOCASE').all(req.user.id);
  res.json(groups.map(serialize));
});

// POST /api/groups
router.post('/groups', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const slug = req.body.slug || slugify(name);
  if (!validSlug(slug)) return res.status(400).json({ error: 'Slug inválido' });
  if (db.prepare('SELECT id FROM share_groups WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'Slug already in use' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO share_groups (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, slug, name.trim(), description?.trim() || null, req.user.id);

  res.status(201).json(serialize(db.prepare('SELECT * FROM share_groups WHERE id = ?').get(id)));
});

// PUT /api/groups/:id
router.put('/groups/:id', requireAuth, (req, res) => {
  const group = loadEditable(req, res);
  if (!group) return;

  const { name, description, slug } = req.body;
  if (slug !== undefined && slug !== group.slug) {
    if (!validSlug(slug)) return res.status(400).json({ error: 'Slug inválido' });
    if (db.prepare('SELECT id FROM share_groups WHERE slug = ? AND id != ?').get(slug, group.id)) {
      return res.status(409).json({ error: 'Slug already in use' });
    }
  }

  db.prepare(`
    UPDATE share_groups SET
      name = ?, description = ?, slug = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name?.trim() || group.name,
    description !== undefined ? (description?.trim() || null) : group.description,
    slug || group.slug,
    group.id
  );

  res.json(serialize(db.prepare('SELECT * FROM share_groups WHERE id = ?').get(group.id)));
});

// DELETE /api/groups/:id
router.delete('/groups/:id', requireAuth, (req, res) => {
  const group = loadEditable(req, res);
  if (!group) return;
  db.prepare('DELETE FROM share_groups WHERE id = ?').run(group.id);
  res.status(204).end();
});

// POST /api/groups/:id/password  — { password } define; vazio/null remove
router.post('/groups/:id/password', requireAuth, (req, res) => {
  const group = loadEditable(req, res);
  if (!group) return;
  const { password } = req.body;
  const hash = password ? bcrypt.hashSync(password, 10) : null;
  db.prepare('UPDATE share_groups SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, group.id);
  res.json({ has_password: !!hash });
});

// PUT /api/groups/:id/stories  — { story_ids } substitui a lista (mantém added_at das que já estavam)
router.put('/groups/:id/stories', requireAuth, (req, res) => {
  const group = loadEditable(req, res);
  if (!group) return;
  const ids = Array.isArray(req.body.story_ids) ? [...new Set(req.body.story_ids)] : null;
  if (!ids) return res.status(400).json({ error: 'story_ids required' });

  for (const storyId of ids) {
    const story = db.prepare('SELECT created_by FROM stories WHERE id = ?').get(storyId);
    if (!story) return res.status(400).json({ error: `Story ${storyId} not found` });
    if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  }

  db.transaction(() => {
    const current = db.prepare('SELECT story_id FROM share_group_stories WHERE group_id = ?')
      .all(group.id).map((r) => r.story_id);
    const del = db.prepare('DELETE FROM share_group_stories WHERE group_id = ? AND story_id = ?');
    current.filter((id) => !ids.includes(id)).forEach((id) => del.run(group.id, id));
    const ins = db.prepare('INSERT OR IGNORE INTO share_group_stories (group_id, story_id) VALUES (?, ?)');
    ids.forEach((id) => ins.run(group.id, id));
  })();

  res.json(serialize(group));
});

// GET /api/stories/:id/groups  — ids dos grupos onde a story está
router.get('/stories/:id/groups', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  const rows = db.prepare('SELECT group_id FROM share_group_stories WHERE story_id = ?').all(story.id);
  res.json(rows.map((r) => r.group_id));
});

// PUT /api/stories/:id/groups  — { group_ids } substitui os grupos da story (só grupos que o user pode editar)
router.put('/stories/:id/groups', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });
  const ids = Array.isArray(req.body.group_ids) ? [...new Set(req.body.group_ids)] : null;
  if (!ids) return res.status(400).json({ error: 'group_ids required' });

  const editable = (req.user.role === 'admin'
    ? db.prepare('SELECT id FROM share_groups').all()
    : db.prepare('SELECT id FROM share_groups WHERE created_by = ?').all(req.user.id)
  ).map((g) => g.id);
  if (ids.some((id) => !editable.includes(id))) return res.status(403).json({ error: 'Forbidden' });

  db.transaction(() => {
    const del = db.prepare('DELETE FROM share_group_stories WHERE group_id = ? AND story_id = ?');
    editable.filter((gid) => !ids.includes(gid)).forEach((gid) => del.run(gid, story.id));
    const ins = db.prepare('INSERT OR IGNORE INTO share_group_stories (group_id, story_id) VALUES (?, ?)');
    ids.forEach((gid) => ins.run(gid, story.id));
  })();

  res.json(ids);
});

module.exports = router;
