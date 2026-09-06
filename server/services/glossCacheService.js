/**
 * Persistent word-gloss cache.
 *
 * Every gloss we ever accept (AI, curated table, MyMemory) is remembered per
 * (word, from, to). When all live providers are exhausted — OpenRouter/NIM
 * daily 429s plus the anonymous MyMemory quota — a learner still gets a
 * meaning for any word another user already saw, instead of a blank card.
 */
const db = require("../db");

db.exec(`
  CREATE TABLE IF NOT EXISTS gloss_cache (
    word TEXT NOT NULL,
    from_lang TEXT NOT NULL,
    to_lang TEXT NOT NULL,
    translation TEXT NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (word, from_lang, to_lang)
  )
`);

const selectStmt = db.prepare(
  "SELECT translation, source FROM gloss_cache WHERE word = ? AND from_lang = ? AND to_lang = ?"
);
const upsertStmt = db.prepare(`
  INSERT INTO gloss_cache (word, from_lang, to_lang, translation, source)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(word, from_lang, to_lang) DO UPDATE SET
    translation = excluded.translation,
    source = excluded.source,
    updated_at = CURRENT_TIMESTAMP
`);
const insertIgnoreStmt = db.prepare(`
  INSERT OR IGNORE INTO gloss_cache (word, from_lang, to_lang, translation, source)
  VALUES (?, ?, ?, ?, ?)
`);
const countStmt = db.prepare("SELECT COUNT(*) AS c FROM gloss_cache");

function normKey(word) {
  return String(word || "").trim().toLowerCase();
}

function normLang(code) {
  return String(code || "").trim().toLowerCase();
}

function getGloss(word, fromLang, toLang) {
  const key = normKey(word);
  const from = normLang(fromLang);
  const to = normLang(toLang);
  if (!key || !from || !to || from === to) return null;
  const row = selectStmt.get(key, from, to);
  return row?.translation || null;
}

/** Same as getGloss but keeps the provenance so callers can decide trust. */
function getGlossWithSource(word, fromLang, toLang) {
  const key = normKey(word);
  const from = normLang(fromLang);
  const to = normLang(toLang);
  if (!key || !from || !to || from === to) return null;
  const row = selectStmt.get(key, from, to);
  if (!row?.translation) return null;
  return { translation: row.translation, source: row.source || "unknown" };
}

function rememberGloss(word, fromLang, toLang, translation, source = "unknown") {
  const key = normKey(word);
  const from = normLang(fromLang);
  const to = normLang(toLang);
  const value = String(translation || "").trim();
  if (!key || !from || !to || from === to || !value) return false;
  // Never store an identity "translation" — it is not a meaning.
  if (value.toLowerCase() === key) return false;
  upsertStmt.run(key, from, to, value, source);
  return true;
}

function count() {
  return countStmt.get().c;
}

/**
 * One-off warm-up from historical daily words that already carry a good gloss
 * (gloss_v >= 2). Idempotent — INSERT OR IGNORE — so it is safe on every boot.
 */
function backfillFromDailyWords({ isSuspicious = () => false } = {}) {
  const rows = db.prepare(`
    SELECT dw.word_json AS word_json, u.native_language AS native_language
    FROM daily_words dw
    JOIN users u ON u.id = dw.user_id
  `).all();
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      let payload;
      try {
        payload = JSON.parse(row.word_json);
      } catch {
        continue;
      }
      const word = payload?.word;
      const text = normKey(word?.text);
      const translation = String(word?.translation || "").trim();
      const from = normLang(payload?.language_code);
      const to = normLang(row.native_language);
      if (!text || !translation || !from || !to || from === to) continue;
      if (Number(word?.gloss_v || 0) < 2) continue;
      if (translation.toLowerCase() === text) continue;
      if (isSuspicious(text, translation, payload?.lyric?.snippet || null)) continue;
      const res = insertIgnoreStmt.run(text, from, to, translation, "backfill");
      inserted += res.changes;
    }
  });
  tx();
  return inserted;
}

/**
 * Rewrite stored daily/queue payloads that have no meaning, using a sync lookup
 * (curated table / cache). Used at boot so a reload is not stuck on a blank card.
 */
function fillThinStoredWords(lookup) {
  if (typeof lookup !== "function") return { updated: 0 };
  let updated = 0;
  const dw = db.prepare(`
    SELECT dw.id AS id, dw.word_json AS word_json, u.native_language AS native_language,
           u.target_language AS target_language
    FROM daily_words dw
    JOIN users u ON u.id = dw.user_id
  `).all();
  const updDw = db.prepare("UPDATE daily_words SET word_json = ? WHERE id = ?");
  const q = db.prepare(`
    SELECT q.id AS id, q.word_json AS word_json, u.native_language AS native_language,
           u.target_language AS target_language
    FROM user_word_queue q
    JOIN users u ON u.id = q.user_id
    WHERE q.consumed_at IS NULL
  `).all();
  const updQ = db.prepare("UPDATE user_word_queue SET word_json = ? WHERE id = ?");
  const patchForUser = (json, fromLang, toLang) => {
    let payload;
    try {
      payload = JSON.parse(json);
    } catch {
      return null;
    }
    const text = payload?.word?.text;
    const current = String(payload?.word?.translation || "").trim();
    if (!text || current) return null;
    const from = normLang(payload?.language_code || fromLang);
    const to = normLang(toLang);
    const line = payload?.lyric?.snippet || null;
    const hit = lookup(text, from, to, line);
    if (!hit) return null;
    // Lookup may return a plain string (legacy) or { translation, trusted }.
    const translation = typeof hit === "string" ? hit : hit.translation;
    if (!translation) return null;
    const trusted = typeof hit === "string" ? true : hit.trusted !== false;
    payload.word = { ...payload.word, translation, gloss_v: trusted ? 2 : 1 };
    return JSON.stringify(payload);
  };
  const tx = db.transaction(() => {
    for (const row of dw) {
      const next = patchForUser(row.word_json, row.target_language, row.native_language);
      if (next) {
        updDw.run(next, row.id);
        updated += 1;
      }
    }
    for (const row of q) {
      const next = patchForUser(row.word_json, row.target_language, row.native_language);
      if (next) {
        updQ.run(next, row.id);
        updated += 1;
      }
    }
  });
  tx();
  return { updated };
}

module.exports = {
  getGloss,
  getGlossWithSource,
  rememberGloss,
  backfillFromDailyWords,
  fillThinStoredWords,
  count,
};
