const db = require('../db');

/**
 * Canonicalize a lookup token for vocab matching. Strips:
 *  - case (lower)
 *  - diacritics (combine NFD then drop combining marks)
 *  - spaces, underscores, hyphens (collapse to a single ASCII nothing)
 *  - common Spanish punctuation
 *
 * NOTE: this is NOT identical to canonicalKeyService.foldWord because we
 * ALSO collapse underscores and silently drop punctuation. The AI emits
 * vocab_id values like "pasito_a_pasito" or "vamos-yoga-ahora" which would
 * not match `foldWord` (which preserves underscores).
 */
function lookupKey(s) {
 if (s === null || s === undefined) return '';
 return String(s)
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/[\s_\-]+/g, '')
 .replace(/[.,;:!?¿¡"']+/g, '')
 .trim();
}

/**
 * Resolve an AI-provided vocab_id into a real `vocab_items.id`.
 *
 * Strategy:
 *  1. Try as a primary key directly (a real nanoid).
 *  2. Look up by canonical_key (lowercased + accent-folded), which already
 *     collapses spaces — the common case for a single Spanish word.
 *  3. Last resort: LIKE-narrow on word/lemma, then fold+compare for an
 *     exact canonical match (catches underscored phrases from the model).
 *  4. Return null on no match — caller should accept NULL for vocab_id so
 *     we never break the quiz flow.
 */
function resolveVocabId(aiValue) {
 if (!aiValue) return null;
 if (typeof aiValue !== 'string') return null;
 const str = aiValue;

 // Step 1: primary key hit.
 const byId = db.prepare('SELECT id FROM vocab_items WHERE id = ?').get(str);
 if (byId) return byId.id;

 // Step 2: canonical-key (lowercase + accent-fold) lookup. Only matches
 // single-word entries without underscores, but those are the bulk.
 const probeKey = lookupKey(str);
 if (probeKey) {
 // canonical_key column is `<fold(word)>|<lang>`. Try with es (default).
 const byCanon = db.prepare(
 `SELECT id FROM vocab_items WHERE canonical_key = ? LIMIT 1`
 ).get(`${probeKey}|es`);
 if (byCanon) return byCanon.id;
 }

 // Step 3: LIKE scan. The model sometimes emits phrases like
 // "pasito_a_pasito" or "dando_y_dandolo" — fold them in node.
 if (!probeKey) return null;
 const probe = probeKey.slice(0, 12);
 let candidates = [];
 try {
 candidates = db.prepare(
 `SELECT id, word, lemma FROM vocab_items WHERE LOWER(word) LIKE ? OR LOWER(lemma) LIKE ? LIMIT 25`
 ).all(`%${probe}%`, `%${probe}%`);
 } catch { candidates = []; }
 for (const c of candidates) {
 if (lookupKey(c.word) === probeKey || lookupKey(c.lemma) === probeKey) return c.id;
 }

 return null;
}

module.exports = { resolveVocabId, lookupKey };
