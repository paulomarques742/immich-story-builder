const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const { pipeStream, proxyImmichVideo, forwardStreamHeaders } = require('../lib/streamProxy');

const router = express.Router();

function immichClient() {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  return axios.create({
    baseURL: `${baseURL}/api`,
    headers: { 'x-api-key': process.env.IMMICH_API_KEY },
  });
}

// GET /api/immich/albums
router.get('/albums', requireAuth, async (req, res) => {
  try {
    const params = {};
    if (req.query.shared !== undefined) params.shared = req.query.shared;
    const { data } = await immichClient().get('/albums', { params });
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets  (assets fora de álbuns — usa search/metadata)
router.get('/assets', requireAuth, async (req, res) => {
  try {
    const body = { isNotInAlbum: true, size: 200, page: 1 };
    if (req.query.type) body.type = req.query.type;
    const { data } = await immichClient().post('/search/metadata', body);
    res.json(data.assets?.items || []);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/albums/:albumId/assets
router.get('/albums/:albumId/assets', requireAuth, async (req, res) => {
  try {
    const { data } = await immichClient().get(`/albums/${req.params.albumId}`);
    res.json(data.assets || []);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

function thumbAuth(req, res, next) {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

// GET /api/immich/assets/:assetId/thumb
router.get('/assets/:assetId/thumb', thumbAuth, requireAuth, async (req, res) => {
  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(
      `${baseURL}/api/assets/${req.params.assetId}/thumbnail`,
      {
        headers: { 'x-api-key': process.env.IMMICH_API_KEY },
        responseType: 'stream',
        params: { size: req.query.size || 'thumbnail' },
      }
    );
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    pipeStream(req, res, response);
  } catch (err) {
    console.error('[immich proxy]', req.path, err.response?.status, err.message);
    if (!res.headersSent) res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets/:assetId/original  (supports Range for video seeking)
router.get('/assets/:assetId/original', thumbAuth, requireAuth, async (req, res) => {
  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const headers = { 'x-api-key': process.env.IMMICH_API_KEY };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const response = await axios.get(
      `${baseURL}/api/assets/${req.params.assetId}/original`,
      { headers, responseType: 'stream' }
    );

    forwardStreamHeaders(res, response);
    pipeStream(req, res, response);
  } catch (err) {
    console.error('[immich proxy]', req.path, err.response?.status, err.message);
    if (!res.headersSent) res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets/:assetId/video  — proxy do stream de playback web do Immich
// (supports Range for seeking). Tenta /video/playback e cai para /original se falhar.
router.get('/assets/:assetId/video', thumbAuth, requireAuth, async (req, res) => {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  await proxyImmichVideo(req, res, { baseURL, apiKey: process.env.IMMICH_API_KEY, assetId: req.params.assetId });
});

// GET /api/immich/people
router.get('/people', requireAuth, async (req, res) => {
  try {
    const { data } = await immichClient().get('/people', { params: { size: 500, withHidden: false } });
    const people = (data.people || []).filter((p) => !p.isHidden);
    res.json(people);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/people/:personId/thumb
router.get('/people/:personId/thumb', thumbAuth, requireAuth, async (req, res) => {
  try {
    const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
    const response = await axios.get(
      `${baseURL}/api/people/${req.params.personId}/thumbnail`,
      {
        headers: { 'x-api-key': process.env.IMMICH_API_KEY },
        responseType: 'stream',
      }
    );
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    pipeStream(req, res, response);
  } catch (err) {
    console.error('[immich proxy]', req.path, err.response?.status, err.message);
    if (!res.headersSent) res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/people/:personId/assets  — asset IDs for a person
router.get('/people/:personId/assets', requireAuth, async (req, res) => {
  try {
    const { data } = await immichClient().post('/search/metadata', {
      personIds: [req.params.personId],
      size: 500,
      page: 1,
    });
    const ids = (data.assets?.items || []).map((a) => a.id);
    res.json(ids);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

// GET /api/immich/assets/:assetId/exif  — GPS + EXIF metadata
router.get('/assets/:assetId/exif', requireAuth, async (req, res) => {
  try {
    const { data } = await immichClient().get(`/assets/${req.params.assetId}`);
    const exif = data.exifInfo || {};
    res.json({
      lat: exif.latitude ?? null,
      lng: exif.longitude ?? null,
      city: exif.city ?? null,
      country: exif.country ?? null,
      make: exif.make ?? null,
      model: exif.model ?? null,
      dateTimeOriginal: exif.dateTimeOriginal ?? null,
    });
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: 'Immich error' });
  }
});

module.exports = router;
