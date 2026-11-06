const { nanoid } = require('nanoid');
const db = require('../db');
const { foldWord } = require('./canonicalKeyService');

function tomorrowUtcIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

const findVocab = db.prepare('SELECT id FROM vocab_items WHERE canonical_key = ?');
const insertVocab = db.prepare(`
  INSERT INTO vocab_items (id, word, lemma, definition, cefr_level, language_code, canonical_key)
  VALUES (@id, @word, @lemma, @definition, @cefr_level, @language_code, @canonical_key)
`);
const upsertProgress = db.prepare(`
  INSERT INTO user_vocab_progress (
    user_id, vocab_id, stability, difficulty, last_review, next_review, reps,
    gloss, context_sentence, song_title, song_artist, source
  ) VALUES (
    @user_id, @vocab_id, 0, 0, NULL, @next_review, 0,
    @gloss, @context_sentence, @song_title, @song_artist, 'daily_word'
  )
  ON CONFLICT(user_id, vocab_id) DO UPDATE SET
    gloss = COALESCE(user_vocab_progress.gloss, excluded.gloss),
    context_sentence = COALESCE(user_vocab_progress.context_sentence, excluded.context_sentence),
    song_title = COALESCE(user_vocab_progress.song_title, excluded.song_title),
    song_artist = COALESCE(user_vocab_progress.song_artist, excluded.song_artist)
`);

function enrollDailyWord(userId, payload) {
  try {
    const word = payload?.word?.text;
    const lang = payload?.language_code;
    if (!userId || typeof word !== 'string' || !word.trim() || word.length > 60 || !lang) {
      return null;
    }

    const key = `${foldWord(word)}|${lang}`;
    let row = findVocab.get(key);
    if (!row) {
      const id = nanoid();
      try {
        insertVocab.run({
          id,
          word: word.trim(),
          lemma: payload.word.lemma || null,
          definition: payload.word.translation || null,
          cefr_level: payload.word.cefr_level || null,
          language_code: lang,
          canonical_key: key,
        });
        row = { id };
      } catch (err) {
        row = findVocab.get(key);
        if (!row) throw err;
      }
    }

    const song = payload.song || {};
    upsertProgress.run({
      user_id: userId,
      vocab_id: row.id,
      next_review: tomorrowUtcIso(),
      gloss: clip(payload.word.translation, 300),
      context_sentence: clip(payload.lyric?.snippet, 300),
      song_title: clip(song.title, 200),
      song_artist: clip(song.artist, 200),
    });
    return row.id;
  } catch (err) {
    console.warn(`[review] enroll failed for ${userId}: ${err && err.message}`);
    return null;
  }
}

module.exports = { enrollDailyWord, tomorrowUtcIso };
