const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function ownerClause(user) {
  if (user.role === 'admin') return { clause: '', params: [] };
  return { clause: 'AND s.created_by = ?', params: [user.id] };
}

// GET /api/social/feed — recent comments on user's stories
router.get('/social/feed', requireAuth, (req, res) => {
  const { clause, params } = ownerClause(req.user);
  const rows = db.prepare(`
    SELECT c.id, c.author_name, c.body, c.asset_id, c.created_at,
           s.id AS story_id, s.title AS story_title, s.slug AS story_slug
    FROM comments c
    JOIN stories s ON s.id = c.story_id
    WHERE 1=1 ${clause}
    ORDER BY c.created_at DESC
    LIMIT 100
  `).all(...params);
  res.json(rows);
});

// GET /api/social/assets — assets with engagement grouped by story
router.get('/social/assets', requireAuth, (req, res) => {
  const { clause, params } = ownerClause(req.user);

  const commentRows = db.prepare(`
    SELECT s.id AS story_id, s.title AS story_title, s.slug AS story_slug,
           c.asset_id, COUNT(*) AS n
    FROM comments c
    JOIN stories s ON s.id = c.story_id
    WHERE c.asset_id != '__story__' ${clause}
    GROUP BY s.id, c.asset_id
  `).all(...params);

  const likeRows = db.prepare(`
    SELECT s.id AS story_id, s.title AS story_title, s.slug AS story_slug,
           l.asset_id, COUNT(*) AS n
    FROM likes l
    JOIN stories s ON s.id = l.story_id
    WHERE 1=1 ${clause}
    GROUP BY s.id, l.asset_id
  `).all(...params);

  // Merge: key = story_id + asset_id
  const map = new Map();
  for (const r of commentRows) {
    const key = `${r.story_id}:${r.asset_id}`;
    map.set(key, { story_id: r.story_id, story_title: r.story_title, story_slug: r.story_slug, asset_id: r.asset_id, comment_count: r.n, like_count: 0 });
  }
  for (const r of likeRows) {
    const key = `${r.story_id}:${r.asset_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.like_count = r.n;
    } else {
      map.set(key, { story_id: r.story_id, story_title: r.story_title, story_slug: r.story_slug, asset_id: r.asset_id, comment_count: 0, like_count: r.n });
    }
  }

  const result = [...map.values()].sort((a, b) => {
    if (a.story_title < b.story_title) return -1;
    if (a.story_title > b.story_title) return 1;
    return (b.comment_count + b.like_count) - (a.comment_count + a.like_count);
  });

  res.json(result);
});

// GET /api/social/ranking — top 30 assets by like count
router.get('/social/ranking', requireAuth, (req, res) => {
  const { clause, params } = ownerClause(req.user);
  const rows = db.prepare(`
    SELECT s.title AS story_title, s.slug AS story_slug,
           l.asset_id, COUNT(*) AS like_count
    FROM likes l
    JOIN stories s ON s.id = l.story_id
    WHERE 1=1 ${clause}
    GROUP BY s.id, l.asset_id
    ORDER BY like_count DESC
    LIMIT 30
  `).all(...params);
  res.json(rows);
});

module.exports = router;
