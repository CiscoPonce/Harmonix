const express = require('express');
const router = express.Router();
const db = require('../db');
const srs = require('../services/srsEngine');
const dailyWordService = require('../services/dailyWordService');
const badgeService = require('../services/badgeService');
const { recordEvent } = require('../services/usageEvents');

router.get('/stats', (req, res) => {
 const userId = req.user.id;
 if (!db.prepare('SELECT 1 AS ok FROM users WHERE id = ?').get(userId)) {
  return res.status(401).json({ error: 'Account no longer exists.' });
 }

 let stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
 if (!stats) {
 db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(userId);
 stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
 }

 const dailyStats = dailyWordService.getDailyWordStats(userId);
 const snap = badgeService.progressSnapshot(userId);
 const badges_unlocked = badgeService.checkAndUnlockBadges(userId);

 res.json({
 streak_days: dailyStats.streak_days,
 total_words: dailyStats.total_words,
 days_learned: snap.days,
 words_reviewed: snap.reviewed,
 total_xp: stats.total_xp,
 last_study_date: stats.last_study_date,
 daily_goal: dailyStats.daily_goal,
 today_words: dailyStats.today_words,
 today_goal_met: dailyStats.today_goal_met,
 badges_unlocked,
 // Legacy field kept for older clients
 today_answers: dailyStats.today_words,
 });
});

router.post('/review', (req, res) => {
 const userId = req.user.id;
 const { results } = req.body;

 if (!Array.isArray(results) || results.length === 0) {
 return res.status(400).json({ error: 'results_array_required' });
 }

 const upsert = db.prepare(`
 INSERT INTO user_vocab_progress (user_id, vocab_id, stability, difficulty, last_review, next_review, reps)
 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
 ON CONFLICT(user_id, vocab_id) DO UPDATE SET
 stability = excluded.stability,
 difficulty = excluded.difficulty,
 last_review = CURRENT_TIMESTAMP,
 next_review = excluded.next_review,
 reps = excluded.reps
 `);

 const txn = db.transaction(() => {
 const updates = [];
 for (const r of results) {
 if (!r.vocab_id) continue;
 const prev = db.prepare('SELECT * FROM user_vocab_progress WHERE user_id = ? AND vocab_id = ?')
 .get(userId, r.vocab_id) || { stability: 0, difficulty: 0, reps: 0 };

 const performance = srs.correctnessToPerformance(!!r.is_correct, r.response_ms || 3000);
 const calc = srs.calculateNextReview(prev, performance);
 const nextDate = srs.nextReviewDate(calc.nextInterval);

 upsert.run(
 userId,
 r.vocab_id,
 calc.newStability,
 calc.newDifficulty,
 nextDate,
 calc.reps
 );

 updates.push({
 vocab_id: r.vocab_id,
 next_review: nextDate,
 stability: calc.newStability,
 reps: calc.reps
 });
 }
 return updates;
 });

 const updated = txn();
 recordEvent('review_done', { userId, req, props: { count: updated.length } });
 res.json({ updated_count: updated.length, updates: updated });
});

router.get('/due', (req, res) => {
 const userId = req.user.id;
 const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

 const due = db.prepare(`
 SELECT uvp.user_id, uvp.vocab_id, uvp.stability, uvp.difficulty, uvp.last_review,
 uvp.next_review, uvp.reps,
 COALESCE(uvp.gloss, v.definition) AS definition,
 uvp.context_sentence, uvp.song_title, uvp.song_artist, uvp.source,
 v.word, v.lemma, v.cefr_level, v.language_code,
 svm.song_id, svm.line_index, svm.char_start
 FROM user_vocab_progress uvp
 JOIN vocab_items v ON uvp.vocab_id = v.id
 LEFT JOIN song_vocab_map svm ON svm.vocab_id = v.id AND svm.line_index <> -1
 WHERE uvp.user_id = ?
 AND (uvp.next_review IS NULL OR DATE(uvp.next_review) <= DATE('now'))
 ORDER BY uvp.next_review ASC
 LIMIT ?
 `).all(userId, limit);

 res.json({ count: due.length, due });
});

module.exports = router;
