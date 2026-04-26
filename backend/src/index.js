require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
