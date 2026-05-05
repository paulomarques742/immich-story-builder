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

CREATE TABLE IF NOT EXISTS ai_jobs (
  id             TEXT PRIMARY KEY,
  story_id       TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',
  progress       INTEGER DEFAULT 0,
  processed      INTEGER DEFAULT 0,
  total          INTEGER DEFAULT 0,
  blocks_created INTEGER DEFAULT 0,
  error          TEXT,
  suggestions    TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contributions (
  id              TEXT PRIMARY KEY,
  story_id        TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  immich_asset_id TEXT,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  uploader_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','approved','rejected')),
  uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_ai_scores (
  asset_id          TEXT PRIMARY KEY,
  score             REAL,
  theme             TEXT,
  mood              TEXT,
  is_hero           INTEGER DEFAULT 0,
  subject           TEXT,
  suggested_caption TEXT,
  city              TEXT,
  country           TEXT,
  lat               REAL,
  lng               REAL,
  analysed_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  title_pt          TEXT DEFAULT '',
  people_json       TEXT,
  tags_json         TEXT,
  is_favorite       INTEGER DEFAULT 0,
  exif_rating       INTEGER,
  source            TEXT DEFAULT 'gemini'
);
