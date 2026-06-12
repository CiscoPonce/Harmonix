const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'lyricword.db'));
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add cefr_level to users
const usersColumns = db.prepare("PRAGMA table_info(users)").all();
if (!usersColumns.some(col => col.name === 'cefr_level')) {
  db.exec("ALTER TABLE users ADD COLUMN cefr_level TEXT DEFAULT 'B1'");
}

// Vocabulary tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vocab_items (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    lemma TEXT,
    definition TEXT,
    cefr_level TEXT,
    language_code TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS song_vocab_map (
    song_id TEXT NOT NULL,
    vocab_id TEXT NOT NULL,
    line_index INTEGER NOT NULL,
    char_start INTEGER NOT NULL,
    word_index INTEGER,
    context_sentence TEXT,
    PRIMARY KEY (song_id, vocab_id, line_index, char_start),
    FOREIGN KEY (vocab_id) REFERENCES vocab_items(id)
  );

  CREATE TABLE IF NOT EXISTS user_vocab_progress (
    user_id TEXT NOT NULL,
    vocab_id TEXT NOT NULL,
    stability REAL DEFAULT 0,
    difficulty REAL DEFAULT 0,
    last_review DATETIME,
    next_review DATETIME,
    reps INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, vocab_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (vocab_id) REFERENCES vocab_items(id)
  );
`);

module.exports = db;
