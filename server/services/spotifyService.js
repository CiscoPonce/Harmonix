const db = require('../db');
const { encryptToken, decryptToken } = require('./spotifyCrypto');
const oauth = require('./spotifyOAuthService');

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const PRE_EXPIRY_MS = 60 * 1000;
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_429_RETRIES = 2;
const MAX_CONCURRENT_PER_USER = 1;
const SEARCH_LIMIT = 10;
const ADD_BATCH_MAX = 100;
const PLAYLIST_PAGE_LIMIT = 50;
const MAX_PLAYLIST_PAGES = 40;
const PLAYLIST_METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLAYLIST_ITEMS_PAGE_LIMIT = 50;
const PLAYLIST_DETAIL_DISPLAY_CAP = 20;

const DEFAULT_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  // Web Playback SDK (Premium) — Phase 12.6
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ');

const PLAYBACK_REQUIRED_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
];

const upsertTokensPreserveAuth = db.prepare(`
  INSERT INTO user_spotify_tokens (
    user_id,
    access_ciphertext, access_iv, access_tag, access_key_version,
    refresh_ciphertext, refresh_iv, refresh_tag, refresh_key_version,
    scopes, spotify_user_id, spotify_display_name,
    authorized_at, expires_at, updated_at
  ) VALUES (
    @user_id,
    @access_ciphertext, @access_iv, @access_tag, @access_key_version,
    @refresh_ciphertext, @refresh_iv, @refresh_tag, @refresh_key_version,
    @scopes, @spotify_user_id, @spotify_display_name,
    @authorized_at, @expires_at, @updated_at
  )
  ON CONFLICT(user_id) DO UPDATE SET
    access_ciphertext = excluded.access_ciphertext,
    access_iv = excluded.access_iv,
    access_tag = excluded.access_tag,
    access_key_version = excluded.access_key_version,
    refresh_ciphertext = excluded.refresh_ciphertext,
    refresh_iv = excluded.refresh_iv,
    refresh_tag = excluded.refresh_tag,
    refresh_key_version = excluded.refresh_key_version,
    scopes = excluded.scopes,
    spotify_user_id = COALESCE(excluded.spotify_user_id, user_spotify_tokens.spotify_user_id),
    spotify_display_name = COALESCE(excluded.spotify_display_name, user_spotify_tokens.spotify_display_name),
    authorized_at = user_spotify_tokens.authorized_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
`);

const upsertTokensReplaceAuth = db.prepare(`
  INSERT INTO user_spotify_tokens (
    user_id,
    access_ciphertext, access_iv, access_tag, access_key_version,
    refresh_ciphertext, refresh_iv, refresh_tag, refresh_key_version,
    scopes, spotify_user_id, spotify_display_name,
    authorized_at, expires_at, updated_at
  ) VALUES (
    @user_id,
    @access_ciphertext, @access_iv, @access_tag, @access_key_version,
    @refresh_ciphertext, @refresh_iv, @refresh_tag, @refresh_key_version,
    @scopes, @spotify_user_id, @spotify_display_name,
    @authorized_at, @expires_at, @updated_at
  )
  ON CONFLICT(user_id) DO UPDATE SET
    access_ciphertext = excluded.access_ciphertext,
    access_iv = excluded.access_iv,
    access_tag = excluded.access_tag,
    access_key_version = excluded.access_key_version,
    refresh_ciphertext = excluded.refresh_ciphertext,
    refresh_iv = excluded.refresh_iv,
    refresh_tag = excluded.refresh_tag,
    refresh_key_version = excluded.refresh_key_version,
    scopes = excluded.scopes,
    spotify_user_id = excluded.spotify_user_id,
    spotify_display_name = excluded.spotify_display_name,
    authorized_at = excluded.authorized_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
`);

const selectTokens = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?');
const deleteTokens = db.prepare('DELETE FROM user_spotify_tokens WHERE user_id = ?');
const deleteAllOAuth = db.prepare('DELETE FROM spotify_oauth_transactions WHERE user_id = ?');
const deletePlaylists = db.prepare('DELETE FROM user_spotify_playlists WHERE user_id = ?');

