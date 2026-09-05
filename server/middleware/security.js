require('dotenv').config();
const { rateLimit } = require('express-rate-limit');

/**
 * Browser origins allowed to call the API with credentials.
 *
 * Production is same-origin (Express proxies Next), so the only cross-origin
 * callers are local dev servers and the legacy tunnel. Flutter uses plain HTTP
 * without an Origin header and is unaffected. Extra origins: CORS_ORIGINS=a,b.
 */
function buildAllowedOrigins() {
  const fromEnv = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  const dev = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3009', 'http://127.0.0.1:3009'];
  return new Set([base, ...fromEnv, ...dev].filter(Boolean));
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

function corsOrigin(origin, callback) {
  // Same-origin, curl, and native apps send no Origin header.
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
  // Capacitor / WebView shells (not shipped, but harmless to keep working).
  if (/^(capacitor|ionic):\/\/localhost$/.test(origin)) return callback(null, true);
  return callback(null, false);
}

/** Static hardening headers; CSP is left to a later, tested rollout. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (https) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

const rateLimitJson = (code, message) => (req, res) => {
  res.status(429).json({ error: code, message });
};

const testMode = process.env.NODE_ENV === 'test';

/** Login / register / refresh: brute-force and enumeration protection. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testMode ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitJson('too_many_attempts', 'Too many attempts. Try again in a few minutes.'),
});

/** Public TTS costs real CPU; keep anonymous callers honest. */
const pronounceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testMode ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitJson('rate_limited', 'Too many pronunciation requests. Slow down.'),
});

/** Public Deezer / LRCLib proxies are unauthenticated: cap per IP. */
const publicProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testMode ? 1000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitJson('rate_limited', 'Too many requests. Slow down.'),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function validateRegistration(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  if (!e || !p) return { error: 'Email and password are required' };
  if (e.length > 254 || !EMAIL_RE.test(e)) return { error: 'Enter a valid email address' };
  if (p.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (p.length > PASSWORD_MAX) return { error: 'Password is too long' };
  return { email: e, password: p };
}

module.exports = {
  ALLOWED_ORIGINS,
  corsOrigin,
  securityHeaders,
  authLimiter,
  pronounceLimiter,
  publicProxyLimiter,
  validateRegistration,
  PASSWORD_MIN,
};
