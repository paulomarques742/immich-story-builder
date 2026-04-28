CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password_hash TEXT,
  immich_token TEXT,
  role        TEXT DEFAULT 'editor',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stories (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  cover_asset_id TEXT,
  password_hash TEXT,
  immich_album_ids TEXT NOT NULL DEFAULT '[]',
  sync_mode   TEXT DEFAULT 'notify',
  published   INTEGER DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
  id          TEXT PRIMARY KEY,
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  content     TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  approved    INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id          TEXT PRIMARY KEY,
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, asset_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS story_assets (
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL,
  album_id    TEXT NOT NULL,
  seen_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (story_id, asset_id)
);

CREATE TABLE IF NOT EXISTS sync_notifications (
  id          TEXT PRIMARY KEY,
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  new_asset_ids TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  dismissed   INTEGER DEFAULT 0
);