const upsertPlaylist = db.prepare(`
  INSERT INTO user_spotify_playlists (
    user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
    is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
    synced_at, revalidated_at, expires_at
  ) VALUES (
    @user_id, @spotify_playlist_id, @name, @external_url, @artwork_url, @track_count,
    @is_owner, @is_collaborative, @is_restricted, @detail_access, @snapshot_id,
    @synced_at, @revalidated_at, @expires_at
  )
  ON CONFLICT(user_id, spotify_playlist_id) DO UPDATE SET
    name = excluded.name,
    external_url = excluded.external_url,
    artwork_url = excluded.artwork_url,
    track_count = excluded.track_count,
    is_owner = excluded.is_owner,
    is_collaborative = excluded.is_collaborative,
    is_restricted = excluded.is_restricted,
    detail_access = excluded.detail_access,
    snapshot_id = excluded.snapshot_id,
    synced_at = excluded.synced_at,
    revalidated_at = excluded.revalidated_at,
    expires_at = excluded.expires_at
`);

const selectPlaylists = db.prepare(`
  SELECT * FROM user_spotify_playlists
  WHERE user_id = ?
  ORDER BY name COLLATE NOCASE ASC
`);

const selectPlaylistByUserAndId = db.prepare(`
  SELECT * FROM user_spotify_playlists
  WHERE user_id = ? AND spotify_playlist_id = ?
`);

const deleteMissingPlaylists = db.prepare(`
  DELETE FROM user_spotify_playlists
  WHERE user_id = ?
    AND spotify_playlist_id NOT IN (SELECT value FROM json_each(?))
`);

const deletePlaylistByUserAndId = db.prepare(`
  DELETE FROM user_spotify_playlists
  WHERE user_id = ? AND spotify_playlist_id = ?
`);

function providerError(code, message, extra = {}) {
  const err = new Error(message || code);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function requireClientId() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw providerError('spotify_misconfigured', 'SPOTIFY_CLIENT_ID is not configured');
  }
  return id.trim();
}

function requireRedirectUri() {
  const uri = process.env.SPOTIFY_REDIRECT_URI;
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    throw providerError('spotify_misconfigured', 'SPOTIFY_REDIRECT_URI is not configured');
  }
  return uri.trim();
}

function scopesFromEnv() {
  const raw = process.env.SPOTIFY_SCOPES;
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_SCOPES;
  }
  return raw.trim().split(/[\s,]+/).filter(Boolean).join(' ');
}

