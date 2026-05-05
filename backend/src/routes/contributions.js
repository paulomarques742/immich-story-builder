const express = require('express');
const multer = require('multer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later' },
});

const router = express.Router();

// Cache the contributions album ID so we don't look it up on every upload
let _contribAlbumId = null;

async function getOrCreateContribAlbum() {
  if (_contribAlbumId) return _contribAlbumId;

  const albumName = process.env.IMMICH_CONTRIBUTIONS_ALBUM || 'Memoire';
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  const apiKey = process.env.IMMICH_API_KEY;
  const headers = { 'x-api-key': apiKey };

  // Try to find existing album
  const { data: albums } = await axios.get(`${baseURL}/api/albums`, { headers });
  const existing = albums.find((a) => a.albumName === albumName);
  if (existing) {
    _contribAlbumId = existing.id;
    return _contribAlbumId;
  }

  // Create it
  const { data: created } = await axios.post(
    `${baseURL}/api/albums`,
    { albumName, description: 'Contribuições de viewers via Memoire' },
    { headers }
  );
  _contribAlbumId = created.id;
  return _contribAlbumId;
}

const MAX_MB = parseInt(process.env.CONTRIBUTION_MAX_SIZE_MB || '200', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  },
});

function canEdit(user, story) {
  return user.role === 'admin' || story.created_by === user.id;
}

function verifyStoryToken(token, storyId) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.story_id === storyId;
  } catch {
    return false;
  }
}

// POST /api/public/:slug/contributions — viewer uploads a file
router.post('/public/:slug/contributions', uploadLimiter, upload.single('file'), async (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (!story.password_hash) return res.status(400).json({ error: 'Contributions require a password-protected story' });
  if (!story.contributions_enabled) return res.status(400).json({ error: 'Contributions are not enabled for this story' });

  const token = req.headers['x-story-token'];
  if (!token || !verifyStoryToken(token, story.id)) {
    return res.status(403).json({ error: 'Unlock the story before contributing' });
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const apiKey = process.env.IMMICH_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Server not configured for uploads' });

  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  const now = new Date().toISOString();
  const deviceAssetId = `contribution-${uuidv4()}`;

  const form = new FormData();
  form.append('assetData', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });
  form.append('deviceAssetId', deviceAssetId);
  form.append('deviceId', 'memoire-contribution');
  form.append('fileCreatedAt', now);
  form.append('fileModifiedAt', now);

  let immichAssetId;
  try {
    const response = await axios.post(`${baseURL}/api/assets`, form, {
      headers: { ...form.getHeaders(), 'x-api-key': apiKey },
      maxBodyLength: Infinity,
    });
    immichAssetId = response.data?.id;
    if (!immichAssetId) throw new Error('No asset ID returned from Immich');
  } catch (err) {
    const status = err.response?.status || 502;
    return res.status(status).json({ error: 'Failed to upload to Immich', detail: err.message });
  }

  // Add to dedicated Immich album (best-effort — don't fail the upload if this errors)
  try {
    const albumId = await getOrCreateContribAlbum();
    await axios.put(
      `${baseURL}/api/albums/${albumId}/assets`,
      { ids: [immichAssetId] },
      { headers: { 'x-api-key': apiKey } }
    );
  } catch { /* non-fatal */ }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO contributions (id, story_id, immich_asset_id, original_name, mime_type, uploader_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, story.id, immichAssetId, req.file.originalname, req.file.mimetype, req.body.uploader_name || null);

  res.status(201).json({ id, status: 'pending' });
});

// GET /api/stories/:storyId/contributions — list for editor
router.get('/stories/:storyId/contributions', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const { status } = req.query;
  const validStatuses = ['pending', 'approved', 'rejected'];
  const filter = validStatuses.includes(status) ? status : null;

  const rows = filter
    ? db.prepare('SELECT * FROM contributions WHERE story_id = ? AND status = ? ORDER BY uploaded_at DESC').all(story.id, filter)
    : db.prepare('SELECT * FROM contributions WHERE story_id = ? ORDER BY uploaded_at DESC').all(story.id);

  res.json(rows);
});

// GET /api/stories/:storyId/contributions/assets — approved assets for AssetPicker
router.get('/stories/:storyId/contributions/assets', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const rows = db.prepare(
    'SELECT id, immich_asset_id, original_name, mime_type, uploader_name, uploaded_at FROM contributions WHERE story_id = ? AND status = ? AND immich_asset_id IS NOT NULL ORDER BY uploaded_at DESC'
  ).all(story.id, 'approved');

  // Shape matches Immich asset format expected by AssetPicker
  const assets = rows.map((c) => ({
    id: c.immich_asset_id,
    type: c.mime_type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
    originalFileName: c.original_name,
    _uploaderName: c.uploader_name,
    _uploadedAt: c.uploaded_at,
  }));

  res.json(assets);
});

// PATCH /api/stories/:storyId/contributions/:id — approve or reject
router.patch('/stories/:storyId/contributions/:id', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const contrib = db.prepare('SELECT * FROM contributions WHERE id = ? AND story_id = ?').get(req.params.id, story.id);
  if (!contrib) return res.status(404).json({ error: 'Contribution not found' });

  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }

  db.prepare('UPDATE contributions SET status = ? WHERE id = ?').run(status, contrib.id);

  if (status === 'approved' && contrib.immich_asset_id) {
    // Insert into story_assets so asset appears in editor's asset picker
    db.prepare(`
      INSERT OR IGNORE INTO story_assets (story_id, asset_id, album_id)
      VALUES (?, ?, 'contribution')
    `).run(story.id, contrib.immich_asset_id);
  }

  res.json({ id: contrib.id, status });
});

// DELETE /api/stories/:storyId/contributions/:id
router.delete('/stories/:storyId/contributions/:id', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const contrib = db.prepare('SELECT * FROM contributions WHERE id = ? AND story_id = ?').get(req.params.id, story.id);
  if (!contrib) return res.status(404).json({ error: 'Contribution not found' });

  db.prepare('DELETE FROM contributions WHERE id = ?').run(contrib.id);
  res.status(204).end();
});

// Multer error handler (file too large, wrong type)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Ficheiro demasiado grande (máximo ${MAX_MB} MB)` });
  }
  if (err.message === 'Only images and videos are allowed') {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
