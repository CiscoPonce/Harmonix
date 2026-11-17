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

  it('rejects a new password shorter than 8 characters', async () => {
    const token = auth.generateAccessToken({ id: userId, email });
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword: password, newPassword: 'short1' }),
    });
    assert.strictEqual(res.status, 400);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    const unchanged = await auth.comparePassword(password, row.password_hash);
    assert.strictEqual(unchanged, true);
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

  it('accepts a new password of exactly 8 characters', async () => {
    const token = auth.generateAccessToken({ id: userId, email });
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    const current = await auth.comparePassword('new-password-1', row.password_hash)
      ? 'new-password-1'
      : password;
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword: current, newPassword: 'eightchr' }),
    });
    assert.strictEqual(res.status, 200);
    const next = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    assert.strictEqual(await auth.comparePassword('eightchr', next.password_hash), true);
  });
});

describe('Password reset by email code', () => {
  let server;
  let baseUrl;
  let userId;
  const email = `reset-${nanoid(8)}@harmonix.test`;
  const password = 'old-password-1';
  const calls = [];
  const client = {
    async challenge(address, purpose) {
      calls.push({ op: 'challenge', address, purpose });
      return { challengeId: 'c'.repeat(32), expiresAt: '2026-11-17T22:00:00.000Z' };
    },
    async verify(challengeId, code) {
      calls.push({ op: 'verify', challengeId, code });
      if (code !== '123456') {
        const err = new Error('That code is not correct.');
        err.code = 'invalid_code';
        err.status = 400;
        err.publicMessage = 'That code is not correct.';
        err.name = 'EmailVerificationError';
        throw err;
      }
      return { email: email.toLowerCase() };
    },
  };

  before(async () => {
    userId = nanoid();
    const hash = await auth.hashPassword(password);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, hash);
    const app = express();
    app.use(express.json());
    app.use('/api/auth', passwordRoutes(authenticateToken, { client }));
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

  it('answers the same way when the email has no account and does not send mail', async () => {
    const beforeCalls = calls.length;
    const res = await fetch(`${baseUrl}/api/auth/reset-password/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@harmonix.test' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(typeof body.challenge_id, 'string');
    assert.ok(body.challenge_id.length >= 20);
    assert.strictEqual(calls.length, beforeCalls);
    const confirm = await fetch(`${baseUrl}/api/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'missing@harmonix.test',
        challenge_id: body.challenge_id,
        code: '123456',
        password: 'new-password-1',
      }),
    });
    assert.strictEqual(confirm.status, 400);
    const denied = await confirm.json();
    assert.strictEqual(denied.code, 'invalid_code');
  });

  it('asks the mail service for a reset code and does not return one', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase() }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.challenge_id, 'c'.repeat(32));
    assert.strictEqual(body.code, undefined);
    const last = calls[calls.length - 1];
    assert.deepStrictEqual(last, {
      op: 'challenge',
      address: email.toLowerCase(),
      purpose: 'harmonix-password-reset',
    });
  });

  it('replaces the password, drops other sessions, and does not sign the person in', async () => {
    const refresh = auth.issueRefreshSession({ id: userId, email });
    const res = await fetch(`${baseUrl}/api/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        challenge_id: 'c'.repeat(32),
        code: '123456',
        password: 'new-password-1',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.accessToken, undefined);
    assert.strictEqual(body.refreshToken, undefined);
    const row = db.prepare('SELECT password_hash, refresh_jti FROM users WHERE id = ?').get(userId);
    assert.strictEqual(await auth.comparePassword('new-password-1', row.password_hash), true);
    assert.strictEqual(row.refresh_jti, null);
    assert.throws(() => auth.rotateRefreshSession(refresh));
  });

  it('leaves the password unchanged when the code does not match the address', async () => {
    client.verify = async () => ({ email: 'someone-else@harmonix.test' });
    const res = await fetch(`${baseUrl}/api/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        challenge_id: 'c'.repeat(32),
        code: '123456',
        password: 'another-password',
      }),
    });
    assert.strictEqual(res.status, 400);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    assert.strictEqual(await auth.comparePassword('new-password-1', row.password_hash), true);
    assert.strictEqual(await auth.comparePassword('another-password', row.password_hash), false);
  });
});
