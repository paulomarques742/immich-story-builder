const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { runAutoLayout, generateSuggestions } = require('../services/autoLayout');
const db = require('../db');

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please slow down' },
});

const router = express.Router();

function immichClient() {
  const baseURL = process.env.IMMICH_URL?.replace(/\/$/, '');
  return axios.create({
    baseURL: `${baseURL}/api`,
    headers: { 'x-api-key': process.env.IMMICH_API_KEY },
  });
}

function getStory(storyId, userId) {
  return db.prepare('SELECT id FROM stories WHERE id = ? AND created_by = ?').get(storyId, userId);
}

async function countAlbumAssets(albumIds) {
  let total = 0;
  try {
    const client = immichClient();
    for (const albumId of albumIds) {
      const { data } = await client.get(`/albums/${albumId}`);
      total += (data.assets || []).length;
    }
  } catch {}
  return total;
}

// POST /api/stories/:storyId/blocks/ai-suggestions
// Phase 1: analyse album, generate 3 story concepts. Polls until status='suggestions_ready'.
router.post('/stories/:storyId/blocks/ai-suggestions', aiLimiter, requireAuth, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({ error: 'AI Layout não configurado. Adiciona GEMINI_API_KEY ao .env.' });
  }

  const { storyId } = req.params;
  const { album_ids, language = 'pt' } = req.body;

  if (!album_ids?.length) return res.status(400).json({ error: 'album_ids é obrigatório' });
  if (!getStory(storyId, req.user.id)) return res.status(404).json({ error: 'Story não encontrada' });

  const totalAssets = await countAlbumAssets(album_ids);
  const jobId = uuidv4();
  db.prepare('INSERT INTO ai_jobs (id, story_id, status, total) VALUES (?, ?, ?, ?)')
    .run(jobId, storyId, 'pending', totalAssets);

  generateSuggestions(jobId, storyId, album_ids, language, db, immichClient()).catch((err) => {
    db.prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(err.message || 'Unknown error', jobId);
  });

  res.status(202).json({ job_id: jobId, status: 'processing', total_assets: totalAssets });
});

// POST /api/stories/:storyId/blocks/ai-apply
// Phase 2: execute a selected suggestion and insert blocks.
router.post('/stories/:storyId/blocks/ai-apply', aiLimiter, requireAuth, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({ error: 'AI Layout não configurado. Adiciona GEMINI_API_KEY ao .env.' });
  }

  const { storyId } = req.params;
  const { suggestion_job_id, suggestion_idx = 0, replace_existing = false } = req.body;

  if (!suggestion_job_id) return res.status(400).json({ error: 'suggestion_job_id é obrigatório' });
  if (!getStory(storyId, req.user.id)) return res.status(404).json({ error: 'Story não encontrada' });

  const suggestJob = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(suggestion_job_id);
  if (!suggestJob) return res.status(404).json({ error: 'Job de sugestões não encontrado' });
  if (suggestJob.status !== 'suggestions_ready') {
    return res.status(400).json({ error: 'Sugestões ainda não estão prontas' });
  }

  let suggestions;
  try {
    suggestions = JSON.parse(suggestJob.suggestions || '[]');
  } catch {
    return res.status(500).json({ error: 'Erro ao ler sugestões' });
  }

  const chosen = suggestions[suggestion_idx];
  if (!chosen) return res.status(400).json({ error: 'Índice de sugestão inválido' });

  const totalAssets = await countAlbumAssets(chosen.album_ids || []);
  const jobId = uuidv4();
  db.prepare('INSERT INTO ai_jobs (id, story_id, status, total) VALUES (?, ?, ?, ?)')
    .run(jobId, storyId, 'pending', totalAssets);

  runAutoLayout(jobId, storyId, chosen, replace_existing, db, immichClient()).catch((err) => {
    db.prepare("UPDATE ai_jobs SET status='error', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(err.message || 'Unknown error', jobId);
  });

  res.status(202).json({ job_id: jobId, status: 'processing', total_assets: totalAssets });
});

// GET /api/jobs/:jobId
router.get('/jobs/:jobId', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const result = { ...job };
  if (job.suggestions) {
    try { result.suggestions = JSON.parse(job.suggestions); } catch { result.suggestions = []; }
  }
  res.json(result);
});

module.exports = router;
