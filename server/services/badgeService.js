const db = require('../db');

const BADGE_CHECKS = {
  streak_7: (userId) => {
    const row = db.prepare('SELECT streak_days FROM user_stats WHERE user_id = ?').get(userId);
    return row && row.streak_days >= 7;
  },
  vocab_50: (userId) => {
    const row = db.prepare('SELECT COUNT(*) as count FROM user_vocab_progress WHERE user_id = ? AND reps > 0').get(userId);
    return row.count >= 50;
  },
  quiz_perfect: (userId) => {
    const row = db.prepare("SELECT 1 as found FROM quiz_sessions WHERE user_id = ? AND score = total_questions AND total_questions > 0 LIMIT 1").get(userId);
    return !!row;
  },
  playlist_first: (userId) => {
    const row = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(userId);
    return row.count >= 1;
  },
  daily_word_7: (userId) => {
    const row = db.prepare('SELECT COUNT(DISTINCT date) as count FROM daily_words WHERE user_id = ?').get(userId);
    return row.count >= 7;
  }
};

function checkAndUnlockBadges(userId, options = {}) {
  const unlocked = [];

  const txn = db.transaction(() => {
    const allBadges = db.prepare('SELECT * FROM badges').all();
    const userBadgeIds = db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(userId).map(r => r.badge_id);

    for (const badge of allBadges) {
      if (userBadgeIds.includes(badge.id)) continue;

      const checkFn = BADGE_CHECKS[badge.id];
      if (!checkFn) continue;

      if (checkFn(userId)) {
        db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badge.id);
        unlocked.push({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category
        });
      }
    }
  });

  txn();
  return unlocked;
}

module.exports = { checkAndUnlockBadges };
