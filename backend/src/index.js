require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const blocksRoutes = require('./routes/blocks');
const immichRoutes = require('./routes/immich');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.VITE_API_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/stories/:storyId/blocks', blocksRoutes);
app.use('/api/immich', immichRoutes);

// Public viewer endpoint lives under immich router but mounted at /api
app.get('/api/public/:slug', (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const blocks = db.prepare('SELECT * FROM blocks WHERE story_id = ? ORDER BY position ASC').all(story.id);
  const { password_hash, ...publicStory } = story;
  res.json({ story: publicStory, blocks });
});

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
