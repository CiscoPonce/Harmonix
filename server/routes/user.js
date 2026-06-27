const express = require('express');
const router = express.Router();
const db = require('../db');
const { VALID_LANGUAGE_CODES } = require('../constants/languages');

function rejectInvalidLanguage(res, field, value) {
  if (value && !VALID_LANGUAGE_CODES.includes(value)) {
    res.status(400).json({
      error: `Invalid ${field}. Must be one of: ${VALID_LANGUAGE_CODES.join(', ')}`,
    });
    return true;
  }
  return false;
}

router.get('/preferences', (req, res) => {
  const userId = req.user.id;
  try {
    const user = db.prepare('SELECT native_language, target_language, genre, difficulty, cefr_level FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/preferences', (req, res) => {
  const userId = req.user.id;
  const { native_language, target_language, genre, difficulty, cefr_level } = req.body;

  if (rejectInvalidLanguage(res, 'native_language', native_language)) return;
  if (rejectInvalidLanguage(res, 'target_language', target_language)) return;

  try {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries({ native_language, target_language, genre, difficulty, cefr_level })) {
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
    const user = db.prepare('SELECT native_language, target_language, genre, difficulty, cefr_level FROM users WHERE id = ?').get(userId);
    res.json(user);
  } catch (err) {
    console.error('PATCH /api/user/preferences error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
