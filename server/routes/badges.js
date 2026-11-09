const express = require('express');
const router = express.Router();
const db = require('../db');
const badgeService = require('../services/badgeService');

router.get('/', (req, res) => {
  const userId = req.user.id;
  try {
    badgeService.checkAndUnlockBadges(userId);
    const snap = badgeService.progressSnapshot(userId);
    const rows = db
      .prepare(
        `
      SELECT b.*,
             CASE WHEN ub.user_id IS NOT NULL THEN 1 ELSE 0 END as unlocked,
             ub.unlocked_at
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
      WHERE b.id <> 'quiz_perfect'
      ORDER BY b.category, b.id
    `,
      )
      .all(userId);

    const badges = rows.map((row) => {
      const ruleProgress = badgeService.badgeProgressFor(row.id, snap);
      return {
        ...row,
        progress: ruleProgress.progress,
        target: ruleProgress.target,
      };
    });

    res.json({ badges });
  } catch (err) {
    console.error('GET /api/badges error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
