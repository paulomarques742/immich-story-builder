const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function canManage(user, story) {
  return user.role === 'admin' || story.created_by === user.id;
}

// GET /api/stories/:id/comments  (admin/creator)
router.get('/stories/:id/comments', requireAuth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  const comments = db.prepare(
    'SELECT * FROM comments WHERE story_id = ? ORDER BY created_at DESC'
  ).all(story.id);
  res.json(comments);
});

// DELETE /api/comments/:cid  (admin/creator)
router.delete('/comments/:cid', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Not found' });

  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(comment.story_id);
  if (!canManage(req.user, story)) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.status(204).end();
});

module.exports = router;
