const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../db');
const quizGenerator = require('../services/quizGenerator');
const srs = require('../services/srsEngine');

router.post('/:songId/start', async (req, res) => {
 const { songId } = req.params;
 const userId = req.user.id;
 const sessionId = `sess-${nanoid(12)}`;

 try {
 const { mapped, unmapped } = await quizGenerator.getSongVocab(songId);
 if (mapped.length + unmapped.length < 3) {
 return res.status(400).json({ error: 'Not enough vocabulary to build a quiz' });
 }

 const lyricsLines = await quizGenerator.getLyricsLines(songId);
 const quiz = await quizGenerator.generateQuiz(songId, mapped, unmapped, lyricsLines);
 const totalQuestions = quiz.questions.length;

 db.prepare(`
 INSERT INTO quiz_sessions (id, user_id, song_id, total_questions)
 VALUES (?, ?, ?, ?)
 `).run(sessionId, userId, songId, totalQuestions);

 res.json({
 session_id: sessionId,
 song_id: songId,
 total_questions: totalQuestions,
 questions: quiz.questions
 });
 } catch (err) {
 console.error('quiz start error:', err);
 res.status(500).json({ error: 'failed_to_start_quiz' });
 }
});

router.post('/:sessionId/answer', (req, res) => {
 const { sessionId } = req.params;
 const { vocab_id, question_id, user_answer, correct_index } = req.body;
 const userId = req.user.id;

 const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
 if (!session) return res.status(404).json({ error: 'session_not_found' });
 if (session.completed_at) return res.status(409).json({ error: 'quiz_already_completed' });

 const isCorrect = user_answer !== undefined && user_answer !== null && (
 typeof correct_index === 'number'
 ? user_answer === correct_index
 : (typeof user_answer === 'string' && typeof correct_index === 'string'
 ? user_answer.toLowerCase() === correct_index.toLowerCase()
 : false)
 );

 // Look up vocab_id robustly: accept either a real nanoid primary key OR
 // the word/lemma (the AI model emits words, sometimes with underscores).
 // If we can't resolve, return null so quiz_answers.vocab_id can be NULL
 // (it is nullable in the schema) rather than trigger FK constraint failure.
 const lookup = require('../services/vocabLookupService');
 const resolvedVocabId = lookup.resolveVocabId(vocab_id);

 const answerId = `ans-${nanoid(10)}`;
 db.prepare(`
 INSERT INTO quiz_answers (id, session_id, vocab_id, user_answer, is_correct)
 VALUES (?, ?, ?, ?, ?)
 `).run(answerId, sessionId, resolvedVocabId, String(user_answer || ''), isCorrect ? 1 : 0);

 res.json({
 answer_id: answerId,
 correct: !!isCorrect,
 correct_answer: correct_index
 });
});

router.post('/:sessionId/finish', (req, res) => {
 const { sessionId } = req.params;
 const userId = req.user.id;

 const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
 if (!session) return res.status(404).json({ error: 'session_not_found' });
 if (session.completed_at) return res.status(409).json({ error: 'already_finished' });

 const answers = db.prepare('SELECT * FROM quiz_answers WHERE session_id = ?').all(sessionId);
 const score = answers.filter(a => a.is_correct).length;
 const total = answers.length || session.total_questions;

 const today = new Date().toISOString().slice(0, 10);
 const updates = db.transaction(() => {
 db.prepare(`UPDATE quiz_sessions SET completed_at = CURRENT_TIMESTAMP, score = ?, total_questions = ? WHERE id = ?`).run(score, total, sessionId);

 const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
 if (!stats) {
 db.prepare('INSERT INTO user_stats (user_id, streak_days, total_xp, last_study_date, daily_goal) VALUES (?, 1, ?, ?, 20)')
 .run(userId, score * 10, today);
 } else {
 const lastDate = stats.last_study_date;
 const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
 let newStreak = stats.streak_days;
 if (lastDate === today) {
 newStreak = stats.streak_days;
 } else if (lastDate === yest) {
 newStreak = stats.streak_days + 1;
 } else {
 newStreak = 1;
 }
 db.prepare(`
 UPDATE user_stats
 SET streak_days = ?, total_xp = total_xp + ?, last_study_date = ?
 WHERE user_id = ?
 `).run(newStreak, score * 10, today, userId);
 }
 });

 updates();

 res.json({ session_id: sessionId, score, total_questions: total });
});

router.get('/:sessionId/result', (req, res) => {
 const { sessionId } = req.params;
 const userId = req.user.id;

 const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
 if (!session) return res.status(404).json({ error: 'session_not_found' });

 const answers = db.prepare(`
 SELECT qa.*, v.word, v.definition, v.cefr_level
 FROM quiz_answers qa
 LEFT JOIN vocab_items v ON qa.vocab_id = v.id
 WHERE qa.session_id = ?
 ORDER BY qa.answered_at ASC
 `).all(sessionId);

 res.json({
 session_id: sessionId,
 song_id: session.song_id,
 score: session.score,
 total_questions: session.total_questions,
 completed_at: session.completed_at,
 answers: answers.map(a => ({
 vocab_id: a.vocab_id,
 word: a.word,
 definition: a.definition,
 user_answer: a.user_answer,
 is_correct: !!a.is_correct,
 answered_at: a.answered_at
 }))
 });
});

module.exports = router;
