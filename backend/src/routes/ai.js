const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { runAutoLayout } = require('../services/autoLayout');
const db = require('../db');

const router = express.Router();

function immichClient() {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  return axios.create({
    baseURL: `${baseURL}/api`,
    headers: { 'x-api-key': process.env.IMMICH_API_KEY },
  });
}

// POST /api/stories/:storyId/blocks/ai-layout
router.post('/stories/:storyId/blocks/ai-layout', requireAuth, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({ error: 'AI Layout não configurado. Adiciona GEMINI_API_KEY ao .env.' });
  }

  const { storyId } = req.params;
  const { album_ids, language = 'pt', replace_existing = false } = req.body;

  if (!album_ids?.length) {
    return res.status(400).json({ error: 'album_ids é obrigatório' });
  }

  // Verify story belongs to this user
  const story = db.prepare('SELECT id FROM stories WHERE id = ? AND created_by = ?').get(storyId, req.user.id);
  if (!story) return res.status(404).json({ error: 'Story não encontrada' });

  // Count total assets upfront for progress display
  let totalAssets = 0;
  try {
    const client = immichClient();
    for (const albumId of album_ids) {
      const { data } = await client.get(`/albums/${albumId}`);
      totalAssets += (data.assets || []).length;
    }
  } catch {
    totalAssets = 0;
  }

  const jobId = uuidv4();
  db.prepare(
    'INSERT INTO ai_jobs (id, story_id, status, total) VALUES (?, ?, ?, ?)'
  ).run(jobId, storyId, 'pending', totalAssets);

  // Launch background processing — intentionally no await
  runAutoLayout(storyId, album_ids, language, replace_existing, db, immichClient()).catch((err) => {
    db.prepare('UPDATE ai_jobs SET status=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run('error', err.message || 'Unknown error', jobId);
  });

  res.status(202).json({ job_id: jobId, status: 'processing', total_assets: totalAssets });
});

// GET /api/jobs/:jobId
router.get('/jobs/:jobId', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

module.exports = router;
