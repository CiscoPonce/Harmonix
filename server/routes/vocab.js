const express = require('express');
const router = express.Router();
const db = require('../db');
const aiService = require('../services/aiService');
const alignment = require('../utils/alignment');
const { nanoid } = require('nanoid');

router.get('/:songId', async (req, res) => {
  const { songId } = req.params;
  const userCefr = req.user.cefr_level || 'B1';

  try {
    // 1. Check if vocabulary already exists for this song
    const existing = db.prepare(`
      SELECT v.id as vocab_id, v.word, v.lemma, v.definition, v.cefr_level, v.language_code,
             m.line_index, m.char_start
      FROM vocab_items v
      JOIN song_vocab_map m ON v.id = m.vocab_id
      WHERE m.song_id = ?
    `).all(songId);

    if (existing.length > 0) {
      const mapped = existing.filter(i => i.line_index !== -1);
      const unmapped = [];
      
      // Deduplicate items for unmapped list (only if they don't appear anywhere in mapped)
      const allVocabIds = new Set(existing.map(i => i.vocab_id));
      const mappedVocabIds = new Set(mapped.map(i => i.vocab_id));
      
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

      return res.json({ mapped, unmapped });
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
    
    const lyricsText = lyricsData.plainLyrics;
    if (!lyricsText) return res.status(404).json({ error: 'Lyrics content empty' });

    // 3. Extract and Align
    // TODO: Determine language dynamically? For now, default to Spanish as per project context
    const vocab = await aiService.extractVocabulary(lyricsText, 'Spanish', userCefr);
    const vocabWithIds = vocab.map(v => ({ ...v, id: nanoid() }));
    
    const lyricsLines = lyricsText.split('\n').map(line => ({ text: line }));
    const occurrences = alignment.mapVocabToLyrics(vocabWithIds, lyricsLines);

    // 4. Persistence
    const insertVocab = db.prepare('INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?, ?)');
    const insertMap = db.prepare('INSERT INTO song_vocab_map (song_id, vocab_id, line_index, char_start) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction((items, maps) => {
      for (const item of items) {
        insertVocab.run(item.id, item.word, item.lemma || null, item.definition, item.cefr_level, 'es');
        
        const itemMaps = maps.filter(m => m.vocab_id === item.id);
        if (itemMaps.length > 0) {
          for (const map of itemMaps) {
            insertMap.run(songId, item.id, map.line_index, map.char_start);
          }
        } else {
          // Unmapped
          insertMap.run(songId, item.id, -1, -1);
        }
      }
    });

    transaction(vocabWithIds, occurrences);

    // 5. Response
    const finalMapped = [];
    const finalUnmapped = [];

    for (const item of vocabWithIds) {
      const itemOccurrences = occurrences.filter(o => o.vocab_id === item.id);
      if (itemOccurrences.length > 0) {
        itemOccurrences.forEach(occ => {
          finalMapped.push({
            vocab_id: item.id,
            word: item.word,
            lemma: item.lemma,
            definition: item.definition,
            cefr_level: item.cefr_level,
            language_code: 'es',
            line_index: occ.line_index,
            char_start: occ.char_start
          });
        });
      } else {
        finalUnmapped.push({
          vocab_id: item.id,
          word: item.word,
          lemma: item.lemma,
          definition: item.definition,
          cefr_level: item.cefr_level,
          language_code: 'es'
        });
      }
    }

    res.json({ mapped: finalMapped, unmapped: finalUnmapped });

  } catch (err) {
    console.error('Vocab Error:', err);
    res.status(500).json({ error: 'Internal server error during vocab extraction' });
  }
});

module.exports = router;
