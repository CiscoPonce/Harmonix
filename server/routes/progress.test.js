const { expect } = require('chai');
const progressRouter = require('./progress');
const db = require('../db');

const mockRes = () => {
 const r = {};
 r.status = (c) => { r.statusCode = c; return r; };
 r.json = (d) => { r.body = d; return r; };
 return r;
};

describe('Progress API Routes', () => {
 function ensureUser(id) {
 db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
 }

 beforeEach(() => {
 ensureUser('fresh-user');
 ensureUser('u-progress');
 ensureUser('user-due');
 ensureUser('stats-daily');
 db.prepare('DELETE FROM daily_words').run();
 db.prepare('DELETE FROM quiz_answers').run();
 db.prepare('DELETE FROM user_vocab_progress').run();
 db.prepare('DELETE FROM song_vocab_map').run();
 db.prepare('DELETE FROM quiz_sessions').run();
 db.prepare('DELETE FROM user_stats').run();
 db.prepare('DELETE FROM vocab_items').run();
 });

 describe('GET /stats', () => {
 it('creates a stats row on first request and returns daily word progress', async () => {
 const handler = progressRouter.stack.find(s => s.route.path === '/stats').route.stack[0].handle;
 const req = { user: { id: 'fresh-user' } };
 const res = mockRes();
 await handler(req, res);
 expect(res.body).to.have.property('streak_days');
 expect(res.body).to.have.property('total_words');
 expect(res.body.daily_goal).to.equal(10);
 expect(res.body.today_words).to.equal(0);
 expect(res.body.today_goal_met).to.equal(false);
 });

 it('reflects daily word streak and today completion', async () => {
 const dayOffset = (n) => {
 const d = new Date();
 d.setDate(d.getDate() - n);
 return d.toISOString().slice(0, 10);
 };

 db.prepare(`
 INSERT INTO daily_words (user_id, date, word_json)
 VALUES (?, ?, ?), (?, ?, ?)
 `).run(
 'stats-daily', dayOffset(1), JSON.stringify({ date: dayOffset(1), word: { text: 'ayer' } }),
 'stats-daily', dayOffset(0), JSON.stringify({ date: dayOffset(0), word: { text: 'hoy' } })
 );

 const handler = progressRouter.stack.find(s => s.route.path === '/stats').route.stack[0].handle;
 const req = { user: { id: 'stats-daily' } };
 const res = mockRes();
 await handler(req, res);

 expect(res.body.streak_days).to.equal(2);
 expect(res.body.total_words).to.equal(2);
 expect(res.body.days_learned).to.equal(2);
 expect(res.body.words_reviewed).to.equal(0);
 expect(res.body.today_words).to.equal(1);
 expect(res.body.today_goal_met).to.equal(true);
 });

 it('does not recreate stats after the account is deleted', async () => {
 const userId = 'stats-deleted';
 ensureUser(userId);
 db.prepare('DELETE FROM users WHERE id = ?').run(userId);
 const handler = progressRouter.stack.find(s => s.route.path === '/stats').route.stack[0].handle;
 const res = mockRes();
 await handler({ user: { id: userId } }, res);
 expect(res.statusCode).to.equal(401);
 const row = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get(userId);
 expect(row).to.equal(undefined);
 });
 });

 describe('POST /review', () => {
 it('requires a results array', async () => {
 const handler = progressRouter.stack.find(s => s.route.path === '/review').route.stack[0].handle;
 const req = { body: {}, user: { id: 'u1' } };
 const res = mockRes();
 await handler(req, res);
 expect(res.statusCode).to.equal(400);
 });

 it('writes progress rows for each vocab result', async () => {
 db.prepare(`INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)`)
 .run('vp1', 'hola', 'hello', 'A1', 'es');
 db.prepare(`INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)`)
 .run('vp2', 'adiós', 'goodbye', 'A1', 'es');

 const handler = progressRouter.stack.find(s => s.route.path === '/review').route.stack[0].handle;
 const req = {
 body: {
 results: [
 { vocab_id: 'vp1', is_correct: true, response_ms: 1200 },
 { vocab_id: 'vp2', is_correct: false, response_ms: 6000 }
 ]
 },
 user: { id: 'u-progress' }
 };
 const res = mockRes();
 await handler(req, res);
 expect(res.body.updated_count).to.equal(2);
 const rows = db.prepare('SELECT * FROM user_vocab_progress WHERE user_id = ?').all('u-progress');
 expect(rows).to.have.lengthOf(2);
 const event = db.prepare("SELECT * FROM usage_events WHERE user_id = ? AND name = 'review_done'").get('u-progress');
 expect(event).to.exist;
 expect(JSON.parse(event.props_json).count).to.equal(2);
 });
 });

 describe('GET /due', () => {
 it('returns words whose next_review is today or earlier', async () => {
 db.prepare(`INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)`)
 .run('vd1', 'due-now', 'def', 'A1', 'es');
 db.prepare(`INSERT INTO user_vocab_progress (user_id, vocab_id, stability, difficulty, next_review, reps) VALUES (?, ?, 1, 1, DATE('now', '-1 day'), 1)`)
 .run('user-due', 'vd1');

 const handler = progressRouter.stack.find(s => s.route.path === '/due').route.stack[0].handle;
 const req = { query: {}, user: { id: 'user-due' } };
 const res = mockRes();
 await handler(req, res);
 expect(res.body.count).to.equal(1);
 expect(res.body.due[0].word).to.equal('due-now');
 });

 it('returns the learner gloss and lyric line', async () => {
 db.prepare(`INSERT INTO vocab_items (id, word, definition, language_code, canonical_key) VALUES (?, ?, ?, ?, ?)`)
 .run('vg1', 'amor', 'shared definition', 'es', 'amor|es');
 db.prepare(`
 INSERT INTO user_vocab_progress (
 user_id, vocab_id, next_review, gloss, context_sentence, song_title, song_artist, source
 ) VALUES (?, ?, DATE('now', '-1 day'), ?, ?, ?, ?, 'daily_word')
 `).run('user-due', 'vg1', 'love', 'el amor', 'Song', 'Artist');

 const handler = progressRouter.stack.find(s => s.route.path === '/due').route.stack[0].handle;
 const res = mockRes();
 await handler({ query: {}, user: { id: 'user-due' } }, res);
 expect(res.body.due[0].definition).to.equal('love');
 expect(res.body.due[0].context_sentence).to.equal('el amor');
 expect(res.body.due[0].song_title).to.equal('Song');
 });

 it('deduplicates vocab items that appear in multiple song_vocab_map rows', async () => {
 db.prepare(`INSERT INTO vocab_items (id, word, definition, language_code, canonical_key) VALUES (?, ?, ?, ?, ?)`)
 .run('v-dup', 'fuego', 'fire', 'es', 'fuego|es');
 db.prepare(`INSERT INTO song_vocab_map (song_id, vocab_id, line_index, char_start) VALUES (?, ?, ?, ?), (?, ?, ?, ?)`)
 .run('s-dup', 'v-dup', 0, 0, 's-dup', 'v-dup', 2, 5);
 db.prepare(`
 INSERT INTO user_vocab_progress (user_id, vocab_id, next_review, gloss, source)
 VALUES (?, ?, DATE('now', '-1 day'), ?, 'daily_word')
 `).run('user-due', 'v-dup', 'fire');

 const handler = progressRouter.stack.find(s => s.route.path === '/due').route.stack[0].handle;
 const res = mockRes();
 await handler({ query: {}, user: { id: 'user-due' } }, res);
 expect(res.body.count).to.equal(1);
 expect(res.body.due).to.have.lengthOf(1);
 expect(res.body.due[0].vocab_id).to.equal('v-dup');
 });
 });

 describe('GET /stats badges', () => {
 it('unlocks the seven-day badge once', async () => {
 const userId = 'badge-seven';
 db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'badge@test.com', 'x');
 db.prepare('DELETE FROM user_badges WHERE user_id = ?').run(userId);
 const insert = db.prepare('INSERT INTO daily_words (user_id, date, word_json) VALUES (?, ?, ?)');
 for (let i = 0; i < 7; i += 1) {
 const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
 insert.run(userId, day, '{}');
 }
 const handler = progressRouter.stack.find(s => s.route.path === '/stats').route.stack[0].handle;
 const first = mockRes();
 await handler({ user: { id: userId } }, first);
 expect(first.body.badges_unlocked.map((badge) => badge.id)).to.include('daily_word_7');
 const second = mockRes();
 await handler({ user: { id: userId } }, second);
 expect(second.body.badges_unlocked).to.deep.equal([]);
 });
 });
});
