const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Migration: Rename old lyricword databases to harmonix if they exist
const oldProdDb = path.join(__dirname, 'lyricword.db');
const newProdDb = path.join(__dirname, 'harmonix.db');
const oldTestDb = path.join(__dirname, 'lyricword.test.db');
const newTestDb = path.join(__dirname, 'harmonix.test.db');

try {
  if (fs.existsSync(oldProdDb) && !fs.existsSync(newProdDb)) {
    fs.renameSync(oldProdDb, newProdDb);
    console.log(`[DB] Migrated ${oldProdDb} to ${newProdDb}`);
  }
  if (fs.existsSync(oldTestDb) && !fs.existsSync(newTestDb)) {
    fs.renameSync(oldTestDb, newTestDb);
    console.log(`[DB] Migrated ${oldTestDb} to ${newTestDb}`);
  }
} catch (err) {
  console.error('[DB] Failed to migrate database files:', err);
}

const dbPath = process.env.NODE_ENV === 'test'
  ? newTestDb
  : newProdDb;

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Core schema
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


// Migration: user learning preferences
const userPrefCols = db.prepare("PRAGMA table_info(users)").all();
if (!userPrefCols.some(col => col.name === 'target_language')) {
 db.exec("ALTER TABLE users ADD COLUMN target_language TEXT DEFAULT 'es'");
}
if (!userPrefCols.some(col => col.name === 'genre')) {
 db.exec("ALTER TABLE users ADD COLUMN genre TEXT DEFAULT 'pop'");
}
if (!userPrefCols.some(col => col.name === 'difficulty')) {
 db.exec("ALTER TABLE users ADD COLUMN difficulty TEXT DEFAULT 'medium'");
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
 )
`);

// Deduplication across (case-insensitive / accent-insensitive word, language).
// SQLite isn't great at canonical folds in CHECK constraints in older builds;
// we maintain a tight unique index on a canonicalized column instead.
const vocabColumns = db.prepare("PRAGMA table_info(vocab_items)").all();
if (!vocabColumns.some(col => col.name === 'canonical_key')) {
 db.exec("ALTER TABLE vocab_items ADD COLUMN canonical_key TEXT");
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_canonical_key ON vocab_items(canonical_key)`);

db.exec(`
 CREATE TABLE IF NOT EXISTS song_vocab_map (
 song_id TEXT NOT NULL,
 vocab_id TEXT NOT NULL,
 line_index INTEGER NOT NULL,
 char_start INTEGER NOT NULL,
 char_end INTEGER,
 word_index INTEGER,
 context_sentence TEXT,
 PRIMARY KEY (song_id, vocab_id, line_index, char_start),
 FOREIGN KEY (vocab_id) REFERENCES vocab_items(id)
 )
`);

db.exec(`
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
 )
`);

// Study / Gamification tables
db.exec(`
 CREATE TABLE IF NOT EXISTS user_stats (
 user_id TEXT PRIMARY KEY,
 streak_days INTEGER DEFAULT 0,
 total_xp INTEGER DEFAULT 0,
 last_study_date DATE,
 daily_goal INTEGER DEFAULT 20,
 FOREIGN KEY (user_id) REFERENCES users(id)
 )
`);

db.exec(`
 CREATE TABLE IF NOT EXISTS quiz_sessions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 song_id TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME,
 score INTEGER DEFAULT 0,
 total_questions INTEGER DEFAULT 0,
 FOREIGN KEY (user_id) REFERENCES users(id)
 )
`);

db.exec(`
 CREATE TABLE IF NOT EXISTS quiz_answers (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL,
 vocab_id TEXT,
 user_answer TEXT,
 is_correct INTEGER DEFAULT 0,
 answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (session_id) REFERENCES quiz_sessions(id),
 FOREIGN KEY (vocab_id) REFERENCES vocab_items(id)
 )
`);

// Migration: make vocab_id nullable so we can insert quiz_answers rows that
// couldn't be resolved to a known vocab_id (the AI sometimes emits tokens
// we can't canonicalize). Without this, the FK constraint fires and the
// whole /answer endpoint 500s.
//
// SQLite doesn't support `ALTER TABLE ... DROP NOT NULL` directly; we rebuild
// the table to apply the change. Safe because quiz_answers is append-only.
{
 const cols = db.prepare("PRAGMA table_info(quiz_answers)").all();
 const col = cols.find(c => c.name === 'vocab_id');
 // In SQLite, "notnull: 1" means NOT NULL. We want it 0.
 if (col && col.notnull === 1) {
 db.exec(`
 BEGIN;
 CREATE TABLE quiz_answers_new (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL,
 vocab_id TEXT,
 user_answer TEXT,
 is_correct INTEGER DEFAULT 0,
 answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (session_id) REFERENCES quiz_sessions(id),
 FOREIGN KEY (vocab_id) REFERENCES vocab_items(id)
 );
 INSERT INTO quiz_answers_new (id, session_id, vocab_id, user_answer, is_correct, answered_at)
 SELECT id, session_id, vocab_id, user_answer, is_correct, answered_at FROM quiz_answers;
 DROP TABLE quiz_answers;
 ALTER TABLE quiz_answers_new RENAME TO quiz_answers;
 COMMIT;
 `);
 }
}

