const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { nanoid } = require('nanoid');
const db = require('../db');
const auth = require('../auth');
const { PASSWORD_MIN, authLimiter } = require('../middleware/security');
const {
  RESET_PURPOSE,
  EmailVerificationError,
  createClient,
} = require('../services/emailVerificationClient');

const RESET_DISABLED = {
  error: 'password_reset_disabled',
  message:
    'Unauthenticated password reset is no longer available. Sign in and change your password in Settings.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const CHALLENGE_ID_RE = /^[A-Za-z0-9_-]{20,200}$/;
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function challengeLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many codes were requested. Try again in a few minutes.',
        code: 'resend_limited',
      });
    },
  });
}

function confirmLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 15,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many attempts. Try again in a few minutes.',
        code: 'resend_limited',
      });
    },
  });
}

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || value.length > 254 || !EMAIL_RE.test(value)) return null;
  return value;
}

function sendMailFailure(res, err) {
  if (err instanceof EmailVerificationError) {
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    const message = err.code === 'signup_unavailable'
      ? 'Password reset is temporarily unavailable.'
      : err.publicMessage;
    return res.status(err.status).json({ error: message, code: err.code });
  }
  console.error('password reset mail failed');
  return res.status(500).json({ error: 'Internal server error', code: 'internal' });
}

function passwordRoutes(authenticateToken, options = {}) {
  const database = options.db || db;
  const authenticator = options.auth || auth;
  const client = options.client || createClient();
  const findUser = database.prepare('SELECT * FROM users WHERE lower(email) = ?');
  const router = express.Router();

  router.post('/reset-password', authLimiter, (req, res) => {
    res.status(410).json(RESET_DISABLED);
  });

  router.post('/reset-password/challenge', challengeLimit(), async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'invalid_email' });
    }
    const user = findUser.get(email);
    if (!user) {
      await authenticator.comparePassword('unused-reset-timing', DUMMY_PASSWORD_HASH);
      return res.status(200).json({
        challenge_id: nanoid(32),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    }
    try {
      const issued = await client.challenge(email, RESET_PURPOSE);
      return res.status(200).json({
        challenge_id: issued.challengeId,
        expires_at: issued.expiresAt,
      });
    } catch (err) {
      return sendMailFailure(res, err);
    }
  });

  router.post('/reset-password/confirm', confirmLimit(), async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const challengeId = String(req.body?.challenge_id || '').trim();
    const newPassword = String(req.body?.password || '');
    if (!email) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'invalid_email' });
    }
    if (newPassword.length < PASSWORD_MIN || newPassword.length > 128) {
      return res.status(400).json({
        error: `Password must be at least ${PASSWORD_MIN} characters`,
        code: 'invalid_input',
      });
    }
    if (!CODE_RE.test(code) || !CHALLENGE_ID_RE.test(challengeId)) {
      return res.status(400).json({
        error: 'Enter the six-digit code from your email.',
        code: 'invalid_input',
      });
    }
    const user = findUser.get(email);
    if (!user) {
      await authenticator.comparePassword(newPassword, DUMMY_PASSWORD_HASH);
      return res.status(400).json({ error: 'That code is not correct.', code: 'invalid_code' });
    }
    let confirmed;
    try {
      confirmed = await client.verify(challengeId, code);
    } catch (err) {
      return sendMailFailure(res, err);
    }
    if (confirmed.email !== email) {
      return res.status(400).json({
        error: 'This code is no longer valid. Request a new code.',
        code: 'invalid_challenge',
      });
    }
    try {
      const passwordHash = await authenticator.hashPassword(newPassword);
      database.prepare(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(passwordHash, user.id);
      authenticator.revokeUserRefreshSessions(user.id);
      return res.status(200).json({
        message: 'Password updated. Sign in with your new password.',
      });
    } catch (err) {
      console.error('POST /api/auth/reset-password/confirm - error:', err.message);
      return res.status(500).json({ error: 'Internal server error', code: 'internal' });
    }
  });

  router.post('/change-password', authLimiter, authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      });
    }
    if (newPassword.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters` });
    }
    try {
      const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.sendStatus(404);
      const ok = await authenticator.comparePassword(currentPassword, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const passwordHash = await authenticator.hashPassword(newPassword);
      database.prepare(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(passwordHash, user.id);
      authenticator.revokeUserRefreshSessions(user.id);
      const refreshToken = authenticator.issueRefreshSession(user);
      res.cookie('refreshToken', refreshToken, authenticator.authCookieOptions(req));
      res.json({
        message: 'Password updated successfully',
        accessToken: authenticator.generateAccessToken(user),
        refreshToken,
      });
    } catch (err) {
      console.error('POST /api/auth/change-password - error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = passwordRoutes;
