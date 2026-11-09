const db = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;

function computeBestStreak(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  if (sorted.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prevMs = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
    const nextMs = Date.parse(`${sorted[i]}T00:00:00Z`);
    if (nextMs - prevMs === DAY_MS) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function progressSnapshot(userId) {
  const words = db
    .prepare('SELECT COUNT(*) as count FROM daily_words WHERE user_id = ?')
    .get(userId).count;
  const dateRows = db
    .prepare('SELECT DISTINCT date FROM daily_words WHERE user_id = ? ORDER BY date ASC')
    .all(userId);
  const dates = dateRows.map((r) => r.date);
  const days = dates.length;
  const reviewed = db
    .prepare('SELECT COUNT(*) as count FROM user_vocab_progress WHERE user_id = ? AND reps > 0')
    .get(userId).count;
  const playlists = db
    .prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?')
    .get(userId).count;
  const best_streak = computeBestStreak(dates);

  return {
    words,
    days,
    reviewed,
    playlists,
    best_streak,
  };
}

const BADGE_RULES = {
  streak_7: (snap) => ({
    unlocked: snap.best_streak >= 7,
    progress: snap.best_streak,
    target: 7,
  }),
  daily_word_7: (snap) => ({
    unlocked: snap.days >= 7,
    progress: snap.days,
    target: 7,
  }),
  vocab_50: (snap) => ({
    unlocked: snap.words >= 50,
    progress: snap.words,
    target: 50,
  }),
  review_10: (snap) => ({
    unlocked: snap.reviewed >= 10,
    progress: snap.reviewed,
    target: 10,
  }),
  playlist_first: (snap) => ({
    unlocked: snap.playlists >= 1,
    progress: Math.min(snap.playlists, 1),
    target: 1,
  }),
};

function badgeProgressFor(badgeId, snap) {
  const rule = BADGE_RULES[badgeId];
  if (!rule) return { unlocked: false, progress: 0, target: 1 };
  return rule(snap);
}

function checkAndUnlockBadges(userId) {
  const unlocked = [];

  const txn = db.transaction(() => {
    const snap = progressSnapshot(userId);
    const allBadges = db.prepare('SELECT * FROM badges WHERE id <> ?').all('quiz_perfect');
    const userBadgeIds = db
      .prepare('SELECT badge_id FROM user_badges WHERE user_id = ?')
      .all(userId)
      .map((r) => r.badge_id);

    for (const badge of allBadges) {
      if (userBadgeIds.includes(badge.id)) continue;

      const rule = BADGE_RULES[badge.id];
      if (!rule) continue;

      if (rule(snap).unlocked) {
        db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(
          userId,
          badge.id,
        );
        unlocked.push({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
        });
      }
    }
  });

  txn();
  return unlocked;
}

module.exports = {
  progressSnapshot,
  badgeProgressFor,
  checkAndUnlockBadges,
};
