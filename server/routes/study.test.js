const { expect } = require('chai');
const studyRouter = require('./study');
const db = require('../db');

const SCHEMA_VERSION = 2;
const verRow = db.prepare('PRAGMA user_version').get();
if (!verRow || verRow.user_version < SCHEMA_VERSION) {
 const cols = db.prepare("PRAGMA table_info('song_vocab_map')").all().map(c => c.name);
 if (!cols.includes('char_end')) {
 db.exec('ALTER TABLE song_vocab_map ADD COLUMN char_end INTEGER');
 }
 db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const mockRes = () => {
 const r = {};
 r.status = (c) => { r.statusCode = c; return r; };
 r.json = (d) => { r.body = d; return r; };
 return r;
};

describe('Study API Routes', () => {
 let sessionId;

 function ensureUser(id) {
 db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
 }

 beforeEach(() => {
 ensureUser('user-test');
 ensureUser('user-stats');
 db.prepare('DELETE FROM quiz_answers').run();
 db.prepare('DELETE FROM quiz_sessions').run();
 db.prepare('DELETE FROM user_stats').run();
 db.prepare('DELETE FROM user_vocab_progress').run();
 db.prepare('DELETE FROM song_vocab_map').run();
 db.prepare('DELETE FROM vocab_items').run();
 });

 function seedVocab(songId, words) {
 const insertVocab = db.prepare('INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)');
 const insertMap = db.prepare('INSERT INTO song_vocab_map (song_id, vocab_id, line_index, char_start, char_end) VALUES (?, ?, ?, ?, ?)');
 for (let i = 0; i < words.length; i++) {
 const id = `v${i}-${Date.now()}-${Math.random()}`;
 insertVocab.run(id, words[i], `def-${i}`, 'B1', 'es');
 insertMap.run(songId, id, i, 0, words[i].length);
 }
 return db.prepare('SELECT id FROM vocab_items').all().map(r => r.id);
 }

 describe('POST /:songId/start', () => {
 it('returns 400 when there is no vocabulary for the song', async () => {
 const handler = studyRouter.stack.find(s => s.route.path === '/:songId/start').route.stack[0].handle;
 const req = { params: { songId: 'empty-song' }, user: { id: 'user1' } };
 const res = mockRes();
 await handler(req, res);
 expect(res.statusCode).to.equal(400);
 });

 it('creates a quiz session when vocabulary exists', async () => {
 const songId = 'song-with-vocab';
 seedVocab(songId, ['amor', 'corazón', 'bello', 'cantar', 'danza']);

 // Mock the AI service to avoid external HTTP / rate limits during tests.
 const quizGenerator = require('../services/quizGenerator');
 const originalGenerate = quizGenerator.generateQuiz;
 quizGenerator.generateQuiz = async () => ({
 songId,
 questions: [
 { id: 'q1', question_text: 'Hola ______', options: ['a', 'b', 'c', 'd'], correct_index: 0, vocab_id: 'fake1' },
 { id: 'q2', question_text: 'Adiós ______', options: ['a', 'b', 'c', 'd'], correct_index: 1, vocab_id: 'fake2' }
 ],
 generated_at: new Date().toISOString()
 });
 const originalGetLyrics = quizGenerator.getLyricsLines;
 quizGenerator.getLyricsLines = async () => [{ text: 'Hola mundo' }];

 const startHandler = studyRouter.stack.find(s => s.route.path === '/:songId/start').route.stack[0].handle;
 const startReq = { params: { songId }, user: { id: 'user-test' } };
 const startRes = mockRes();

 try {
 await startHandler(startReq, startRes);
 } finally {
 quizGenerator.generateQuiz = originalGenerate;
 quizGenerator.getLyricsLines = originalGetLyrics;
 }

 expect(startRes.body).to.have.property('session_id');
 expect(startRes.body.total_questions).to.equal(2);
 sessionId = startRes.body.session_id;
 const stored = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
 expect(stored).to.not.be.undefined;
 expect(stored.user_id).to.equal('user-test');
 });
 });

 describe('POST /:songId/finish', () => {
 it('updates user_stats with XP and streak', async () => {
 const userId = 'user-stats';
 db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, `${userId}@x.com`, 'x');

 const sessionIdLocal = 'sess-finish-test';
 db.prepare(`INSERT INTO quiz_sessions (id, user_id, song_id, total_questions) VALUES (?, ?, ?, ?)`)
 .run(sessionIdLocal, userId, 'some-song', 5);
 const vocabRow = db.prepare('SELECT id FROM vocab_items LIMIT 1').get();
 const vocabId = vocabRow ? vocabRow.id : (() => {
 db.prepare('INSERT INTO vocab_items (id, word, definition, cefr_level, language_code) VALUES (?, ?, ?, ?, ?)')
 .run('v-finish', 'hola', 'hello', 'A1', 'es');
 return 'v-finish';
 })();

 db.prepare(`INSERT INTO quiz_answers (id, session_id, vocab_id, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)`)
 .run('a-1', sessionIdLocal, vocabId, 'hola', 1);
 db.prepare(`INSERT INTO quiz_answers (id, session_id, vocab_id, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)`)
 .run('a-2', sessionIdLocal, vocabId, 'adiós', 0);

 const finishHandler = studyRouter.stack.find(s => s.route.path === '/:sessionId/finish').route.stack[0].handle;
 const req = { params: { sessionId: sessionIdLocal }, user: { id: userId } };
 const res = mockRes();
 await finishHandler(req, res);

 expect(res.body.score).to.equal(1);
 const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
 expect(stats).to.not.be.undefined;
 expect(stats.total_xp).to.equal(10);
 expect(stats.streak_days).to.equal(1);
 });
 });

  describe('GET /recent', () => {
    it('returns empty array when user has no study sessions', async () => {
      const handler = studyRouter.stack.find(s => s.route.path === '/recent').route.stack[0].handle;
      const req = { user: { id: 'user-test' } };
      const res = mockRes();
      await handler(req, res);
      expect(res.body.recent).to.be.an('array').and.to.be.empty;
    });

    it('returns completed quiz sessions with song metadata', async () => {
      const userId = 'user-test';
      const songId = 'recent-song-123';
      
      db.prepare(`
        INSERT INTO validated_songs (song_id, artist, title, duration, lrc_valid)
        VALUES (?, ?, ?, 120, 1)
      `).run(songId, 'Test Artist', 'Test Song');

      db.prepare(`
        INSERT INTO quiz_sessions (id, user_id, song_id, total_questions, completed_at, score)
        VALUES (?, ?, ?, 5, CURRENT_TIMESTAMP, 4)
      `).run('sess-recent-1', userId, songId);

      const handler = studyRouter.stack.find(s => s.route.path === '/recent').route.stack[0].handle;
      const req = { user: { id: userId } };
      const res = mockRes();
      await handler(req, res);

      expect(res.body.recent).to.be.an('array').with.lengthOf(1);
      expect(res.body.recent[0].session_id).to.equal('sess-recent-1');
      expect(res.body.recent[0].song_title).to.equal('Test Song');
      expect(res.body.recent[0].song_artist).to.equal('Test Artist');
      expect(res.body.recent[0].score).to.equal(4);
    });
  });
});
