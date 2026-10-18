const assert = require('assert');
const express = require('express');
const db = require('../db');
const adminRouter = require('./admin');

describe('Admin API Routes', () => {
  let app;
  let server;
  let baseUrl;

  before((done) => {
    // Seed test admin user
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, is_admin)
      VALUES ('test-admin-id', 'admin@harmonix.test', 'hash', 1)
    `).run();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { id: 'test-admin-id' };
      next();
    });
    app.use('/api/admin', adminRouter);
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((done) => {
    server.close(done);
  });

  it('GET /api/admin/metrics returns status 200 and expected metrics', async () => {
    const res = await fetch(`${baseUrl}/api/admin/metrics`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(typeof body.total_users, 'number');
    assert.strictEqual(typeof body.spotify_connected_count, 'number');
    assert.strictEqual(typeof body.cards_served_7d, 'number');
    assert.strictEqual(typeof body.people_with_card_7d, 'number');
    assert.strictEqual(typeof body.one_sitting_14d, 'number');
    assert.strictEqual(typeof body.returned_14d, 'number');
  });

  it('GET /api/admin/users reports cards, return visits, and the latest word', async () => {
    const stamp = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ids = ['admin-visit-return', 'admin-visit-once', 'admin-visit-mismatch'];
    const cleanup = () => {
      for (const id of ids) {
        db.prepare('DELETE FROM daily_words WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
      }
    };
    cleanup();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, native_language, target_language, genre, created_at)
      VALUES (?, ?, 'hash', ?, ?, 'pop', ?)
    `);
    const insertCard = db.prepare(`
      INSERT INTO daily_words (user_id, date, word_json, generated_at)
      VALUES (?, ?, ?, ?)
    `);

    insertUser.run('admin-visit-return', 'admin-visit-return@harmonix.test', 'en', 'es', stamp(yesterday));
    insertCard.run(
      'admin-visit-return',
      stamp(yesterday).slice(0, 10),
      JSON.stringify({
        language_code: 'es',
        word: { text: 'amor', translation: 'love' },
        song: { title: 'Amor Prohibido', artist: 'Selena' },
      }),
      stamp(yesterday),
    );
    insertCard.run(
      'admin-visit-return',
      stamp(now).slice(0, 10),
      JSON.stringify({
        language_code: 'es',
        word: { text: 'quiero', translation: 'I want' },
        song: { title: 'Suerte', artist: { name: 'Shakira' } },
      }),
      stamp(now),
    );

    insertUser.run('admin-visit-once', 'admin-visit-once@harmonix.test', 'en', 'es', stamp(now));
    insertCard.run(
      'admin-visit-once',
      stamp(now).slice(0, 10),
      JSON.stringify({
        language_code: 'es',
        word: { text: 'viento', translation: 'wind' },
        song: { title: 'Eres para Mí', artist: 'Julieta Venegas' },
      }),
      stamp(now),
    );

    insertUser.run('admin-visit-mismatch', 'admin-visit-mismatch@harmonix.test', 'en', 'pt', stamp(now));
    insertCard.run(
      'admin-visit-mismatch',
      stamp(now).slice(0, 10),
      JSON.stringify({
        language_code: 'es',
        word: { text: 'volveré', translation: 'I will return' },
        song: { title: 'Y, ¿Si fuera ella?', artist: 'Alejandro Sanz' },
      }),
      stamp(now),
    );

    try {
      const res = await fetch(`${baseUrl}/api/admin/users`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const byEmail = Object.fromEntries(body.users.map((user) => [user.email, user]));

      const returned = byEmail['admin-visit-return@harmonix.test'];
      assert.strictEqual(returned.cards_served, 2);
      assert.strictEqual(returned.days_with_card, 2);
      assert.strictEqual(returned.visit, 'returned');
      assert.strictEqual(returned.native_language, 'en');
      assert.strictEqual(returned.target_language, 'es');
      assert.strictEqual(returned.latest_card.word, 'quiero');
      assert.strictEqual(returned.latest_card.translation, 'I want');
      assert.strictEqual(returned.latest_card.song_title, 'Suerte');
      assert.strictEqual(returned.latest_card.song_artist, 'Shakira');
      assert.strictEqual(returned.off_language_cards, 0);
      assert.ok(returned.last_card_at);

      const once = byEmail['admin-visit-once@harmonix.test'];
      assert.strictEqual(once.cards_served, 1);
      assert.strictEqual(once.visit, 'once');
      assert.strictEqual(once.latest_card.word, 'viento');

      const mismatch = byEmail['admin-visit-mismatch@harmonix.test'];
      assert.strictEqual(mismatch.visit, 'once');
      assert.strictEqual(mismatch.off_language_cards, 1);
      assert.strictEqual(mismatch.latest_card.language_code, 'es');
      assert.strictEqual(mismatch.target_language, 'pt');
    } finally {
      cleanup();
    }
  });

  it('GET /api/admin/users returns user list', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(Array.isArray(body.users), true);
  });

  it('rejects a user whose email matches a founder name but is_admin is 0', async () => {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, is_admin)
      VALUES ('test-not-admin-id', 'cisco-impostor@example.com', 'hash', 0)
    `).run();

    const nonAdminApp = express();
    nonAdminApp.use(express.json());
    nonAdminApp.use((req, res, next) => {
      req.user = { id: 'test-not-admin-id' };
      next();
    });
    nonAdminApp.use('/api/admin', adminRouter);

    const res = await new Promise((resolve, reject) => {
      const s = nonAdminApp.listen(0, async () => {
        try {
          const port = s.address().port;
          const r = await fetch(`http://127.0.0.1:${port}/api/admin/metrics`);
          s.close();
          resolve(r);
        } catch (err) {
          s.close();
          reject(err);
        }
      });
    });
    assert.strictEqual(res.status, 403);
  });
});
