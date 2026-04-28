const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/db.sqlite');

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrations — safe to run on every startup
try { db.exec(`ALTER TABLE stories ADD COLUMN theme TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE asset_ai_scores ADD COLUMN title_pt TEXT DEFAULT ''`); } catch {}
// New users require admin approval; existing users stay approved (DEFAULT 1)
try { db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 1`); } catch {}

module.exports = db;