// Data reliability tables
db.exec(`
 CREATE TABLE IF NOT EXISTS validated_songs (
 song_id TEXT PRIMARY KEY,
 artist TEXT,
 title TEXT,
 duration INTEGER,
 lrc_valid INTEGER DEFAULT 0,
 lrc_checked_at DATETIME,
 score REAL DEFAULT 0
 )
`);

db.exec(`
 CREATE TABLE IF NOT EXISTS song_cache (
 song_id TEXT PRIMARY KEY,
 lyrics_json TEXT,
 track_json TEXT,
 cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 expires_at DATETIME
 )
`);

// Song-level lyrics snapshot taken at extraction time. Used by the alignment
// verifier in /api/vocab to faithfully re-offset cached mappings against the
// SAME line split the karaoke player renders (LRCLib historically returns
// different neighbouring responses on repeat calls, so we cannot trust a
// post-hoc `/api/lyrics` call to match the version aligned originally).
db.exec(`
 CREATE TABLE IF NOT EXISTS song_lyrics_snapshot (
 song_id TEXT PRIMARY KEY,
 synced_lyrics TEXT NOT NULL,
 plain_lyrics TEXT,
 fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
 )
`);


db.exec(`
 CREATE TABLE IF NOT EXISTS daily_words (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 date TEXT NOT NULL,
 word_json TEXT NOT NULL,
 generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id)
 )
`);

// Migration: allow multiple discovered words per day (drop one-word-per-day unique constraint).
{
  const dailyWordsSql = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'daily_words'"
  ).get()?.sql || '';
  if (dailyWordsSql.includes('UNIQUE(user_id, date)')) {
    db.exec(`
      BEGIN;
      CREATE TABLE daily_words_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        word_json TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT INTO daily_words_history (id, user_id, date, word_json, generated_at)
      SELECT id, user_id, date, word_json, generated_at FROM daily_words;
      DROP TABLE daily_words;
      ALTER TABLE daily_words_history RENAME TO daily_words;
      COMMIT;
    `);
  }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_words_user_generated ON daily_words(user_id, generated_at DESC)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_word_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    word_json TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    consumed_at DATETIME,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_word_queue_ready ON user_word_queue(user_id, consumed_at, expires_at)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_queue_refill (
    user_id TEXT PRIMARY KEY,
    refilling INTEGER DEFAULT 0,
    started_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Refill flags are in-memory; clear stale rows left by crashes/restarts.
db.exec(`
  UPDATE user_queue_refill
  SET refilling = 0, started_at = NULL
  WHERE refilling = 1
`);

// Migration: Add native_language to users
const userLangCols = db.prepare("PRAGMA table_info(users)").all();
if (!userLangCols.some(col => col.name === 'native_language')) {
  db.exec("ALTER TABLE users ADD COLUMN native_language TEXT DEFAULT 'en'");
}

// Playlist and Gamification tables
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist_songs (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_songs_unique ON playlist_songs(playlist_id, song_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    criteria_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
  )
`);

// Seed badges
const badgeCount = db.prepare('SELECT COUNT(*) as count FROM badges').get().count;
if (badgeCount === 0) {
  const insertBadge = db.prepare('INSERT OR IGNORE INTO badges (id, name, description, icon, category, criteria_json) VALUES (?, ?, ?, ?, ?, ?)');
  const seedData = [
    ['streak_7', '7-Day Streak', 'Maintain a 7-day study streak', 'Flame', 'streak', JSON.stringify({type:'streak_days',threshold:7})],
    ['vocab_50', 'Vocabulary Builder', 'Master 50 vocabulary words', 'BookOpen', 'vocabulary', JSON.stringify({type:'vocab_count',threshold:50})],
    ['quiz_perfect', 'Quiz Master', 'Score 100% on a quiz', 'Award', 'quiz', JSON.stringify({type:'perfect_quiz',threshold:1})],
    ['playlist_first', 'Curator', 'Create your first playlist', 'ListMusic', 'playlist', JSON.stringify({type:'playlist_count',threshold:1})],
    ['daily_word_7', 'Daily Dedication', 'Get your daily word 7 days in a row', 'CalendarDays', 'daily_word', JSON.stringify({type:'daily_word_streak',threshold:7})]
  ];
  const txn = db.transaction(() => {
    for (const b of seedData) insertBadge.run(...b);
  });
  txn();
}

const { ensureCanonicalKeys } = require('./services/canonicalKeyService');
ensureCanonicalKeys(db);

module.exports = db;
