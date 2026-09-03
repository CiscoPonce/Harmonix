const assert = require('assert');
const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const auth = require('../auth');
const passwordRoutes = require('./password');

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = auth.verifyAccessToken(token);
    next();
  } catch {
    return res.sendStatus(403);
  }
}

describe('Password routes', () => {
  let server;
  let baseUrl;
  let userId;
  const email = `pw-${nanoid(8)}@harmonix.test`;
  const password = 'old-password-1';

  before(async () => {
    userId = nanoid();
    const hash = await auth.hashPassword(password);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      email,
      hash
    );

    const app = express();
    app.use(express.json());
    app.use('/api/auth', passwordRoutes(authenticateToken));
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after((done) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    server.close(done);
  });

  it('rejects unauthenticated password reset', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'hijacked' }),
    });
    assert.strictEqual(res.status, 410);
    const body = await res.json();
    assert.strictEqual(body.error, 'password_reset_disabled');
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    const stillOld = await auth.comparePassword(password, row.password_hash);
    assert.strictEqual(stillOld, true);
  });

  it('rejects change-password without a token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: password, newPassword: 'new-password-1' }),
    });
    assert.strictEqual(res.status, 401);
  });

  it('changes password when the current password matches', async () => {
    const token = auth.generateAccessToken({ id: userId, email });
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword: password, newPassword: 'new-password-1' }),
    });
    assert.strictEqual(res.status, 200);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    const updated = await auth.comparePassword('new-password-1', row.password_hash);
    assert.strictEqual(updated, true);
  });
});
