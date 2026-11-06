const db = require('../db');

const EVENT_NAMES = new Set([
  'signup',
  'app_open',
  'word_delivered',
  'word_heard',
  'review_done',
  'postcard_created',
  'postcard_viewed',
  'playlist_created',
]);

const insertEvent = db.prepare(`
  INSERT INTO usage_events (user_id, name, platform, props_json)
  VALUES (?, ?, ?, ?)
`);

const appOpenToday = db.prepare(`
  SELECT 1 FROM usage_events
  WHERE user_id = ? AND name = 'app_open' AND created_at >= date('now')
  LIMIT 1
`);

function platformFromRequest(req) {
  const ua = String(req?.headers?.['user-agent'] || '');
  if (ua.startsWith('Dart/')) return 'android';
  if (ua.includes('Mozilla/')) return 'web';
  return 'other';
}

function normalizeSignupSource(raw) {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(value) ? value : null;
}

function sanitizeProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string' && value.length <= 40) out[key] = value;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

function recordEvent(name, { userId = null, req = null, platform = null, props = null } = {}) {
  try {
    if (typeof name !== 'string' || !EVENT_NAMES.has(name)) return false;
    if (name === 'app_open' && userId && appOpenToday.get(userId)) return false;
    const resolvedPlatform = platform || (req ? platformFromRequest(req) : null);
    insertEvent.run(userId || null, name, resolvedPlatform, sanitizeProps(props));
    return true;
  } catch (err) {
    console.warn(`[usage] recordEvent failed: ${err && err.message}`);
    return false;
  }
}

module.exports = {
  EVENT_NAMES,
  platformFromRequest,
  normalizeSignupSource,
  recordEvent,
};