function safeSpotifyExternalUrl(url) {
  if (url == null || typeof url !== 'string' || url.trim() === '') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'open.spotify.com') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function validateSpotifyPlaylistId(id) {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (trimmed.includes(':')) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function stablePlaylistId(providerId) {
  return `spotify:${providerId}`;
}

function formatArtists(artists) {
  if (!Array.isArray(artists)) return '';
  return artists
    .map((a) => (a && typeof a.name === 'string' ? a.name : ''))
    .filter(Boolean)
    .join(', ');
}

function trackUriFromTrack(track) {
  if (!track || typeof track !== 'object') return null;
  if (typeof track.uri === 'string' && /^spotify:track:[A-Za-z0-9._-]+$/.test(track.uri)) {
    return track.uri;
  }
  if (typeof track.id === 'string' && /^[A-Za-z0-9]+$/.test(track.id)) {
    return `spotify:track:${track.id}`;
  }
  return null;
}

function albumNameFromTrack(track) {
  if (!track || typeof track !== 'object') return null;
  const album = track.album;
  if (album && typeof album === 'object' && typeof album.name === 'string' && album.name.trim()) {
    return album.name.trim();
  }
  return null;
}

function normalizePlaylistTrackItem(entry, position) {
  const track = entry && typeof entry === 'object' ? entry.track : null;
  if (track == null) {
    return {
      position,
      title: '',
      name: '',
      artists: '',
      duration_ms: null,
      uri: null,
      album_name: null,
      availability: 'null',
      reason: 'null_track',
    };
  }
  const title = typeof track.name === 'string' ? track.name : '';
  const artists = formatArtists(track.artists);
  const duration =
    typeof track.duration_ms === 'number' && Number.isFinite(track.duration_ms)
      ? track.duration_ms
      : null;
  const uri = trackUriFromTrack(track);
  const album_name = albumNameFromTrack(track);

  if (track.is_local) {
    return {
      position,
      title,
      name: title,
      artists,
      duration_ms: duration,
      uri: null,
      album_name,
      availability: 'local',
      reason: 'local_track',
    };
  }

  const restrictedReason =
    track.restrictions && typeof track.restrictions.reason === 'string'
      ? track.restrictions.reason
      : null;
  if (track.is_playable === false || restrictedReason) {
    return {
      position,
      title,
      name: title,
      artists,
      duration_ms: duration,
      uri,
      album_name,
      availability: 'unavailable',
      reason: restrictedReason || 'unavailable',
    };
  }

  return {
    position,
    title,
    name: title,
    artists,
    duration_ms: duration,
    uri,
    album_name,
    availability: 'available',
    reason: null,
  };
}

function parseScopeSet(scopes) {
  if (!scopes || typeof scopes !== 'string') return new Set();
  return new Set(scopes.trim().split(/[\s,]+/).filter(Boolean));
}

function missingPlaybackScopes(grantedScopes) {
  const granted = parseScopeSet(grantedScopes);
  return PLAYBACK_REQUIRED_SCOPES.filter((s) => !granted.has(s));
}

function detailDtoFromNormalized(meta, { detailState, items }) {
  const capped = Array.isArray(items) ? items.slice(0, PLAYLIST_DETAIL_DISPLAY_CAP) : [];
  const restricted = detailState === 'restricted';
  return {
    provider: 'spotify',
    provider_id: meta.provider_id,
    stable_id: meta.stable_id || stablePlaylistId(meta.provider_id),
    name: meta.name || '',
    artwork_url: meta.artwork_url ?? null,
    track_count: meta.track_count ?? null,
    is_owner: Boolean(meta.is_owner),
    is_collaborative: Boolean(meta.is_collaborative),
    is_restricted: restricted || Boolean(meta.is_restricted),
    detail_access: restricted ? 'restricted' : meta.detail_access || 'full',
    restricted,
    detail_state: detailState,
    external_url: safeSpotifyExternalUrl(meta.external_url),
    items: capped,
    tracks: capped.map((item) => ({
      name: item.title || item.name || '',
      artists: item.artists || '',
    })),
  };
}

function parseRetryAfterSeconds(header) {
  if (header == null) return null;
  const asInt = Number.parseInt(String(header).trim(), 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt;
  return null;
}

function rowToStatus(row, now) {
  if (!row) {
    return { status: 'disconnected', display_name: null, reason: null };
  }
  const authorizedAt = new Date(row.authorized_at).getTime();
  if (!Number.isFinite(authorizedAt) || now.getTime() - authorizedAt >= SIX_MONTHS_MS) {
    return {
      status: 'reconnect_required',
      display_name: row.spotify_display_name || null,
      reason: 'authorization_expired',
    };
  }
  return {
    status: 'connected',
    display_name: row.spotify_display_name || null,
    reason: null,
  };
}

function encryptPair(accessToken, refreshToken) {
  const access = encryptToken(accessToken);
  const refresh = encryptToken(refreshToken);
  return { access, refresh };
}

function decryptAccess(row) {
  return decryptToken({
    ciphertext: row.access_ciphertext,
    iv: row.access_iv,
    tag: row.access_tag,
    keyVersion: row.access_key_version,
  });
}

function decryptRefresh(row) {
  return decryptToken({
    ciphertext: row.refresh_ciphertext,
    iv: row.refresh_iv,
    tag: row.refresh_tag,
    keyVersion: row.refresh_key_version,
  });
}

function persistTokenRow({
  userId,
  accessToken,
  refreshToken,
  scopes,
  expiresIn,
  now,
  spotifyUserId = null,
  spotifyDisplayName = null,
  authorizedAt = null,
  replaceAuthorizedAt = false,
}) {
  const { access, refresh } = encryptPair(accessToken, refreshToken);
  const expiresAt = new Date(now.getTime() + Number(expiresIn) * 1000).toISOString();
  const updatedAt = now.toISOString();
  const authAt = authorizedAt || updatedAt;
  const stmt = replaceAuthorizedAt ? upsertTokensReplaceAuth : upsertTokensPreserveAuth;
  stmt.run({
    user_id: userId,
    access_ciphertext: access.ciphertext,
    access_iv: access.iv,
    access_tag: access.tag,
    access_key_version: access.keyVersion,
    refresh_ciphertext: refresh.ciphertext,
    refresh_iv: refresh.iv,
    refresh_tag: refresh.tag,
    refresh_key_version: refresh.keyVersion,
    scopes: scopes || scopesFromEnv(),
    spotify_user_id: spotifyUserId,
    spotify_display_name: spotifyDisplayName,
    authorized_at: authAt,
    expires_at: expiresAt,
    updated_at: updatedAt,
  });
}

function normalizePlaylistItem(raw, spotifyUserId) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const ownerId = raw.owner && typeof raw.owner === 'object' ? raw.owner.id : null;
  const isOwner = Boolean(spotifyUserId && ownerId && ownerId === spotifyUserId);
  const isCollaborative = Boolean(raw.collaborative);
  const detailAccess = isOwner || isCollaborative ? 'full' : 'restricted';
  const images = Array.isArray(raw.images) ? raw.images : [];
  const artwork = images.length > 0 && typeof images[0]?.url === 'string' ? images[0].url : null;
  const trackCount =
    raw.tracks && typeof raw.tracks.total === 'number' && Number.isFinite(raw.tracks.total)
      ? raw.tracks.total
      : null;
  return {
    provider: 'spotify',
    provider_id: String(raw.id),
    stable_id: stablePlaylistId(String(raw.id)),
    name: typeof raw.name === 'string' ? raw.name : '',
    external_url: safeSpotifyExternalUrl(raw.external_urls?.spotify),
    artwork_url: artwork,
    track_count: trackCount,
    is_owner: isOwner,
    is_collaborative: isCollaborative,
    is_restricted: detailAccess === 'restricted',
    detail_access: detailAccess,
    snapshot_id: typeof raw.snapshot_id === 'string' ? raw.snapshot_id : null,
  };
}

function playlistRowToDto(row) {
  return {
    provider: 'spotify',
    provider_id: row.spotify_playlist_id,
    stable_id: stablePlaylistId(row.spotify_playlist_id),
    name: row.name,
    external_url: row.external_url,
    artwork_url: row.artwork_url,
    track_count: row.track_count,
    is_owner: Boolean(row.is_owner),
    is_collaborative: Boolean(row.is_collaborative),
    is_restricted: Boolean(row.is_restricted),
    detail_access: row.detail_access,
  };
}

function createSpotifyClient(deps = {}) {
  // Resolve fetch/now/sleep at call time so tests can monkey-patch globals.
  const fetchImpl =
    deps.fetch || ((...args) => globalThis.fetch(...args));
  const nowFn = deps.now || (() => new Date());
  const sleepFn =
    deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = Number.isFinite(deps.timeoutMs) ? deps.timeoutMs : DEFAULT_TIMEOUT_MS;

  const refreshLocks = new Map();
  const admissionCounts = new Map();

  async function withAdmission(userId, fn) {
    const active = admissionCounts.get(userId) || 0;
    if (active >= MAX_CONCURRENT_PER_USER) {
      throw providerError('spotify_rate_limited', 'Per-user Spotify admission limit reached', {
        retryable: true,
      });
    }
    admissionCounts.set(userId, active + 1);
    try {
      return await fn();
    } finally {
      const next = (admissionCounts.get(userId) || 1) - 1;
      if (next <= 0) admissionCounts.delete(userId);
      else admissionCounts.set(userId, next);
    }
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
        throw providerError('spotify_unavailable', 'Spotify request timed out', {
          retryable: true,
        });
      }
      throw providerError('spotify_unavailable', err.message || 'Spotify request failed', {
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function getConnectionStatus(userId) {
    const row = selectTokens.get(userId);
    return rowToStatus(row, nowFn());
  }

  async function refreshAccessToken(userId) {
    const row = selectTokens.get(userId);
    if (!row) {
      throw providerError('spotify_disconnected', 'Spotify is not connected');
    }
    const status = rowToStatus(row, nowFn());
    if (status.status === 'reconnect_required') {
      throw providerError('reconnect_required', 'Spotify authorization expired', {
        reason: status.reason,
      });
    }

    const refreshToken = decryptRefresh(row);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireClientId(),
    });

    const res = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errCode = payload.error;
      if (errCode === 'invalid_grant' || res.status === 400) {
        deleteTokens.run(userId);
        throw providerError('reconnect_required', 'Spotify refresh token rejected', {
          reason: 'invalid_grant',
        });
      }
      throw providerError('provider_error', 'Spotify token refresh failed', {
        status: res.status,
      });
    }

    const nextRefresh =
      typeof payload.refresh_token === 'string' && payload.refresh_token.length > 0
        ? payload.refresh_token
        : refreshToken;

    persistTokenRow({
      userId,
      accessToken: payload.access_token,
      refreshToken: nextRefresh,
      scopes: payload.scope || row.scopes,
      expiresIn: payload.expires_in || 3600,
      now: nowFn(),
      spotifyUserId: row.spotify_user_id,
      spotifyDisplayName: row.spotify_display_name,
      authorizedAt: row.authorized_at,
    });

    return payload.access_token;
  }

  async function getValidAccessToken(userId) {
    const row = selectTokens.get(userId);
    if (!row) {
      throw providerError('spotify_disconnected', 'Spotify is not connected');
    }
    const status = rowToStatus(row, nowFn());
    if (status.status === 'reconnect_required') {
      throw providerError('reconnect_required', 'Spotify authorization expired', {
        reason: status.reason,
      });
    }

    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt - nowFn().getTime() > PRE_EXPIRY_MS) {
      return decryptAccess(row);
    }

    if (!refreshLocks.has(userId)) {
      const pending = refreshAccessToken(userId).finally(() => {
        refreshLocks.delete(userId);
      });
      refreshLocks.set(userId, pending);
    }
    return refreshLocks.get(userId);
  }

  /**
   * Short-lived access token for Spotify Web Playback SDK (browser).
   * Refresh tokens never leave the server.
   */
  async function issuePlayerAccess(userId) {
    const row = selectTokens.get(userId);
    if (!row) {
      throw providerError('spotify_disconnected', 'Spotify is not connected');
    }
    const missing = missingPlaybackScopes(row.scopes);
    if (missing.length > 0) {
      throw providerError(
        'reconnect_required',
        'Spotify reconnect required for in-app playback',
        { reason: 'missing_playback_scope' }
      );
    }

    const accessToken = await getValidAccessToken(userId);
    const fresh = selectTokens.get(userId);
    const expiresAtMs = fresh ? new Date(fresh.expires_at).getTime() : Date.now() + 3600_000;
    const expiresIn = Math.max(30, Math.floor((expiresAtMs - nowFn().getTime()) / 1000));

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
    };
  }

  async function spotifyRequest(userId, path, options = {}) {
    return withAdmission(userId, async () => {
      let attempt = 0;
      while (true) {
        const accessToken = await getValidAccessToken(userId);
        const url = path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`;
        const res = await fetchWithTimeout(url, {
          ...options,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
          },
        });

        if (res.status === 429) {
          const retryAfter = parseRetryAfterSeconds(res.headers.get('retry-after'));
          if (retryAfter == null || attempt >= MAX_429_RETRIES) {
            throw providerError('spotify_rate_limited', 'Spotify rate limit exceeded', {
              retryable: true,
              retryAfter,
            });
          }
          await sleepFn(retryAfter * 1000);
          attempt += 1;
          continue;
        }

        if (res.status === 401) {
          throw providerError('reconnect_required', 'Spotify access unauthorized', {
            reason: 'unauthorized',
          });
        }

        if (!res.ok) {
          throw providerError('provider_error', `Spotify API error ${res.status}`, {
            status: res.status,
          });
        }

        if (res.status === 204) return null;
        return res.json();
      }
    });
  }

  async function searchTracks(userId, query, opts = {}) {
    const limit = Math.min(Number(opts.limit) || SEARCH_LIMIT, SEARCH_LIMIT);
    const q = encodeURIComponent(query);
    const market = opts.market ? `&market=${encodeURIComponent(opts.market)}` : '';
    const data = await spotifyRequest(
      userId,
      `/search?type=track&limit=${limit}&q=${q}${market}`
    );
    const items = Array.isArray(data?.tracks?.items) ? data.tracks.items : [];
    return items.slice(0, SEARCH_LIMIT);
  }

  function assertAddBatchSize(uris) {
    if (!Array.isArray(uris)) {
      throw providerError('invalid_request', 'uris must be an array');
    }
    if (uris.length > ADD_BATCH_MAX) {
      throw providerError('invalid_request', `Cannot add more than ${ADD_BATCH_MAX} uris per request`);
    }
  }

  async function listCurrentUserPlaylists(userId) {
    const tokenRow = selectTokens.get(userId);
    const spotifyUserId = tokenRow?.spotify_user_id || null;
    const collected = [];
    let offset = 0;
    let pages = 0;
    while (pages < MAX_PLAYLIST_PAGES) {
      const data = await spotifyRequest(
        userId,
        `/me/playlists?limit=${PLAYLIST_PAGE_LIMIT}&offset=${offset}`
      );
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const item of items) {
        const normalized = normalizePlaylistItem(item, spotifyUserId);
        if (normalized) collected.push(normalized);
      }
      pages += 1;
      if (!data?.next || items.length === 0) break;
      offset += PLAYLIST_PAGE_LIMIT;
    }
    return collected;
  }

  async function syncUserPlaylists(userId) {
    let items;
    try {
      items = await listCurrentUserPlaylists(userId);
    } catch (err) {
      // Preserve prior rows on timeout, 429, disconnect, reconnect, or partial failure.
      throw err;
    }

    const now = nowFn();
    const syncedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + PLAYLIST_METADATA_TTL_MS).toISOString();
    const ids = items.map((p) => p.provider_id);

    const txn = db.transaction(() => {
      for (const p of items) {
        upsertPlaylist.run({
          user_id: userId,
          spotify_playlist_id: p.provider_id,
          name: p.name,
          external_url: p.external_url,
          artwork_url: p.artwork_url,
          track_count: p.track_count,
          is_owner: p.is_owner ? 1 : 0,
          is_collaborative: p.is_collaborative ? 1 : 0,
          is_restricted: p.is_restricted ? 1 : 0,
          detail_access: p.detail_access,
          snapshot_id: p.snapshot_id,
          synced_at: syncedAt,
          revalidated_at: syncedAt,
          expires_at: expiresAt,
        });
      }
      deleteMissingPlaylists.run(userId, JSON.stringify(ids));
    });
    txn();

    return selectPlaylists.all(userId).map(playlistRowToDto);
  }

  function listStoredPlaylists(userId) {
    return selectPlaylists.all(userId).map(playlistRowToDto);
  }

  async function requestPlaylistPath(userId, path) {
    try {
      const data = await spotifyRequest(userId, path);
      return { ok: true, status: 200, data };
    } catch (err) {
      if (err && err.code === 'provider_error' && (err.status === 403 || err.status === 404)) {
        return { ok: false, status: err.status, data: null };
      }
      throw err;
    }
  }

  async function loadUserScopedPlaylistMetadata(userId, playlistId) {
    let row = selectPlaylistByUserAndId.get(userId, playlistId);
    if (!row) {
      throw providerError('not_found', 'Playlist not found');
    }

    const now = nowFn();
    if (new Date(row.expires_at).getTime() <= now.getTime()) {
      // Stale — revalidate via complete /me/playlists sync; never serve stale fields.
      await syncUserPlaylists(userId);
      row = selectPlaylistByUserAndId.get(userId, playlistId);
      if (!row) {
        throw providerError('not_found', 'Playlist not found');
      }
    }

    return {
      provider: 'spotify',
      provider_id: row.spotify_playlist_id,
      stable_id: stablePlaylistId(row.spotify_playlist_id),
      name: row.name,
      external_url: row.external_url,
      artwork_url: row.artwork_url,
      track_count: row.track_count,
      is_owner: Boolean(row.is_owner),
      is_collaborative: Boolean(row.is_collaborative),
      is_restricted: Boolean(row.is_restricted),
      detail_access: row.detail_access,
      snapshot_id: row.snapshot_id,
    };
  }

  async function getPlaylistItems(userId, playlistId) {
    const id = validateSpotifyPlaylistId(playlistId);
    if (!id) {
      throw providerError('invalid_request', 'Invalid Spotify playlist id');
    }
    const result = await requestPlaylistPath(
      userId,
      `/playlists/${encodeURIComponent(id)}/items?limit=${PLAYLIST_ITEMS_PAGE_LIMIT}&offset=0`
    );
    if (!result.ok) {
      return result;
    }
    const rawItems = Array.isArray(result.data?.items) ? result.data.items : [];
    const items = rawItems.map((entry, index) => normalizePlaylistTrackItem(entry, index));
    return { ok: true, status: 200, items };
  }

  async function getPlaylistDetail(userId, playlistId) {
    const id = validateSpotifyPlaylistId(playlistId);
    if (!id) {
      throw providerError('invalid_request', 'Invalid Spotify playlist id');
    }

    const tokenRow = selectTokens.get(userId);
    if (!tokenRow) {
      throw providerError('spotify_disconnected', 'Spotify is not connected');
    }
    const status = rowToStatus(tokenRow, nowFn());
    if (status.status === 'reconnect_required') {
      throw providerError('reconnect_required', 'Spotify authorization expired', {
        reason: status.reason,
      });
    }

    const spotifyUserId = tokenRow.spotify_user_id || null;
    const metaResult = await requestPlaylistPath(
      userId,
      `/playlists/${encodeURIComponent(id)}`
    );

    if (metaResult.status === 404) {
      // Remove obsolete same-user cache row when Spotify reports removed.
      deletePlaylistByUserAndId.run(userId, id);
      throw providerError('not_found', 'Playlist not found');
    }

    let meta = null;
    if (metaResult.ok) {
      meta = normalizePlaylistItem(metaResult.data, spotifyUserId);
      if (!meta) {
        throw providerError('not_found', 'Playlist not found');
      }
    } else if (metaResult.status === 403) {
      // Followed/restricted playlists may deny playlist GET; use user-scoped cache only.
      meta = await loadUserScopedPlaylistMetadata(userId, id);
      return detailDtoFromNormalized(meta, { detailState: 'restricted', items: [] });
    } else {
      throw providerError('provider_error', 'Spotify playlist metadata unavailable');
    }

    const itemsResult = await getPlaylistItems(userId, id);
    if (!itemsResult.ok && itemsResult.status === 403) {
      // Prefer live header metadata; ensure membership exists for restricted disclosure.
      const scoped = selectPlaylistByUserAndId.get(userId, id);
      if (!scoped && meta.detail_access === 'restricted') {
        // Live metadata without membership record — still OK when GET /playlists/{id} succeeded.
        // Restricted item detail requires either live meta or user-scoped row; live meta is enough.
      }
      return detailDtoFromNormalized(meta, { detailState: 'restricted', items: [] });
    }
    if (!itemsResult.ok && itemsResult.status === 404) {
      deletePlaylistByUserAndId.run(userId, id);
      throw providerError('not_found', 'Playlist not found');
    }
    if (!itemsResult.ok) {
      throw providerError('provider_error', 'Spotify playlist items unavailable');
    }

    const detailState = itemsResult.items.length === 0 ? 'empty' : 'normal';
    return detailDtoFromNormalized(meta, {
      detailState,
      items: itemsResult.items,
    });
  }

  async function startAuthorization(userId, clientKind) {
    const clientId = requireClientId();
    const redirectUri = requireRedirectUri();
    const tx = oauth.createOAuthTransaction({ userId, clientKind });
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: tx.challenge,
      state: tx.state,
      scope: scopesFromEnv(),
    });
    const authorizationUrl = `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
    const parsed = new URL(authorizationUrl);
    if (parsed.hostname !== 'accounts.spotify.com') {
      throw providerError('spotify_misconfigured', 'Invalid Spotify authorize host');
    }
    return { authorizationUrl, clientKind };
  }

  async function exchangeAuthorizationCode({ code, verifier }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: requireRedirectUri(),
      client_id: requireClientId(),
      code_verifier: verifier,
    });
    const res = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw providerError('provider_error', 'Spotify authorization code exchange failed', {
        status: res.status,
      });
    }
    return payload;
  }

  async function fetchSpotifyProfile(accessToken) {
    const res = await fetchWithTimeout(`${SPOTIFY_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return { id: null, display_name: null };
    const data = await res.json().catch(() => ({}));
    return {
      id: typeof data.id === 'string' ? data.id : null,
      display_name: typeof data.display_name === 'string' ? data.display_name : null,
    };
  }

  async function completeAuthorization({ code, state }) {
    const consumed = oauth.consumeOAuthTransaction({ state, now: nowFn() });
    try {
      const tokens = await exchangeAuthorizationCode({
        code,
        verifier: consumed.pkceVerifier,
      });
      if (!tokens.refresh_token) {
        throw providerError('provider_error', 'Spotify token response missing refresh_token');
      }
      const profile = await fetchSpotifyProfile(tokens.access_token);
      persistTokenRow({
        userId: consumed.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scopes: tokens.scope || scopesFromEnv(),
        expiresIn: tokens.expires_in || 3600,
        now: nowFn(),
        spotifyUserId: profile.id,
        spotifyDisplayName: profile.display_name,
        authorizedAt: nowFn().toISOString(),
        replaceAuthorizedAt: true,
      });
      return {
        userId: consumed.userId,
        clientKind: consumed.clientKind,
        successUrl: oauth.resolveReturnUrl(consumed.clientKind, 'success'),
      };
    } catch (err) {
      err.clientKind = consumed.clientKind;
      throw err;
    }
  }

  function disconnectUser(userId) {
    const txn = db.transaction(() => {
      deleteTokens.run(userId);
      deleteAllOAuth.run(userId);
      deletePlaylists.run(userId);
      // D-12-05 / D-12-12: clear Spotify match evidence for this user's playlist songs
      // and delete user-owned export jobs.
      try {
        const { clearSpotifyMatchEvidence } = require('./spotifyMatchService');
        const songIds = db
          .prepare(
            `SELECT DISTINCT ps.song_id
             FROM playlist_songs ps
             INNER JOIN playlists p ON p.id = ps.playlist_id
             WHERE p.user_id = ?`
          )
          .all(userId);
        for (const row of songIds) {
          clearSpotifyMatchEvidence(row.song_id);
        }
      } catch {
        // Matcher may be absent in early foundation slices.
      }
      try {
        db.prepare('DELETE FROM spotify_export_jobs WHERE user_id = ?').run(userId);
      } catch {
        // Export jobs table is created by the export plan.
      }
    });
    txn();
    return { status: 'disconnected' };
  }

  return {
    getConnectionStatus,
    getValidAccessToken,
    refreshAccessToken,
    issuePlayerAccess,
    spotifyRequest,
    searchTracks,
    assertAddBatchSize,
    listCurrentUserPlaylists,
    syncUserPlaylists,
    listStoredPlaylists,
    getPlaylistItems,
    getPlaylistDetail,
    startAuthorization,
    completeAuthorization,
    disconnectUser,
    persistTokenRow,
    normalizePlaylistItem,
    normalizePlaylistTrackItem,
    safeSpotifyExternalUrl,
    validateSpotifyPlaylistId,
    SEARCH_LIMIT,
    ADD_BATCH_MAX,
    PLAYLIST_DETAIL_DISPLAY_CAP,
    PRE_EXPIRY_MS,
    SIX_MONTHS_MS,
  };
}

const defaultClient = createSpotifyClient();

module.exports = {
  createSpotifyClient,
  getConnectionStatus: (...args) => defaultClient.getConnectionStatus(...args),
  getValidAccessToken: (...args) => defaultClient.getValidAccessToken(...args),
  refreshAccessToken: (...args) => defaultClient.refreshAccessToken(...args),
  issuePlayerAccess: (...args) => defaultClient.issuePlayerAccess(...args),
  spotifyRequest: (...args) => defaultClient.spotifyRequest(...args),
  searchTracks: (...args) => defaultClient.searchTracks(...args),
  assertAddBatchSize: (...args) => defaultClient.assertAddBatchSize(...args),
  listCurrentUserPlaylists: (...args) => defaultClient.listCurrentUserPlaylists(...args),
  syncUserPlaylists: (...args) => defaultClient.syncUserPlaylists(...args),
  listStoredPlaylists: (...args) => defaultClient.listStoredPlaylists(...args),
  getPlaylistItems: (...args) => defaultClient.getPlaylistItems(...args),
  getPlaylistDetail: (...args) => defaultClient.getPlaylistDetail(...args),
  startAuthorization: (...args) => defaultClient.startAuthorization(...args),
  completeAuthorization: (...args) => defaultClient.completeAuthorization(...args),
  disconnectUser: (...args) => defaultClient.disconnectUser(...args),
  safeSpotifyExternalUrl,
  missingPlaybackScopes,
  PLAYBACK_REQUIRED_SCOPES,
  SEARCH_LIMIT,
  ADD_BATCH_MAX,
  PLAYLIST_DETAIL_DISPLAY_CAP,
};
