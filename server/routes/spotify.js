const express = require('express');
const spotifyService = require('../services/spotifyService');
const oauth = require('../services/spotifyOAuthService');
const db = require('../db');

const protectedRouter = express.Router();
const callbackRouter = express.Router();

const SENSITIVE_RE =
  /(access_token|refresh_token|code_verifier|code=|state=|Bearer\s+[A-Za-z0-9._~+/-]+=*)/i;

function safeLog(label, err) {
  const msg = err && err.message ? String(err.message) : String(err);
  const redacted = SENSITIVE_RE.test(msg) ? '[redacted]' : msg;
  console.error(`${label}: ${redacted}`);
}

function requireUser(req, res) {
  if (!req.user || !req.user.id) {
    res.sendStatus(401);
    return null;
  }
  return req.user.id;
}

function mapError(err, res) {
  const code = err && err.code;
  if (code === 'spotify_disconnected') {
    return res.status(409).json({ error: 'spotify_disconnected', reason: null });
  }
  if (code === 'reconnect_required') {
    return res.status(409).json({
      error: 'reconnect_required',
      reason: err.reason || 'reconnect_required',
    });
  }
  if (code === 'spotify_rate_limited') {
    return res.status(429).json({
      error: 'spotify_rate_limited',
      reason: 'rate_limited',
      retry_after: err.retryAfter ?? null,
    });
  }
  if (code === 'spotify_unavailable') {
    return res.status(503).json({ error: 'spotify_unavailable', reason: 'unavailable' });
  }
  if (code === 'spotify_misconfigured') {
    return res.status(503).json({ error: 'provider_error', reason: 'misconfigured' });
  }
  if (code === 'invalid_request') {
    return res.status(400).json({ error: 'invalid_request', reason: err.message });
  }
  return res.status(502).json({ error: 'provider_error', reason: 'provider_error' });
}

protectedRouter.get('/status', (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const status = spotifyService.getConnectionStatus(userId);
    // Safe allowlist — never include tokens or secrets.
    res.json({
      status: status.status,
      display_name: status.display_name,
      reason: status.reason,
    });
  } catch (err) {
    safeLog('GET /api/spotify/status', err);
    mapError(err, res);
  }
});

protectedRouter.post('/auth/start', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const client = req.body && req.body.client;
  if (client !== 'web' && client !== 'android') {
    return res.status(400).json({ error: 'invalid_request', reason: 'client must be web or android' });
  }
  if (req.body && req.body.returnUrl !== undefined) {
    return res.status(400).json({ error: 'invalid_request', reason: 'returnUrl is not allowed' });
  }
  try {
    const { authorizationUrl } = await spotifyService.startAuthorization(userId, client);
    res.json({ authorization_url: authorizationUrl });
  } catch (err) {
    safeLog('POST /api/spotify/auth/start', err);
    mapError(err, res);
  }
});

protectedRouter.delete('/connection', (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const result = spotifyService.disconnectUser(userId);
    res.json(result);
  } catch (err) {
    safeLog('DELETE /api/spotify/connection', err);
    mapError(err, res);
  }
});

protectedRouter.get('/playlists', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const playlists = await spotifyService.syncUserPlaylists(userId);
    res.json({ playlists });
  } catch (err) {
    safeLog('GET /api/spotify/playlists', err);
    // On sync failure, do not prune; still may return stored snapshot for offline UX later.
    // For this plan, surface the provider error while preserving prior rows.
    mapError(err, res);
  }
});

protectedRouter.get('/playlists/:id', async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = req.params.id;
  // Namespace guard: Harmonix local playlist IDs must never be treated as Spotify IDs.
  const localHit = db.prepare('SELECT id FROM playlists WHERE id = ?').get(id);
  if (localHit) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  try {
    const detail = await spotifyService.getPlaylistDetail(userId, id);
    res.json(detail);
  } catch (err) {
    if (err && (err.code === 'not_found' || err.code === 'invalid_request')) {
      // Non-disclosing — invalid IDs and missing/cross-user rows look the same.
      return res.status(404).json({ error: 'Playlist not found' });
    }
    safeLog('GET /api/spotify/playlists/:id', err);
    mapError(err, res);
  }
});

callbackRouter.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  let clientKind = 'web';
  try {
    if (oauthError || !code || !state || typeof state !== 'string' || typeof code !== 'string') {
      // Attempt to resolve client kind from a non-consuming peek is unsafe; default web error URL.
      try {
        const url = oauth.resolveReturnUrl(clientKind, 'error');
        return res.redirect(302, url);
      } catch {
        return res.status(400).send('Spotify authorization failed');
      }
    }

    // Consume state before token exchange (replay-safe).
    const result = await spotifyService.completeAuthorization({ code, state });
    clientKind = result.clientKind;
    return res.redirect(302, result.successUrl);
  } catch (err) {
    safeLog('GET /api/spotify/oauth/callback', err);
    try {
      // Prefer android error URL when we can recover client kind from a prior partial consume —
      // consume already happened only on success path; on failure before consume use web default,
      // unless error carries clientKind.
      if (err && err.clientKind) clientKind = err.clientKind;
      const url = oauth.resolveReturnUrl(clientKind, 'error');
      return res.redirect(302, url);
    } catch {
      return res.status(400).send('Spotify authorization failed');
    }
  }
});

module.exports = {
  protectedRouter,
  callbackRouter,
};
