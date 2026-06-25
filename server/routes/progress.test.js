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
 expect(res.body.daily_goal).to.equal(1);
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
 expect(res.body.today_words).to.equal(1);
 expect(res.body.today_goal_met).to.equal(true);
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
 });
});
