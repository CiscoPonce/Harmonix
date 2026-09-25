/**
 * Persistent word-gloss cache.
 *
 * Every gloss we ever accept (AI, curated table, MyMemory) is remembered per
 * (word, from, to). When all live providers are exhausted — OpenRouter/NIM
 * daily 429s plus the anonymous MyMemory quota — a learner still gets a
 * meaning for any word another user already saw, instead of a blank card.
 *
 * Pronunciation / POS are optional extras: once an AI polish lands IPA, later
 * Next-word hits attach it instantly so Android and web do not wait.
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

function ensureColumn(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

ensureColumn("gloss_cache", "pronunciation", "TEXT");
ensureColumn("gloss_cache", "part_of_speech", "TEXT");

const selectStmt = db.prepare(
  `SELECT translation, source, pronunciation, part_of_speech
   FROM gloss_cache WHERE word = ? AND from_lang = ? AND to_lang = ?`
);
const upsertStmt = db.prepare(`
  INSERT INTO gloss_cache (word, from_lang, to_lang, translation, source, pronunciation, part_of_speech)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(word, from_lang, to_lang) DO UPDATE SET
    translation = excluded.translation,
    source = excluded.source,
    pronunciation = COALESCE(excluded.pronunciation, gloss_cache.pronunciation),
    part_of_speech = COALESCE(excluded.part_of_speech, gloss_cache.part_of_speech),
    updated_at = CURRENT_TIMESTAMP
`);
const insertIgnoreStmt = db.prepare(`
  INSERT OR IGNORE INTO gloss_cache (word, from_lang, to_lang, translation, source, pronunciation, part_of_speech)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const fillMetaStmt = db.prepare(`
  UPDATE gloss_cache
  SET pronunciation = COALESCE(pronunciation, ?),
      part_of_speech = COALESCE(part_of_speech, ?),
      updated_at = CURRENT_TIMESTAMP
  WHERE word = ? AND from_lang = ? AND to_lang = ?
    AND (pronunciation IS NULL OR part_of_speech IS NULL)
`);
const countStmt = db.prepare("SELECT COUNT(*) AS c FROM gloss_cache");

function normKey(word) {
  return String(word || "").trim().toLowerCase();
}

function normLang(code) {
  return String(code || "").trim().toLowerCase();
}

function cleanMeta(value) {
  const text = String(value || "").trim();
  return text || null;
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
  return {
    translation: row.translation,
    source: row.source || "unknown",
    pronunciation: row.pronunciation || null,
    part_of_speech: row.part_of_speech || null,
  };
}

function rememberGloss(word, fromLang, toLang, translation, source = "unknown", extra = {}) {
  const key = normKey(word);
  const from = normLang(fromLang);
  const to = normLang(toLang);
  const value = String(translation || "").trim();
  if (!key || !from || !to || from === to || !value) return false;
  // Never store an identity "translation" — it is not a meaning.
  if (value.toLowerCase() === key) return false;
  upsertStmt.run(
    key,
    from,
    to,
    value,
    source,
    cleanMeta(extra.pronunciation),
    cleanMeta(extra.part_of_speech)
  );
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
      const pronunciation = cleanMeta(word?.pronunciation);
      const partOfSpeech = cleanMeta(word?.part_of_speech);
      const res = insertIgnoreStmt.run(
        text,
        from,
        to,
        translation,
        "backfill",
        pronunciation,
        partOfSpeech
      );
      inserted += res.changes;
      if (pronunciation || partOfSpeech) {
        fillMetaStmt.run(pronunciation, partOfSpeech, text, from, to);
      }
    }
  });
  tx();
  return inserted;
}

/**
 * Rewrite stored daily/queue payloads that have no meaning, using a sync lookup
 * (curated table / cache). Used at boot so a reload is not stuck on a blank card.
 * Also attaches cached IPA/POS when the stored card already has a translation.
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
    const currentIpa = cleanMeta(payload?.word?.pronunciation);
    if (!text || (current && currentIpa)) return null;
    const from = normLang(payload?.language_code || fromLang);
    const to = normLang(toLang);
    const line = payload?.lyric?.snippet || null;
    const hit = lookup(text, from, to, line);
    const cached = getGlossWithSource(text, from, to);
    const translation = current
      || (typeof hit === "string" ? hit : hit?.translation)
      || cached?.translation
      || null;
    const pronunciation = currentIpa || cached?.pronunciation || hit?.pronunciation || null;
    const partOfSpeech = cleanMeta(payload?.word?.part_of_speech)
      || cached?.part_of_speech
      || hit?.part_of_speech
      || null;
    if (!translation) return null;
    if (current && currentIpa) return null;
    if (current && !pronunciation) return null;
    const trusted = typeof hit === "string" ? true : hit?.trusted !== false;
    payload.word = {
      ...payload.word,
      translation,
      pronunciation: pronunciation || payload.word.pronunciation || null,
      part_of_speech: partOfSpeech || payload.word.part_of_speech || null,
    };
    if (!current) {
      payload.word.gloss_v = trusted ? 2 : 1;
    }
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

/**
 * Replace a stored meaning the quality check now rejects (dictionary wrong-sense
 * hits such as lady → ama) with the curated gloss, on shelf cards, the queue,
 * and the shared cache. Cards that already have IPA are included.
 */
function replaceSuspiciousStoredGlosses(isSuspicious, lookup) {
  if (typeof isSuspicious !== "function" || typeof lookup !== "function") return { updated: 0 };
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

  const replacementFor = (text, from, to, line, current) => {
    if (!isSuspicious(text, current, line)) return null;
    const hit = lookup(text, from, to, line);
    const next = String((typeof hit === "string" ? hit : hit?.translation) || "").trim();
    if (!next || next.toLowerCase() === String(current).toLowerCase()) return null;
    if (isSuspicious(text, next, line)) return null;
    const trusted = typeof hit === "string" ? true : hit?.trusted !== false;
    return { translation: next, trusted };
  };

  const patch = (json, fromLang, toLang) => {
    let payload;
    try {
      payload = JSON.parse(json);
    } catch {
      return null;
    }
    const text = payload?.word?.text;
    const current = String(payload?.word?.translation || "").trim();
    if (!text || !current) return null;
    const from = normLang(payload?.language_code || fromLang);
    const to = normLang(toLang);
    const line = payload?.lyric?.snippet || null;
    const next = replacementFor(text, from, to, line, current);
    if (!next) return null;
    payload.word = {
      ...payload.word,
      translation: next.translation,
      gloss_v: next.trusted ? 2 : 1,
    };
    rememberGloss(text, from, to, next.translation, next.trusted ? "curated" : "repair");
    return JSON.stringify(payload);
  };

  const tx = db.transaction(() => {
    for (const row of dw) {
      const next = patch(row.word_json, row.target_language, row.native_language);
      if (next) {
        updDw.run(next, row.id);
        updated += 1;
      }
    }
    for (const row of q) {
      const next = patch(row.word_json, row.target_language, row.native_language);
      if (next) {
        updQ.run(next, row.id);
        updated += 1;
      }
    }
    const cached = db.prepare(
      "SELECT word, from_lang, to_lang, translation FROM gloss_cache"
    ).all();
    for (const row of cached) {
      const next = replacementFor(row.word, row.from_lang, row.to_lang, null, row.translation);
      if (!next) continue;
      rememberGloss(row.word, row.from_lang, row.to_lang, next.translation, next.trusted ? "curated" : "repair");
      updated += 1;
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
  replaceSuspiciousStoredGlosses,
  count,
};
