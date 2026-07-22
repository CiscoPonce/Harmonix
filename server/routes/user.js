const express = require('express');
const router = express.Router();
const db = require('../db');
const { VALID_LANGUAGE_CODES } = require('../constants/languages');
const wordQueue = require('../services/wordQueueService');

const VALID_VOICE_GENDERS = ['female', 'male'];

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
  return 'SELECT native_language, target_language, genre, difficulty, cefr_level, voice_gender FROM users WHERE id = ?';
}

router.get('/preferences', (req, res) => {
  const userId = req.user.id;
  try {
    const user = db.prepare(preferencesSelect()).get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.voice_gender) user.voice_gender = 'female';
    res.json(user);
  } catch (err) {
    console.error('GET /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/preferences', (req, res) => {
  const userId = req.user.id;
  const { native_language, target_language, genre, difficulty, cefr_level, voice_gender } = req.body;

  if (rejectInvalidLanguage(res, 'native_language', native_language)) return;
  if (rejectInvalidLanguage(res, 'target_language', target_language)) return;
  if (voice_gender !== undefined && !VALID_VOICE_GENDERS.includes(voice_gender)) {
    return res.status(400).json({
      error: `Invalid voice_gender. Must be one of: ${VALID_VOICE_GENDERS.join(', ')}`,
    });
  }

  const current = db.prepare(
    'SELECT native_language, target_language FROM users WHERE id = ?'
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
      genre,
      difficulty,
      cefr_level,
      voice_gender,
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
    if (target_language !== undefined && target_language !== current?.target_language) {
      wordQueue.purgeAll(userId);
    }
    const user = db.prepare(preferencesSelect()).get(userId);
    if (user && !user.voice_gender) user.voice_gender = 'female';
    res.json(user);
  } catch (err) {
    console.error('PATCH /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
