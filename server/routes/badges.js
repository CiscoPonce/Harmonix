const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const userId = req.user.id;
  try {
    const badges = db.prepare(`
      SELECT b.*,
             CASE WHEN ub.user_id IS NOT NULL THEN 1 ELSE 0 END as unlocked,
             ub.unlocked_at
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
      ORDER BY b.category, b.id
    `).all(userId);
    res.json({ badges });
  } catch (err) {
    console.error('GET /api/badges error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
