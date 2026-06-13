const express = require('express');
const router = express.Router();
const db = require('../db');
const aiService = require('../services/aiService');
const alignment = require('../utils/alignment');
const validation = require('../services/validationService');
const { foldWord } = require('../services/canonicalKeyService');
const { nanoid } = require('nanoid');

// Parse a block of LRCLib-style lyrics (synced or plain) into the same
// `{ text }` line objects that the alignment utility expects. Synced lines
// look like `[00:12.34] lyric text`; plain lines have no timestamp. We strip
// the `[mm:ss(.xx)]` prefix and any blank lines.
function parseLyricLines(lrc) {
  if (!lrc) return [];
  return lrc
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/^\s*\[\d{1,2}:\d{1,2}(?:\.\d+)?\]\s*/, '').trim();
      return stripped ? { text: stripped } : null;
    })
    .filter(Boolean);
}

// Add `char_end` so the frontend can highlight an unambiguous range.
// Forces re-materialization for existing DB rows that pre-date the fix.
const MIGRATED_ROW_FLAG = '__has_char_end__';

router.get('/:songId', async (req, res) => {
 const { songId } = req.params;
 const userCefr = req.user.cefr_level || 'B1';
 const force = req.query.force === 'true';

 try {
 // 1. Check cache; skip when `force=true` or rows pre-date the alignment fix.
 if (!force) {
 const existing = db.prepare(`
 SELECT v.id as vocab_id, v.word, v.lemma, v.definition, v.cefr_level, v.language_code,
 m.line_index, m.char_start, m.char_end
 FROM vocab_items v
 JOIN song_vocab_map m ON v.id = m.vocab_id
 WHERE m.song_id = ?
 `).all(songId);

 const hasCharEnd = existing.some(r => r.char_end !== null && r.char_end !== undefined);
 const snap = db.prepare('SELECT synced_lyrics FROM song_lyrics_snapshot WHERE song_id = ?').get(songId);

 if (existing.length > 0 && hasCharEnd) {
 // Verify every cached mapping against the SAME snapshot the karaoke player
 // rendered. Anything that fails verification is demoted to unmapped.
 const verifiedByVocab = new Map();
 const unmapped = [];

 const allVocabIds = new Set(existing.map(i => i.vocab_id));
 const mappedVocabIds = new Set();

 let snapLines = null;
 if (snap && snap.synced_lyrics) {
 snapLines = parseLyricLines(snap.synced_lyrics);
 }

 for (const row of existing) {
 if (row.line_index === -1) continue;
 if (!snapLines) {
 // No snapshot — accept as-is to preserve prior behavior. This can only
 // happen on rows that pre-date the snapshot migration.
 mappedVocabIds.add(row.vocab_id);
 verifiedByVocab.set(row.vocab_id, row);
 continue;
 }
 const lineText = snapLines[row.line_index];
 if (!lineText) continue; // drifted; drop
 const cs = row.char_start;
 const ce = row.char_end !== null && row.char_end !== undefined ? row.char_end : cs + row.word.length;
 if (lineText.text.substring(cs, ce).toLowerCase() !== row.word.toLowerCase() || !alignment._internal.atWordBoundary(lineText.text, cs, ce)) {
 continue; // stale pointer; drop
 }
 mappedVocabIds.add(row.vocab_id);
 verifiedByVocab.set(row.vocab_id, row);
 }

 for (const vocabId of allVocabIds) {
 if (!mappedVocabIds.has(vocabId)) {
 const item = existing.find(i => i.vocab_id === vocabId);
 unmapped.push({
 vocab_id: item.vocab_id,
 word: item.word,
 lemma: item.lemma,
 definition: item.definition,
 cefr_level: item.cefr_level,
 language_code: item.language_code
 });
 }
 }

 const verifiedMapped = Array.from(verifiedByVocab.values());
 // Include the snapshot so the frontend renders identical bytes that the
 // offsets were verified against.
 return res.json({
 mapped: verifiedMapped,
 unmapped,
 synced_lyrics: snap && snap.synced_lyrics ? snap.synced_lyrics : null,
 });
 }
 }

 // 1b. Pre-flight validation (Phase 6): refuse songs whose LRC is bad
 const validationRecord = validation.getValidation(songId);
 if (validationRecord && validationRecord.lrc_valid === 0) {
 return res.status(409).json({
 error: 'song_quality_too_low',
 issues: 'lyrics_or_audio_validation_failed',
 validation: {
 score: validationRecord.score,
 checked_at: validationRecord.lrc_checked_at
 }
 });
 }

    // 2. Not in DB, fetch from external APIs
    // Get track info
    const trackRes = await fetch(`https://api.deezer.com/track/${songId}`);
    const trackData = await trackRes.json();
    if (trackData.error) return res.status(404).json({ error: 'Track not found' });

    const artist = trackData.artist.name;
    const title = trackData.title;

    // Get lyrics
    const lyricsUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const lyricsRes = await fetch(lyricsUrl);
    if (!lyricsRes.ok) return res.status(404).json({ error: 'Lyrics not found for extraction' });
    const lyricsData = await lyricsRes.json();
    
    const lyricsText = lyricsData.plainLyrics || '';
    const syncedLyricsText = lyricsData.syncedLyrics || '';
    if (!lyricsText && !syncedLyricsText) return res.status(404).json({ error: 'Lyrics content empty' });

    // 3. Extract and Align
    // TODO: Determine language dynamically? For now, default to Spanish as per project context
    const vocab = await aiService.extractVocabulary(lyricsText, 'Spanish', userCefr);
    const vocabWithIds = vocab.map(v => ({ ...v, id: nanoid() }));

 // Align against the SAME lines the frontend renders. The karaoke player uses
 // `syncedLyrics` (timestamps + text); preferring plainLyrics for alignment
 // causes a line-index mismatch where vocab pointers land on the wrong lyric.
 // Fall back to plainLyrics only when synced is missing.
 const parsedSynced = parseLyricLines(syncedLyricsText);
 const parsedPlain = lyricsText.split('\n').map(line => line.trim()).filter(Boolean).map(line => ({ text: line }));
 const lyricsLinesForAlignment = parsedSynced.length > 0 ? parsedSynced : parsedPlain;
 const occurrences = alignment.mapVocabToLyrics(vocabWithIds, lyricsLinesForAlignment);

    // 4. Persistence (deduplicated by canonicalized word + language)
    const lookupVocab = db.prepare(
      `SELECT id, word, lemma, definition, cefr_level FROM vocab_items WHERE canonical_key = ? AND language_code = ? LIMIT 1`
    );
    const insertVocab = db.prepare(
      `INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code, canonical_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMap = db.prepare(
      `INSERT OR IGNORE INTO song_vocab_map (song_id, vocab_id, line_index, char_start, char_end) VALUES (?, ?, ?, ?, ?)`
    );
    const upsertSnapshot = db.prepare(`
      INSERT INTO song_lyrics_snapshot (song_id, synced_lyrics, plain_lyrics, fetched_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(song_id) DO UPDATE SET
        synced_lyrics = excluded.synced_lyrics,
        plain_lyrics = excluded.plain_lyrics,
        fetched_at = CURRENT_TIMESTAMP
    `);

    // The mapper returned occurrences keyed by the AI's `vocab_id` (a nanoid
    // per extracted item). Re-key to a stable per-word id so the same word —
    // whether extracted once or twice — lives in exactly one vocab_items row.
    const wordToExistingId = new Map(); // canonical_key -> vocab_items.id
    const finalVocabById = new Map();   // vocab_items.id -> { word, lemma, ... }

    const transaction = db.transaction((items, maps, snapSynced, snapPlain) => {
      for (const item of items) {
        const languageCode = item.language_code || 'es';
        const canonicalKey = `${foldWord(item.word)}|${languageCode}`;
        let vocabId = wordToExistingId.get(canonicalKey);
        let row;
        if (vocabId) {
          // Already resolved in this run — duplicate AI extraction.
          row = finalVocabById.get(vocabId);
        } else {
          const existing = lookupVocab.get(canonicalKey, languageCode);
          if (existing) {
            vocabId = existing.id;
            row = existing;
          } else {
            vocabId = nanoid();
            insertVocab.run(vocabId, item.word, item.lemma || null, item.definition, item.cefr_level, languageCode, canonicalKey);
            row = { id: vocabId, word: item.word, lemma: item.lemma, definition: item.definition, cefr_level: item.cefr_level, language_code: languageCode };
          }
          wordToExistingId.set(canonicalKey, vocabId);
          finalVocabById.set(vocabId, row);
        }

        // Replace the mapper's nanoid with the resolved vocab_id.
        const itemMaps = maps.filter(m => m.vocab_id === item.id);
        if (itemMaps.length > 0) {
          for (const map of itemMaps) {
            insertMap.run(songId, vocabId, map.line_index, map.char_start, map.char_end);
          }
        } else {
          insertMap.run(songId, vocabId, -1, -1, -1);
        }
      }
      upsertSnapshot.run(songId, snapSynced, snapPlain);
    });

    transaction(vocabWithIds, occurrences, syncedLyricsText, lyricsText);

    // 5. Response — rebuild mapped/unmapped from the resolved vocab ids so
    // every word appears AT MOST ONCE in the user's view of the song.
    const finalMapped = [];
    const finalUnmapped = [];
    const seenKey = new Set();

    for (const item of vocabWithIds) {
      const languageCode = item.language_code || 'es';
      const canonicalKey = `${foldWord(item.word)}|${languageCode}`;
      if (seenKey.has(canonicalKey)) continue; // collapse duplicated AI rows
      seenKey.add(canonicalKey);

      const vocabId = wordToExistingId.get(canonicalKey);
      if (!vocabId) continue;
      const resolved = finalVocabById.get(vocabId);

      const itemOccurrences = occurrences
        .filter(o => o.vocab_id === item.id)
        .map(o => ({ ...o, vocab_id: vocabId }));

      if (itemOccurrences.length > 0) {
        // Pick the FIRST occurrence for highlighting — the user sees the word
        // anchored at one place in the song. Additional occurrences at other
        // line_index values stay in `all_occurrences` for navigation.
        const occ = itemOccurrences[0];
        finalMapped.push({
          vocab_id: vocabId,
          word: resolved.word,
          lemma: resolved.lemma,
          definition: resolved.definition,
          cefr_level: resolved.cefr_level,
          language_code: resolved.language_code,
          line_index: occ.line_index,
          char_start: occ.char_start,
          char_end: occ.char_end,
          all_occurrences: itemOccurrences.map(o => ({
            line_index: o.line_index,
            char_start: o.char_start,
            char_end: o.char_end
          }))
        });
      } else {
        finalUnmapped.push({
          vocab_id: vocabId,
          word: resolved.word,
          lemma: resolved.lemma,
          definition: resolved.definition,
          cefr_level: resolved.cefr_level,
          language_code: resolved.language_code
        });
      }
    }

    res.json({ mapped: finalMapped, unmapped: finalUnmapped, synced_lyrics: syncedLyricsText });

  } catch (err) {
    console.error('Vocab Error:', err);
    res.status(500).json({ error: 'Internal server error during vocab extraction' });
  }
});

module.exports = router;
