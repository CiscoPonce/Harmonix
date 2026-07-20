const crypto = require('crypto');
const db = require('../db');

const ALLOWED_CLIENT_KINDS = new Set(['web', 'android']);
const DEFAULT_TTL_SECONDS = 600;

const insertTxn = db.prepare(`
  INSERT INTO spotify_oauth_transactions (
    state_hash, user_id, pkce_verifier, client_kind, created_at, expires_at, consumed_at
  ) VALUES (?, ?, ?, ?, ?, ?, NULL)
`);

const selectByHash = db.prepare(`
  SELECT * FROM spotify_oauth_transactions WHERE state_hash = ?
`);

const markConsumed = db.prepare(`
  UPDATE spotify_oauth_transactions
  SET consumed_at = ?
  WHERE state_hash = ? AND consumed_at IS NULL
`);

const deleteForUser = db.prepare(`
  DELETE FROM spotify_oauth_transactions WHERE user_id = ? AND consumed_at IS NULL
`);

function hashState(state) {
  return crypto.createHash('sha256').update(state).digest('hex');
}

function generatePkce() {
  // 64 random bytes → ~86 base64url chars (within 43–128)
  const verifier = crypto.randomBytes(64).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function assertClientKind(clientKind) {
  if (!ALLOWED_CLIENT_KINDS.has(clientKind)) {
    throw new Error('clientKind must be web or android');
  }
}

function resolveReturnUrl(clientKind, outcome) {
  assertClientKind(clientKind);
  if (outcome !== 'success' && outcome !== 'error') {
    throw new Error('outcome must be success or error');
  }
  const envKey = clientKind === 'web'
    ? (outcome === 'success' ? 'SPOTIFY_WEB_SUCCESS_URL' : 'SPOTIFY_WEB_ERROR_URL')
    : (outcome === 'success' ? 'SPOTIFY_ANDROID_SUCCESS_URL' : 'SPOTIFY_ANDROID_ERROR_URL');
  const url = process.env[envKey];
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(`${envKey} is not configured`);
  }
  return url;
}

/**
 * Create a one-time OAuth transaction. Returns plaintext state once; only the hash is stored.
 * @param {{ userId: string, clientKind: 'web'|'android', ttlSeconds?: number, now?: Date, returnUrl?: string }} opts
 */
function createOAuthTransaction(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('createOAuthTransaction requires options');
  }
  if (opts.returnUrl !== undefined) {
    throw new Error('caller return URLs are rejected; use configured clientKind destinations');
  }
  const { userId, clientKind } = opts;
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }
  assertClientKind(clientKind);
  // Ensure destinations exist even though we do not persist caller URLs.
  resolveReturnUrl(clientKind, 'success');
  resolveReturnUrl(clientKind, 'error');

  const state = crypto.randomBytes(32).toString('base64url');
  const { verifier, challenge } = generatePkce();
  const now = opts.now instanceof Date ? opts.now : new Date();
  const ttlSeconds = Number.isFinite(opts.ttlSeconds) ? opts.ttlSeconds : DEFAULT_TTL_SECONDS;
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  insertTxn.run(
    hashState(state),
    userId,
    verifier,
    clientKind,
    now.toISOString(),
    expires.toISOString()
  );

  return {
    state,
    verifier,
    challenge,
    clientKind,
    expiresAt: expires.toISOString(),
  };
}

/**
 * Atomically validate and consume a one-time OAuth state transaction.
 * @param {{ state: string, expectedUserId?: string, now?: Date }} opts
 */
function consumeOAuthTransaction(opts) {
  if (!opts || typeof opts.state !== 'string' || opts.state.length === 0) {
    throw new Error('invalid or missing OAuth state');
  }
  const now = opts.now instanceof Date ? opts.now : new Date();
  const stateHash = hashState(opts.state);

  const consumeOnce = db.transaction(() => {
    const row = selectByHash.get(stateHash);
    if (!row) {
      throw new Error('invalid or missing OAuth state');
    }
    if (row.consumed_at) {
      throw new Error('OAuth state already consumed');
    }
    if (new Date(row.expires_at).getTime() <= now.getTime()) {
      throw new Error('OAuth state expired');
    }
    if (opts.expectedUserId && row.user_id !== opts.expectedUserId) {
      throw new Error('OAuth state user binding mismatch');
    }
    const result = markConsumed.run(now.toISOString(), stateHash);
    if (result.changes !== 1) {
      throw new Error('OAuth state already consumed');
    }
    return {
      userId: row.user_id,
      pkceVerifier: row.pkce_verifier,
      clientKind: row.client_kind,
    };
  });

  return consumeOnce();
}

function invalidateOAuthTransactionsForUser(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }
  const result = deleteForUser.run(userId);
  return result.changes;
}

module.exports = {
  generatePkce,
  createOAuthTransaction,
  consumeOAuthTransaction,
  invalidateOAuthTransactionsForUser,
  resolveReturnUrl,
  hashState,
};
