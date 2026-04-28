require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const blocksRoutes = require('./routes/blocks');
const immichRoutes = require('./routes/immich');
const commentsRoutes = require('./routes/comments');
const startSyncJob = require('./sync');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.VITE_API_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ── Authenticated routes ──────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/stories/:storyId/blocks', blocksRoutes);
app.use('/api/immich', immichRoutes);
app.use('/api', commentsRoutes);

// ── Public story: GET /api/public/:slug ───────────────────────
app.get('/api/public/:slug', (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const { password_hash, ...publicStory } = story;
  publicStory.has_password = !!password_hash;

  if (password_hash) {
    const token = req.headers['x-story-token'];
    let unlocked = false;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        unlocked = payload.story_id === story.id;
      } catch { /* invalid token */ }
    }
    if (!unlocked) {
      return res.json({ story: publicStory, blocks: null, locked: true });
    }
  }

  const blocks = db.prepare('SELECT * FROM blocks WHERE story_id = ? ORDER BY position ASC').all(story.id);
  res.json({ story: publicStory, blocks, locked: false });
});

// POST /api/public/:slug/unlock
app.post('/api/public/:slug/unlock', (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (!story.password_hash) return res.json({ token: null });

  const { password } = req.body;
  if (!password || !bcrypt.compareSync(password, story.password_hash)) {
    return res.status(401).json({ error: 'Password incorrecta' });
  }

  const token = jwt.sign({ story_id: story.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// GET /api/public/:slug/assets/:assetId/thumb  — public image proxy
// Validates assetId belongs to the published story before proxying via server-side API key.
// Immich URL and API key are never exposed to the browser.
app.get('/api/public/:slug/assets/:assetId/thumb', async (req, res) => {
  const { slug, assetId } = req.params;
  const size = ['thumbnail', 'preview'].includes(req.query.size) ? req.query.size : 'thumbnail';

  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(slug);
  if (!story) return res.status(404).end();

  // Check assetId is referenced by at least one block of this story
  const blocks = db.prepare('SELECT content FROM blocks WHERE story_id = ?').all(story.id);
  const allowed = blocks.some((block) => {
    try {
      const c = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
      if (c.asset_id === assetId) return true;
      if (Array.isArray(c.asset_ids) && c.asset_ids.includes(assetId)) return true;
      return false;
    } catch { return false; }
  });

  if (!allowed) return res.status(403).end();

  const apiKey = process.env.IMMICH_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'No IMMICH_API_KEY configured on server' });

  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(`${baseURL}/api/assets/${assetId}/thumbnail`, {
      headers: { 'x-api-key': apiKey },
      responseType: 'stream',
      params: { size },
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).end();
  }
});

// GET /api/public/:slug/assets/:assetId/original  — public video proxy (supports Range)
app.get('/api/public/:slug/assets/:assetId/original', async (req, res) => {
  const { slug, assetId } = req.params;

  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(slug);
  if (!story) return res.status(404).end();

  const blocks = db.prepare('SELECT content FROM blocks WHERE story_id = ?').all(story.id);
  const allowed = blocks.some((block) => {
    try {
      const c = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
      if (c.asset_id === assetId) return true;
      if (Array.isArray(c.asset_ids) && c.asset_ids.includes(assetId)) return true;
      return false;
    } catch { return false; }
  });
  if (!allowed) return res.status(403).end();

  const apiKey = process.env.IMMICH_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'No IMMICH_API_KEY configured on server' });

  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const headers = { 'x-api-key': apiKey };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const response = await axios.get(`${baseURL}/api/assets/${assetId}/original`, {
      headers,
      responseType: 'stream',
    });

    res.status(response.status);
    const forward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    for (const h of forward) {
      if (response.headers[h]) res.setHeader(h, response.headers[h]);
    }
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).end();
  }
});

// GET /api/public/:slug/comments/:assetId
app.get('/api/public/:slug/comments/:assetId', (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });
  const comments = db.prepare(
    'SELECT id, author_name, body, created_at FROM comments WHERE story_id = ? AND asset_id = ? AND approved = 1 ORDER BY created_at ASC'
  ).all(story.id, req.params.assetId);
  res.json(comments);
});

// POST /api/public/:slug/comments/:assetId
app.post('/api/public/:slug/comments/:assetId', (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });

  const { author_name, body } = req.body;
  if (!author_name?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'author_name and body required' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO comments (id, story_id, asset_id, author_name, body) VALUES (?, ?, ?, ?, ?)'
  ).run(id, story.id, req.params.assetId, author_name.trim(), body.trim());

  res.status(201).json(db.prepare('SELECT id, author_name, body, created_at FROM comments WHERE id = ?').get(id));
});

// GET /api/public/:slug/counts — like + comment counts for all assets
app.get('/api/public/:slug/counts', (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });

  const likeRows = db.prepare(
    'SELECT asset_id, COUNT(*) as count FROM likes WHERE story_id = ? GROUP BY asset_id'
  ).all(story.id);

  const commentRows = db.prepare(
    "SELECT asset_id, COUNT(*) as count FROM comments WHERE story_id = ? AND approved = 1 AND asset_id != '__story__' GROUP BY asset_id"
  ).all(story.id);

  const likes = {};
  likeRows.forEach((r) => { likes[r.asset_id] = r.count; });
  const comments = {};
  commentRows.forEach((r) => { comments[r.asset_id] = r.count; });

  res.json({ likes, comments });
});

// POST /api/public/:slug/likes/:assetId — toggle like
app.post('/api/public/:slug/likes/:assetId', (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });

  const { fingerprint } = req.body;
  if (!fingerprint?.trim()) return res.status(400).json({ error: 'fingerprint required' });

  const fp = fingerprint.trim().slice(0, 128);
  const existing = db.prepare(
    'SELECT id FROM likes WHERE story_id = ? AND asset_id = ? AND fingerprint = ?'
  ).get(story.id, req.params.assetId, fp);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO likes (id, story_id, asset_id, fingerprint) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), story.id, req.params.assetId, fp);
  }

  const { count } = db.prepare(
    'SELECT COUNT(*) as count FROM likes WHERE story_id = ? AND asset_id = ?'
  ).get(story.id, req.params.assetId);

  res.json({ liked: !existing, count });
});

// ── Production frontend ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startSyncJob(db);
});
