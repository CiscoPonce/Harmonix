const assert = require('assert');
const express = require('express');
const jpeg = require('jpeg-js');
const db = require('../db');
const auth = require('../auth');
const profileRouter = require('./profile');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  let user;
  try {
    user = auth.verifyAccessToken(token);
  } catch {
    return res.sendStatus(403);
  }
  if (!auth.userStillExists(user.id)) return res.sendStatus(401);
  req.user = user;
  return next();
}

describe('profile routes', () => {
  let server;
  let baseUrl;
  let token1;
  let token2;
  const userIds = ['pr-user-1', 'pr-user-2'];

  before(async () => {
    const app = express();
    app.use(express.json({ limit: '256kb' }));
    app.use('/api/user', authenticateToken, profileRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    for (const id of userIds) {
      db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
        id,
        `${id}@example.com`,
        'hash',
      );
    }
    token1 = auth.generateAccessToken({ id: 'pr-user-1', email: 'pr-user-1@example.com' });
    token2 = auth.generateAccessToken({ id: 'pr-user-2', email: 'pr-user-2@example.com' });
  });

  after((done) => {
    for (const id of userIds) {
      db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
    server.close(done);
  });

  it('rejects requests without auth with 401', async () => {
    const patchRes = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ada_1' }),
    });
    assert.strictEqual(patchRes.status, 401);

    const getAvatarRes = await fetch(`${baseUrl}/api/user/avatar`);
    assert.strictEqual(getAvatarRes.status, 401);
  });

  it('patches username Ada_1 and returns lowercase ada_1 in JSON', async () => {
    const res = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ username: 'Ada_1' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, {
      username: 'ada_1',
      bio: null,
      has_avatar: false,
    });
    const row = db.prepare('SELECT username FROM users WHERE id = ?').get('pr-user-1');
    assert.strictEqual(row.username, 'ada_1');
  });

  it('returns 409 when a second user patches the same username and leaves their row unchanged', async () => {
    await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ username: 'ada_1' }),
    });

    db.prepare('UPDATE users SET username = ? WHERE id = ?').run('second_user', 'pr-user-2');

    const res = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token2}`,
      },
      body: JSON.stringify({ username: 'ADA_1' }),
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.code, 'username_taken');
    assert.strictEqual(body.error, 'That username is taken.');

    const row = db.prepare('SELECT username FROM users WHERE id = ?').get('pr-user-2');
    assert.strictEqual(row.username, 'second_user');
  });

  it('rejects ab and a 161-character bio without writing', async () => {
    const shortRes = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ username: 'ab' }),
    });
    assert.strictEqual(shortRes.status, 400);
    const shortBody = await shortRes.json();
    assert.strictEqual(shortBody.code, 'username_invalid');

    const longBioRes = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ bio: 'x'.repeat(161) }),
    });
    assert.strictEqual(longBioRes.status, 400);
    const longBioBody = await longBioRes.json();
    assert.strictEqual(longBioBody.code, 'bio_invalid');

    const row = db.prepare('SELECT username, bio FROM users WHERE id = ?').get('pr-user-1');
    assert.strictEqual(row.username, null);
    assert.strictEqual(row.bio, null);
  });

  it('returns 400 for PATCH /profile with {} and preserves existing bio', async () => {
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run('Keep this bio', 'pr-user-1');

    const res = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'empty_profile');

    const row = db.prepare('SELECT bio FROM users WHERE id = ?').get('pr-user-1');
    assert.strictEqual(row.bio, 'Keep this bio');
  });

  it('PUTs a 1x1 JPEG, GETs those bytes with image/jpeg, and DELETEs it', async () => {
    const encoded = jpeg.encode(
      { data: Buffer.from([12, 34, 56, 255]), width: 1, height: 1 },
      85,
    ).data;

    const putRes = await fetch(`${baseUrl}/api/user/avatar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${token1}`,
      },
      body: encoded,
    });
    assert.strictEqual(putRes.status, 204);

    const getRes = await fetch(`${baseUrl}/api/user/avatar`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.headers.get('content-type'), 'image/jpeg');
    assert.strictEqual(getRes.headers.get('x-content-type-options'), 'nosniff');
    const received = Buffer.from(await getRes.arrayBuffer());
    assert.strictEqual(Buffer.compare(received, encoded), 0);

    const delRes = await fetch(`${baseUrl}/api/user/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(delRes.status, 204);

    const getAfterDel = await fetch(`${baseUrl}/api/user/avatar`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(getAfterDel.status, 404);
  });

  it('rejects PUT of <html> with 400 and leaves GET at 404', async () => {
    const putRes = await fetch(`${baseUrl}/api/user/avatar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${token1}`,
      },
      body: Buffer.from('<html><body>nope</body></html>', 'utf8'),
    });
    assert.strictEqual(putRes.status, 400);
    const body = await putRes.json();
    assert.strictEqual(body.code, 'avatar_invalid');

    const getRes = await fetch(`${baseUrl}/api/user/avatar`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(getRes.status, 404);
  });

  it('DELETE /api/user/account deletes the user and returns 204, then 404 on repeat', async () => {
    const delRes = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(delRes.status, 204);

    const row = db.prepare('SELECT id FROM users WHERE id = ?').get('pr-user-1');
    assert.strictEqual(row, undefined);

    const repeatRes = await fetch(`${baseUrl}/api/user/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.strictEqual(repeatRes.status, 401);

    const stats = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get('pr-user-1');
    assert.strictEqual(stats, undefined);
  });
});
