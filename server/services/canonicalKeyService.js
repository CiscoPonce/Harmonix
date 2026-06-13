/**
 * Canonical key for vocabulary dedup.
 *
 *  - Lowercase
 *  - Unicode-normalize (NFC) so composed/decomposed forms collapse to bytes
 *  - Strip combining diacritics (NFD → drop combining marks) so "corazón"/"corazon"
 *    share one row
 *
 * The result is the lookup key for the `canonical_key` UNIQUE index on
 * `vocab_items(word, language_code)`. Computed the same way at insertion time
 * and at lookup time so any client can pre-compute a key.
 */
function foldWord(s) {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Walk vocab_items, populate any missing `canonical_key`, and merge
 * preexisting duplicates (different rows for the same canonical key). For the
 * older rows we keep one row per key (the lexicographically smallest id wins)
 * and re-assign `song_vocab_map.vocab_id` references to point at it.
 *
 * Idempotent: safe to call on every db load.
 *
 * @param {import('better-sqlite3').Database} db - the same db module that's
 *   done initializing. We take it as an argument so callers can avoid the
 *   require('./db') cycle from inside db.js itself.
 */
function ensureCanonicalKeys(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('ensureCanonicalKeys: db (better-sqlite3 instance) is required');
  }

  // 1. Quick path: every row already has a key.
  const unkeyed = db.prepare(
    `SELECT id, word, language_code FROM vocab_items WHERE canonical_key IS NULL OR canonical_key = ''`
  ).all();

  if (unkeyed.length > 0) {
    const setKey = db.prepare(`UPDATE vocab_items SET canonical_key = ? WHERE id = ?`);
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        setKey.run(`${foldWord(r.word)}|${r.language_code || ''}`, r.id);
      }
    });
    tx(unkeyed);
  }

  // 2. After pruning duplicates below, any new insert with the same canonical_key
  //    will collide on the unique index and we resolve it by reusing the existing
  //    row. This migration is just for pre-existing data.
  const dupGroups = db.prepare(`
    SELECT canonical_key, COUNT(*) AS n, MIN(id) AS keep_id
    FROM vocab_items
    WHERE canonical_key IS NOT NULL
    GROUP BY canonical_key
    HAVING n > 1
  `).all();

  if (dupGroups.length > 0) {
    const reassign = db.prepare(`UPDATE song_vocab_map SET vocab_id = ? WHERE vocab_id = ?`);
    const removeRow = db.prepare(`DELETE FROM vocab_items WHERE id = ? AND id != ?`);
    const tx = db.transaction(() => {
      for (const g of dupGroups) {
        const siblings = db.prepare(
          `SELECT id FROM vocab_items WHERE canonical_key = ? AND id != ?`
        ).all(g.canonical_key, g.keep_id);
        for (const sib of siblings) {
          reassign.run(g.keep_id, sib.id);
          removeRow.run(sib.id, g.keep_id);
        }
      }
    });
    tx();
  }
}

module.exports = { foldWord, ensureCanonicalKeys };
