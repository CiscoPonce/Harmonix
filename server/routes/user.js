const express = require('express');
const router = express.Router();
const db = require('../db');
const { VALID_LANGUAGE_CODES } = require('../constants/languages');
const wordQueue = require('../services/wordQueueService');
const dailyWordService = require('../services/dailyWordService');
const spotifyProfile = require('../services/spotifyProfileService');

const VALID_VOICE_GENDERS = ['female', 'male'];
const VALID_GENRES = ['any', 'pop', 'rock', 'hip-hop', 'reggaeton'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const VALID_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function rejectInvalidLanguage(res, field, value) {
  if (value && !VALID_LANGUAGE_CODES.includes(value)) {
    res.status(400).json({
      error: `Invalid ${field}. Must be one of: ${VALID_LANGUAGE_CODES.join(', ')}`,
    });
    return true;
  }
  return false;
}

function preferencesSelect() {
  return 'SELECT native_language, target_language, genre, difficulty, cefr_level, voice_gender, dyslexia_font FROM users WHERE id = ?';
}

router.get('/preferences', (req, res) => {
  const userId = req.user.id;
  try {
    const user = db.prepare(preferencesSelect()).get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.voice_gender) user.voice_gender = 'female';
    user.dyslexia_font = user.dyslexia_font ? 1 : 0;
    res.json(user);
  } catch (err) {
    console.error('GET /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/preferences', (req, res) => {
  const userId = req.user.id;
  const { native_language, target_language, genre, difficulty, cefr_level, voice_gender, dyslexia_font } = req.body;

  if (rejectInvalidLanguage(res, 'native_language', native_language)) return;
  if (rejectInvalidLanguage(res, 'target_language', target_language)) return;
  if (voice_gender !== undefined && !VALID_VOICE_GENDERS.includes(voice_gender)) {
    return res.status(400).json({
      error: `Invalid voice_gender. Must be one of: ${VALID_VOICE_GENDERS.join(', ')}`,
    });
  }
  if (genre !== undefined) {
    const normalizedGenre = String(genre).toLowerCase();
    if (!VALID_GENRES.includes(normalizedGenre)) {
      return res.status(400).json({
        error: `Invalid genre. Must be one of: ${VALID_GENRES.join(', ')}`,
      });
    }
    req.body.genre = normalizedGenre;
  }
  if (difficulty !== undefined) {
    const normalizedDifficulty = String(difficulty).toLowerCase();
    if (!VALID_DIFFICULTIES.includes(normalizedDifficulty)) {
      return res.status(400).json({
        error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
      });
    }
    req.body.difficulty = normalizedDifficulty;
  }
  if (cefr_level !== undefined) {
    const normalizedCefr = String(cefr_level).toUpperCase();
    if (!VALID_CEFR_LEVELS.includes(normalizedCefr)) {
      return res.status(400).json({
        error: `Invalid cefr_level. Must be one of: ${VALID_CEFR_LEVELS.join(', ')}`,
      });
    }
    req.body.cefr_level = normalizedCefr;
  }

  const current = db.prepare(
    'SELECT native_language, target_language, genre, difficulty, cefr_level FROM users WHERE id = ?'
  ).get(userId);
  const nextNative = native_language ?? current?.native_language;
  const nextTarget = target_language ?? current?.target_language;
  if (nextNative && nextTarget && nextNative === nextTarget) {
    return res.status(400).json({
      error: 'Native and target language must be different',
    });
  }

  try {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries({
      native_language,
      target_language,
      genre: req.body.genre,
      difficulty: req.body.difficulty,
      cefr_level: req.body.cefr_level,
      voice_gender,
      dyslexia_font: dyslexia_font === undefined
        ? undefined
        : (dyslexia_font === true || dyslexia_font === 1 || dyslexia_font === '1' ? 1 : 0),
    })) {
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    params.push(userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const genreChanged =
      req.body.genre !== undefined && req.body.genre !== current?.genre;
    const languageChanged =
      target_language !== undefined && target_language !== current?.target_language;
    const nativeChanged =
      native_language !== undefined && native_language !== current?.native_language;
    const difficultyChanged =
      req.body.difficulty !== undefined && req.body.difficulty !== current?.difficulty;
    const cefrChanged =
      req.body.cefr_level !== undefined && req.body.cefr_level !== current?.cefr_level;
    if (languageChanged || genreChanged || nativeChanged || difficultyChanged || cefrChanged) {
      // Stop in-flight refill of the old catalog, drop queued mismatches,
      // and invalidate any in-flight generate/deliver for the previous style.
      dailyWordService.abortRefill(userId);
      dailyWordService.bumpPreferenceEpoch(userId);
      wordQueue.purgeAll(userId);
    }
    const user = db.prepare(preferencesSelect()).get(userId);
    if (user && !user.voice_gender) user.voice_gender = 'female';
    if (user) user.dyslexia_font = user.dyslexia_font ? 1 : 0;
    res.json(user);
  } catch (err) {
    console.error('PATCH /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/available-genres', (req, res) => {
  const aiService = require('../services/aiService');
  const target = req.query.target_language || req.user?.target_language;
  const row = target
    ? null
    : db.prepare('SELECT target_language FROM users WHERE id = ?').get(req.user.id);
  const lang = target || row?.target_language || 'es';
  res.json({ target_language: lang, genres: aiService.genresAvailableForLanguage(lang) });
});

router.get('/spotify-taste', (req, res) => {
  const profile = spotifyProfile.getUserMusicProfile(req.user.id);
  res.json({
    last_synced_at: profile?.last_synced_at || null,
    top_artists: profile?.top_artists || [],
  });
});

router.post('/sync-spotify-profile', async (req, res) => {
  try {
    const result = await spotifyProfile.syncUserProfile(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('POST /api/user/sync-spotify-profile error:', err);
    res.status(500).json({ error: 'profile_sync_failed', message: err.message });
  }
});

module.exports = router;
