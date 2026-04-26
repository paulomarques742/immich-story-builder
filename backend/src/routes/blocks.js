const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const VALID_TYPES = ['hero', 'grid', 'text', 'map', 'video', 'divider'];

function storyGuard(req, res) {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.storyId);
  if (!story) { res.status(404).json({ error: 'Story not found' }); return null; }
  const canEdit = req.user.role === 'admin' || story.created_by === req.user.id;
  if (!canEdit) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return story;
}

// GET /api/stories/:storyId/blocks
router.get('/', requireAuth, (req, res) => {
  if (!storyGuard(req, res)) return;
  const blocks = db.prepare('SELECT * FROM blocks WHERE story_id = ? ORDER BY position ASC').all(req.params.storyId);
  res.json(blocks);
});

// POST /api/stories/:storyId/blocks
router.post('/', requireAuth, (req, res) => {
  if (!storyGuard(req, res)) return;
  const { type, content, position } = req.body;
  if (!type || !VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  if (!content) return res.status(400).json({ error: 'content required' });

  const maxRow = db.prepare('SELECT MAX(position) as m FROM blocks WHERE story_id = ?').get(req.params.storyId);
  const pos = position !== undefined ? position : (maxRow.m ?? -1) + 1;
  const id = uuidv4();

  db.prepare('INSERT INTO blocks (id, story_id, type, position, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.storyId, type, pos, typeof content === 'string' ? content : JSON.stringify(content));

  res.status(201).json(db.prepare('SELECT * FROM blocks WHERE id = ?').get(id));
});

// POST /api/stories/:storyId/blocks/reorder
router.post('/reorder', requireAuth, (req, res) => {
  if (!storyGuard(req, res)) return;
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) return res.status(400).json({ error: 'ordered_ids must be an array' });

  const update = db.prepare('UPDATE blocks SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND story_id = ?');
  const reorderAll = db.transaction((ids) => {
    ids.forEach((id, idx) => update.run(idx, id, req.params.storyId));
  });
  reorderAll(ordered_ids);
  res.json({ ok: true });
});

// POST /api/stories/:storyId/blocks/import-album
router.post('/import-album', requireAuth, async (req, res) => {
  if (!storyGuard(req, res)) return;
  const { album_ids } = req.body;
  if (!Array.isArray(album_ids) || album_ids.length === 0) {
    return res.status(400).json({ error: 'album_ids must be a non-empty array' });
  }
  if (!req.user.immich_token) {
    return res.status(400).json({ error: 'No Immich token for this user. Log in via Immich API key.' });
  }

  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  const immich = axios.create({
    baseURL: `${baseURL}/api`,
    headers: { 'x-api-key': req.user.immich_token },
  });

  try {
    const allAssets = [];
    for (const albumId of album_ids) {
      const { data: album } = await immich.get(`/albums/${albumId}`);
      for (const asset of (album.assets || [])) {
        if (asset.type === 'IMAGE' || asset.type === 'VIDEO') {
          allAssets.push(asset);
        }
      }
    }

    if (allAssets.length === 0) {
      return res.status(400).json({ error: 'No assets found in selected albums' });
    }

    allAssets.sort((a, b) => new Date(a.fileCreatedAt) - new Date(b.fileCreatedAt));

    const maxRow = db.prepare('SELECT MAX(position) as m FROM blocks WHERE story_id = ?').get(req.params.storyId);
    let position = (maxRow.m ?? -1) + 1;

    const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const newBlocks = [];

    // First asset → hero
    const heroAsset = allAssets[0];
    newBlocks.push({ type: 'hero', content: JSON.stringify({ asset_id: heroAsset.id, caption: '', overlay: true, height: 'full' }), position: position++ });

    // Remaining → group by year-month → divider + grids of 3
    const remaining = allAssets.slice(1);
    const groups = new Map();
    for (const asset of remaining) {
      const d = new Date(asset.fileCreatedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(asset);
    }

    for (const [key, assets] of groups) {
      const [year, month] = key.split('-');
      const label = `${year} · ${MONTH_NAMES[parseInt(month) - 1]}`;
      newBlocks.push({ type: 'divider', content: JSON.stringify({ style: 'line', label }), position: position++ });
      for (let i = 0; i < assets.length; i += 3) {
        const chunk = assets.slice(i, i + 3);
        newBlocks.push({
          type: 'grid',
          content: JSON.stringify({ asset_ids: chunk.map((a) => a.id), columns: 3, gap: 'sm', aspect: 'square' }),
          position: position++,
        });
      }
    }

    const insert = db.prepare('INSERT INTO blocks (id, story_id, type, position, content) VALUES (?, ?, ?, ?, ?)');
    db.transaction((blocks) => {
      for (const b of blocks) insert.run(uuidv4(), req.params.storyId, b.type, b.position, b.content);
    })(newBlocks);

    // Merge album_ids into story
    const storyRow = db.prepare('SELECT immich_album_ids FROM stories WHERE id = ?').get(req.params.storyId);
    const existing = JSON.parse(storyRow?.immich_album_ids || '[]');
    db.prepare('UPDATE stories SET immich_album_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify([...new Set([...existing, ...album_ids])]), req.params.storyId);

    res.json(db.prepare('SELECT * FROM blocks WHERE story_id = ? ORDER BY position ASC').all(req.params.storyId));
  } catch (err) {
    console.error('import-album error:', err.message);
    res.status(err.response?.status || 500).json({ error: 'Failed to import album' });
  }
});

// PUT /api/stories/:storyId/blocks/:blockId
router.put('/:blockId', requireAuth, (req, res) => {
  if (!storyGuard(req, res)) return;
  const block = db.prepare('SELECT * FROM blocks WHERE id = ? AND story_id = ?').get(req.params.blockId, req.params.storyId);
  if (!block) return res.status(404).json({ error: 'Block not found' });

  const { content, position } = req.body;
  db.prepare(`
    UPDATE blocks SET
      content = COALESCE(?, content),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    content ? (typeof content === 'string' ? content : JSON.stringify(content)) : null,
    position !== undefined ? position : null,
    block.id
  );

  res.json(db.prepare('SELECT * FROM blocks WHERE id = ?').get(block.id));
});

// DELETE /api/stories/:storyId/blocks/:blockId
router.delete('/:blockId', requireAuth, (req, res) => {
  if (!storyGuard(req, res)) return;
  const block = db.prepare('SELECT * FROM blocks WHERE id = ? AND story_id = ?').get(req.params.blockId, req.params.storyId);
  if (!block) return res.status(404).json({ error: 'Block not found' });
  db.prepare('DELETE FROM blocks WHERE id = ?').run(block.id);
  res.status(204).end();
});

module.exports = router;
