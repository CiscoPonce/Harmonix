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
