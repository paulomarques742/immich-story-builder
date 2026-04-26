const express = require('express');
const axios = require('axios');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function immichClient(token) {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  return axios.create({
    baseURL: `${baseURL}/api`,
    headers: { 'x-api-key': token },
  });
}

// GET /api/immich/albums
router.get('/albums', requireAuth, async (req, res) => {
  if (!req.user.immich_token) return res.status(400).json({ error: 'No Immich token for this user' });
  try {
    const { data } = await immichClient(req.user.immich_token).get('/albums');
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/albums/:albumId/assets
router.get('/albums/:albumId/assets', requireAuth, async (req, res) => {
  if (!req.user.immich_token) return res.status(400).json({ error: 'No Immich token for this user' });
  try {
    const { data } = await immichClient(req.user.immich_token).get(`/albums/${req.params.albumId}`);
    res.json(data.assets || []);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets/:assetId/thumb
router.get('/assets/:assetId/thumb', requireAuth, async (req, res) => {
  if (!req.user.immich_token) return res.status(400).json({ error: 'No Immich token for this user' });
  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(
      `${baseURL}/api/assets/${req.params.assetId}/thumbnail`,
      {
        headers: { 'x-api-key': req.user.immich_token },
        responseType: 'stream',
        params: { size: req.query.size || 'thumbnail' },
      }
    );
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets/:assetId/original
router.get('/assets/:assetId/original', requireAuth, async (req, res) => {
  if (!req.user.immich_token) return res.status(400).json({ error: 'No Immich token for this user' });
  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(
      `${baseURL}/api/assets/${req.params.assetId}/original`,
      {
        headers: { 'x-api-key': req.user.immich_token },
        responseType: 'stream',
      }
    );
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/public/:slug — public viewer (no auth)
router.get('/public/:slug', (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const blocks = db.prepare('SELECT * FROM blocks WHERE story_id = ? ORDER BY position ASC').all(story.id);
  const { password_hash, ...publicStory } = story;
  res.json({ story: publicStory, blocks });
});

module.exports = router;
