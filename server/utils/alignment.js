/**
 * Maps extracted vocabulary items to their locations within the lyrics lines.
 *
 * Strategy: instead of `text.indexOf(word)` (which falsely matches "imán" inside
 * "camino"), we anchor matches to word boundaries. A candidate match at offset N
 * must satisfy: `N === 0` OR `text[N-1]` is NOT an alphanumeric letter, AND
 * `text[N+word.length]` is also NOT an alphanumeric letter. Spanish accented
 * letters (á é í ó ú ñ ü) are treated as alphanumeric by codepoint.
 *
 * Pass 2 (case-insensitive fallback) uses the same boundary check on
 * accent-folded lower-cased versions, so "DESNUDARTE" can still match "desnudarte".
 *
 * Each returned occurrence includes a `char_end` (exclusive) so the frontend
 * can highlight an unambiguous range and avoid recomputing length against
 * potentially composed/uncomposed Unicode strings.
 */
function foldAccents(s) {
  // NFC normalize first so composed/decomposed forms line up, then strip
  // common Spanish diacritics to enable accent-insensitive matching.
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isAlnum(ch) {
  // Treat Unicode letters/digits (incl. accented letters and ñ) as alphanumeric.
  return /[\p{L}\p{N}]/u.test(ch || '');
}

function atWordBoundary(text, idx, endIdx) {
  if (idx < 0 || endIdx > text.length) return false;
  const leftOk  = idx === 0 || !isAlnum(text[idx - 1]);
  const rightOk = endIdx === text.length || !isAlnum(text[endIdx]);
  return leftOk && rightOk;
}

function mapVocabToLyrics(vocabItems, lyricsLines) {
  if (!Array.isArray(vocabItems) || !Array.isArray(lyricsLines)) return [];
  const occurrences = [];

  for (const item of vocabItems) {
    const word = (item.word || '').trim();
    if (!word) continue;
    const vocabId = item.id || word;

    for (let lineIndex = 0; lineIndex < lyricsLines.length; lineIndex++) {
      const line = lyricsLines[lineIndex];
      const text = (line && typeof line.text === 'string') ? line.text : '';
      if (!text) continue;

      // Pass 1: Exact match (case-sensitive), word-boundary anchored.
      let exactHitOnLine = false;
      if (word.length <= text.length) {
        let idx = 0;
        while ((idx = text.indexOf(word, idx)) !== -1) {
          const endIdx = idx + word.length;
          if (atWordBoundary(text, idx, endIdx)) {
            occurrences.push({ vocab_id: vocabId, line_index: lineIndex, char_start: idx, char_end: endIdx });
            exactHitOnLine = true;
          }
          idx = Math.max(endIdx, idx + 1);
        }
      }
      if (exactHitOnLine) continue;

      // Pass 2: Accent- and case-insensitive fallback. Compare accent-folded
      // slices of `text` against the accent-folded `word`, but always verify
      // the *original* character positions land on word boundaries (so we
      // never cross from one word into another).
      const lowerWord = foldAccents(word);
      if (!lowerWord) continue;

      for (let k = 0; k + lowerWord.length <= foldAccents(text).length; k++) {
        if (foldAccents(text.slice(k, k + lowerWord.length)) !== lowerWord) continue;
        // Find the matching span in the ORIGINAL `text` whose accent-folded
        // form equals `lowerWord`. Map every starting position `k` in the
        // folded string to original indices by checking each original slot.
        // Simpler: scan the original text with indexOf on the *exact* word
        // repeatedly — but we already failed that in Pass 1, so there is no
        // exact match in this line (regardless of accents). Thus we MUST
        // fall back to original-character-by-character matching against the
        // accent-folded text. To respect boundaries on the ORIGINAL text, we
        // scan character indices in the original `text` while comparing
        // accent folds.
        const span = findFoldedMatch(text, lowerWord, k);
        if (!span) continue;
        if (atWordBoundary(text, span.start, span.end)) {
          occurrences.push({
            vocab_id: vocabId,
            line_index: lineIndex,
            char_start: span.start,
            char_end: span.end
          });
          exactHitOnLine = true;
          k = span.end - lowerWord.length; // skip ahead; outer loop increments
        }
      }
    }
  }

  return occurrences;
}

/**
 * Locate a match of the accent-folded `target` inside the accent-folded
 * `text` starting at folded-offset `foldedStart`. Returns the span of ORIGINAL
 * indices [start, end) that align with the fold, or null if the alignment
 * would produce different lengths (e.g. "ñ" folds to "n" and shifts the count).
 *
 * The walking is greedy: each original character maps to one folded character,
 * so a folded match of length T denotes exactly T original characters.
 */
function findFoldedMatch(originalText, foldedTarget, foldedStart) {
  if (foldedStart + foldedTarget.length > foldAccents(originalText).length) return null;
  const start = nthOriginalIndex(originalText, foldedStart);
  const end   = nthOriginalIndex(originalText, foldedStart + foldedTarget.length);
  return { start, end };
}

function nthOriginalIndex(text, foldedIndex) {
  // Walk original characters until their accumulated fold-length reaches `foldedIndex`.
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const foldedLen = foldAccents(ch).length; // 1 for most chars, 1 for ñ→n, etc.
    if (count + foldedLen > foldedIndex) return i;
    count += foldedLen;
  }
  return text.length;
}

module.exports = { mapVocabToLyrics, _internal: { atWordBoundary, foldAccents } };
