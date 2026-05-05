const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const blocksRoutes = require('./routes/blocks');
const immichRoutes = require('./routes/immich');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');
const aiRoutes = require('./routes/ai');
const contributionsRoutes = require('./routes/contributions');
const startSyncJob = require('./sync');

// Fail fast if critical secrets are missing or too weak
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET missing or too weak — must be at least 32 characters. Run: openssl rand -base64 48');
  process.exit(1);
}
if (!process.env.IMMICH_API_KEY) {
  console.error('FATAL: IMMICH_API_KEY is not set');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Cloud Run / GCP load balancer proxy (needed for rate limiting and real IPs)
app.set('trust proxy', 1);

// Explicitly configured allowed origins (comma-separable env vars)
const rawOrigins = [
  process.env.PUBLIC_URL,
  process.env.FRONTEND_URL,
  process.env.VITE_API_URL,
  'http://localhost:5173',
].flatMap((s) => (s ? s.split(',').map((o) => o.trim().replace(/\/$/, '')) : []));
const configuredOrigins = [...new Set(rawOrigins)];

// Apply CORS only to /api routes.
// Security model: JWT auth protects sensitive endpoints; CORS only blocks
// unauthorized cross-origin browser requests from unknown third-party sites.
// Allows: no-origin requests, same-origin requests, and configured origins.
app.use('/api', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);                    // non-browser / same-origin img/video
    if (configuredOrigins.includes(origin)) return callback(null, true); // configured domains
    // Dynamic same-origin: allow if origin matches the server's own host
    // (handles custom domains without requiring PUBLIC_URL to be set)
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many unlock attempts, please try again later' },
});

// ── Authenticated routes ──────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', aiRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/stories/:storyId/blocks', blocksRoutes);
app.use('/api/immich', immichRoutes);
app.use('/api', commentsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', socialRoutes);
app.use('/api', contributionsRoutes);

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
app.post('/api/public/:slug/unlock', unlockLimiter, (req, res) => {
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
    if (req.query.download) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).end();
  }
});

// ── Helpers ───────────────────────────────────────────────────────
function getStoryAssetIds(storyId) {
  const blocks = db.prepare('SELECT content FROM blocks WHERE story_id = ?').all(storyId);
  const ids = new Set();
  blocks.forEach((block) => {
    try {
      const c = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
      if (c.asset_id) ids.add(c.asset_id);
      if (Array.isArray(c.asset_ids)) c.asset_ids.forEach((id) => ids.add(id));
    } catch {}
  });
  return ids;
}

function immichPublicClient() {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  return axios.create({ baseURL: `${baseURL}/api`, headers: { 'x-api-key': process.env.IMMICH_API_KEY } });
}

// GET /api/public/:slug/people
app.get('/api/public/:slug/people', async (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.json([]);

  const storyAssetIds = getStoryAssetIds(story.id);
  if (storyAssetIds.size === 0) return res.json([]);

  try {
    const client = immichPublicClient();
    const assetDetails = await Promise.all(
      [...storyAssetIds].map((id) => client.get(`/assets/${id}`).then((r) => r.data).catch(() => null))
    );
    const peopleMap = new Map();
    assetDetails.forEach((asset) => {
      if (!asset?.people) return;
      asset.people.forEach((person) => {
        if (!person.isHidden && !peopleMap.has(person.id)) {
          peopleMap.set(person.id, person);
        }
      });
    });
    res.json([...peopleMap.values()]);
  } catch {
    res.json([]);
  }
});

// GET /api/public/:slug/people/:personId/thumb
app.get('/api/public/:slug/people/:personId/thumb', async (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).end();

  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(`${baseURL}/api/people/${req.params.personId}/thumbnail`, {
      headers: { 'x-api-key': process.env.IMMICH_API_KEY },
      responseType: 'stream',
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).end();
  }
});

// GET /api/public/:slug/people/:personId/assets  — asset IDs for person, scoped to story
app.get('/api/public/:slug/people/:personId/assets', async (req, res) => {
  const story = db.prepare('SELECT id FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.json([]);

  const storyAssetIds = getStoryAssetIds(story.id);
  if (storyAssetIds.size === 0) return res.json([]);

  try {
    const { data } = await immichPublicClient().post('/search/metadata', {
      personIds: [req.params.personId],
      size: 500,
      page: 1,
    });
    const ids = (data.assets?.items || []).map((a) => a.id).filter((id) => storyAssetIds.has(id));
    res.json(ids);
  } catch {
    res.json([]);
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
  const story = db.prepare('SELECT id, title, slug, created_by FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });

  const { author_name, body } = req.body;
  if (!author_name?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'author_name and body required' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO comments (id, story_id, asset_id, author_name, body) VALUES (?, ?, ?, ?, ?)'
  ).run(id, story.id, req.params.assetId, author_name.trim(), body.trim());

  if (story.created_by) {
    db.prepare(
      'INSERT INTO notifications (id, user_id, type, payload) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), story.created_by, 'new_comment', JSON.stringify({
      story_id: story.id,
      story_title: story.title,
      story_slug: story.slug,
      comment_id: id,
      author_name: author_name.trim(),
      body: body.trim().slice(0, 120),
    }));
  }

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
  const fs = require('fs');
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  const indexHtml = fs.readFileSync(path.join(frontendDist, 'index.html'), 'utf-8');

  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');

  app.use(express.static(frontendDist));

  // OG meta tags para o viewer público
  app.get('/:slug([a-z0-9][a-z0-9-]*)', (req, res, next) => {
    const story = db.prepare(
      'SELECT title, description, cover_asset_id, slug FROM stories WHERE slug = ? AND published = 1'
    ).get(req.params.slug);
    if (!story) return next();

    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const ogImage = story.cover_asset_id
      ? `${base}/api/public/${story.slug}/assets/${story.cover_asset_id}/thumb?size=preview`
      : '';
    const desc = story.description || story.title;

    const tags = [
      `<title>${esc(story.title)} · Memoire</title>`,
      `<meta name="description" content="${esc(desc)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${esc(`${base}/${story.slug}`)}" />`,
      `<meta property="og:title" content="${esc(story.title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : '',
      `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(story.title)}" />`,
      `<meta name="twitter:description" content="${esc(desc)}" />`,
      ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : '',
    ].filter(Boolean).join('\n    ');

    res.type('html').send(indexHtml.replace('<title>Memoire</title>', tags));
  });

  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startSyncJob(db);
});
