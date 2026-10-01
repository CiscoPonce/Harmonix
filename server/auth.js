const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('./db');
require('dotenv').config();

function loadSecret(name) {
  const value = process.env[name];
  const unusable = !value || value.length < 16 || /default_jwt/i.test(value);
  if (process.env.NODE_ENV === 'production' && unusable) {
    console.error(
      `[auth] Refusing to start: ${name} must be set to a strong non-default value`
    );
    process.exit(1);
  }
  if (unusable) {
    return `dev-only-${name}-not-for-production`;
  }
  return value;
}

const JWT_SECRET = loadSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = loadSecret('JWT_REFRESH_SECRET');

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function authCookieOptions(req) {
  const secure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.FORCE_SECURE_COOKIES === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

/** Refresh JWTs are bound to one server-side id. Logout and rotation drop the old id. */
function generateRefreshToken(user, jti) {
  if (!jti) throw new Error('refresh jti required');
  return jwt.sign(
    { id: user.id, email: user.email, jti },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

function issueRefreshSession(user) {
  const jti = nanoid();
  const updated = db.prepare('UPDATE users SET refresh_jti = ? WHERE id = ?').run(jti, user.id);
  if (updated.changes !== 1) {
    const err = new Error('user_not_found');
    err.status = 401;
    throw err;
  }
  return generateRefreshToken(user, jti);
}

function rotateRefreshSession(token) {
  const decoded = verifyRefreshToken(token);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
  if (!user || !decoded.jti || decoded.jti !== user.refresh_jti) {
    const err = new Error('refresh_revoked');
    err.status = 401;
    throw err;
  }
  const jti = nanoid();
  const updated = db.prepare(
    'UPDATE users SET refresh_jti = ? WHERE id = ? AND refresh_jti = ?'
  ).run(jti, user.id, decoded.jti);
  if (updated.changes !== 1) {
    const err = new Error('refresh_revoked');
    err.status = 401;
    throw err;
  }
  return {
    user,
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user, jti),
  };
}

function revokeRefreshSession(token) {
  if (!token) return false;
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return false;
  }
  if (!decoded?.id || !decoded.jti) return false;
  const updated = db.prepare(
    'UPDATE users SET refresh_jti = NULL WHERE id = ? AND refresh_jti = ?'
  ).run(decoded.id, decoded.jti);
  return updated.changes === 1;
}

function revokeUserRefreshSessions(userId) {
  if (!userId) return;
  db.prepare('UPDATE users SET refresh_jti = NULL WHERE id = ?').run(userId);
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authCookieOptions,
  issueRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeUserRefreshSessions,
};
