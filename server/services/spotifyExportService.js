'use strict';

const { nanoid } = require('nanoid');
const db = require('../db');
const matchService = require('./spotifyMatchService');
const { ADD_BATCH_MAX, safeSpotifyExternalUrl } = require('./spotifyService');

const STAGES = Object.freeze({
  MATCHING: 'matching',
  CREATING: 'creating',
  ADDING: 'adding',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
});

const PARTIAL = Object.freeze({
  NONE: 'none',
  NO_CREATE: 'no_create',
  CREATED_EMPTY: 'created_empty',
  PARTIALLY_ADDED: 'partially_added',
});

function exportError(code, message, extra = {}) {
  const err = new Error(message || code);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseTrackJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function jobToDto(row) {
  if (!row) return null;
  let report = null;
  if (row.report_json) {
    try {
      report = JSON.parse(row.report_json);
    } catch {
      report = { destination_url: null, partial_state: row.partial_state, rows: [] };
    }
  }
  return {
    id: row.id,
    source_playlist_id: row.source_playlist_id,
    stage: row.stage,
    current_count: row.current_count,
    total_count: row.total_count,
    matched_count: row.matched_count,
    unmatched_count: row.unmatched_count,
    exported_count: row.exported_count,
    failed_count: row.failed_count,
    destination_provider_id: row.destination_provider_id,
    destination_url: safeSpotifyExternalUrl(row.destination_url),
    safe_reason: row.safe_reason,
    partial_state: row.partial_state,
    report,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function createSpotifyExportService(deps = {}) {
  const spotifyClient = deps.spotifyClient || require('./spotifyService');
  const matcher = deps.matchService || matchService;
  const nowFn = deps.now || (() => new Date());
  const aiProbe = deps.aiProbe || null;
  // Optional inject for negative integration tests. Export must never call it.
  void deps.aiService;

  function assertNoAi(label) {
    if (aiProbe && typeof aiProbe.called === 'function' && aiProbe.called()) {
      throw exportError('invalid_state', `AI boundary violated during ${label}`);
    }
  }

  function loadOwnedPlaylist(userId, playlistId) {
    return db
      .prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(playlistId, userId);
  }

  function snapshotSourceSongs(playlistId) {
    return db
      .prepare(
        `SELECT ps.song_id, ps.added_at, COALESCE(sc.track_json, '{}') AS track_data
         FROM playlist_songs ps
         LEFT JOIN song_cache sc ON sc.song_id = ps.song_id
         WHERE ps.playlist_id = ?
         ORDER BY ps.added_at ASC`
      )
      .all(playlistId);
  }

  function persistJob(fields) {
    const updatedAt = nowFn().toISOString();
    db.prepare(
      `UPDATE spotify_export_jobs SET
         stage = COALESCE(?, stage),
         current_count = COALESCE(?, current_count),
         total_count = COALESCE(?, total_count),
         matched_count = COALESCE(?, matched_count),
         unmatched_count = COALESCE(?, unmatched_count),
         exported_count = COALESCE(?, exported_count),
         failed_count = COALESCE(?, failed_count),
         destination_provider_id = COALESCE(?, destination_provider_id),
         destination_url = COALESCE(?, destination_url),
         report_json = COALESCE(?, report_json),
         safe_reason = COALESCE(?, safe_reason),
         partial_state = COALESCE(?, partial_state),
         updated_at = ?
       WHERE id = ?`
    ).run(
      fields.stage ?? null,
      fields.current_count ?? null,
      fields.total_count ?? null,
      fields.matched_count ?? null,
      fields.unmatched_count ?? null,
      fields.exported_count ?? null,
      fields.failed_count ?? null,
      fields.destination_provider_id ?? null,
      fields.destination_url ?? null,
      fields.report_json ?? null,
      fields.safe_reason ?? null,
      fields.partial_state ?? null,
      updatedAt,
      fields.id
    );
  }

  function getExportJob(userId, jobId) {
    const row = db
      .prepare(
        `SELECT * FROM spotify_export_jobs
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .get(jobId, userId);
    return jobToDto(row);
  }

  function getLatestExportJob(userId, sourcePlaylistId) {
    const owned = loadOwnedPlaylist(userId, sourcePlaylistId);
    if (!owned) return null;
    const row = db
      .prepare(
        `SELECT * FROM spotify_export_jobs
         WHERE user_id = ? AND source_playlist_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(userId, sourcePlaylistId);
    return jobToDto(row);
  }

  function mapProviderFailure(err) {
    const code = err && err.code;
    if (code === 'spotify_rate_limited') {
      return { safe_reason: 'rate_limited', retry_after: err.retryAfter ?? null };
    }
    if (code === 'reconnect_required' || code === 'spotify_disconnected') {
      return { safe_reason: 'reconnect_required', retry_after: null };
    }
    if (code === 'spotify_unavailable') {
      return { safe_reason: 'unavailable', retry_after: null };
    }
    return { safe_reason: 'provider_error', retry_after: null };
  }

  async function classifyAll(userId, songs, market) {
    const rows = [];
    let matched = 0;
    let unmatched = 0;
    const acceptedUris = [];

    for (let i = 0; i < songs.length; i += 1) {
      const song = songs[i];
      const track = parseTrackJson(song.track_data);
      const source = {
        song_id: song.song_id,
        identity: `harmonix:${song.song_id}`,
        title: track.title || track.name || '',
        artist: track.artist || (Array.isArray(track.artists) ? track.artists.join(', ') : ''),
        duration_ms: track.duration_ms ?? track.duration ?? null,
        isrc: track.isrc || null,
        explicit: typeof track.explicit === 'boolean' ? track.explicit : null,
      };

      assertNoAi('match');
      const result = await matcher.resolveSpotifyMatch(userId, source, {
        market,
        spotifyClient,
        now: nowFn,
      });
      assertNoAi('match');

      if (result.outcome === 'accept') {
        matched += 1;
        acceptedUris.push(result.spotify_uri);
        rows.push({
          source_identity: source.identity,
          outcome: result.from_cache || result.cached ? 'cached' : 'matched',
          reason: null,
          spotify_uri: result.spotify_uri,
        });
      } else {
        unmatched += 1;
        rows.push({
          source_identity: source.identity,
          outcome: 'unmatched',
          reason: result.reason || 'weak_candidate',
          spotify_uri: null,
        });
      }
    }

    return { rows, matched, unmatched, acceptedUris };
  }

  async function createPrivatePlaylist(userId, name) {
    assertNoAi('createPlaylist');
    const body = {
      name: String(name || 'Harmonix export').slice(0, 100),
      public: false,
      collaborative: false,
      description: 'Exported from Harmonix',
    };
    const data = await spotifyClient.spotifyRequest(userId, '/me/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const id = data && data.id;
    const url = safeSpotifyExternalUrl(data?.external_urls?.spotify);
    if (!id) throw exportError('provider_error', 'Spotify create playlist returned no id');
    return { id, url: url || `https://open.spotify.com/playlist/${id}` };
  }

  async function addUriBatches(userId, playlistId, uris, onBatch) {
    const batches = chunk(uris, ADD_BATCH_MAX);
    let exported = 0;
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      if (batch.length > ADD_BATCH_MAX) {
        throw exportError('invalid_request', 'batch exceeds 100');
      }
      if (typeof spotifyClient.assertAddBatchSize === 'function') {
        spotifyClient.assertAddBatchSize(batch);
      }
      assertNoAi('addItems');
      await spotifyClient.spotifyRequest(userId, `/playlists/${encodeURIComponent(playlistId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: batch }),
      });
      exported += batch.length;
      if (typeof onBatch === 'function') {
        await onBatch({ batchIndex: i, batchSize: batch.length, exported, totalBatches: batches.length });
      }
    }
    return exported;
  }

  async function runExportJob(userId, jobId, options = {}) {
    const row = db
      .prepare('SELECT * FROM spotify_export_jobs WHERE id = ? AND user_id = ?')
      .get(jobId, userId);
    if (!row) throw exportError('not_found', 'Export job not found');

    const playlist = loadOwnedPlaylist(userId, row.source_playlist_id);
    if (!playlist) throw exportError('not_found', 'Playlist not found');

    const songs = snapshotSourceSongs(row.source_playlist_id);
    const market = options.market || 'from_token';
    const mutationLog = options.mutationLog || [];

    persistJob({
      id: jobId,
      stage: STAGES.MATCHING,
      current_count: 0,
      total_count: songs.length,
      partial_state: PARTIAL.NONE,
    });

    let classified;
    try {
      classified = await classifyAll(userId, songs, market);
    } catch (err) {
      const mapped = mapProviderFailure(err);
      const report = {
        destination_url: null,
        partial_state: PARTIAL.NO_CREATE,
        rows: [],
      };
      persistJob({
        id: jobId,
        stage: STAGES.FAILED,
        safe_reason: mapped.safe_reason,
        partial_state: PARTIAL.NO_CREATE,
        report_json: JSON.stringify(report),
      });
      return getExportJob(userId, jobId);
    }

    const reportRows = classified.rows.slice();
    persistJob({
      id: jobId,
      stage: STAGES.MATCHING,
      current_count: songs.length,
      matched_count: classified.matched,
      unmatched_count: classified.unmatched,
      report_json: JSON.stringify({
        destination_url: null,
        partial_state: PARTIAL.NONE,
        rows: reportRows,
      }),
    });

    if (classified.matched === 0) {
      const report = {
        destination_url: null,
        partial_state: PARTIAL.NO_CREATE,
        rows: reportRows,
      };
      persistJob({
        id: jobId,
        stage: STAGES.COMPLETED,
        safe_reason: 'zero_matches',
        partial_state: PARTIAL.NO_CREATE,
        report_json: JSON.stringify(report),
      });
      return getExportJob(userId, jobId);
    }

    // Create only after all matches classified.
    persistJob({ id: jobId, stage: STAGES.CREATING });
    mutationLog.push('create');
    let destination;
    try {
      destination = await createPrivatePlaylist(userId, playlist.name);
    } catch (err) {
      const mapped = mapProviderFailure(err);
      const report = {
        destination_url: null,
        partial_state: PARTIAL.NO_CREATE,
        rows: reportRows,
      };
      persistJob({
        id: jobId,
        stage: STAGES.FAILED,
        safe_reason: mapped.safe_reason,
        partial_state: PARTIAL.NO_CREATE,
        report_json: JSON.stringify(report),
      });
      return getExportJob(userId, jobId);
    }

    persistJob({
      id: jobId,
      stage: STAGES.ADDING,
      destination_provider_id: destination.id,
      destination_url: destination.url,
      report_json: JSON.stringify({
        destination_url: destination.url,
        partial_state: PARTIAL.CREATED_EMPTY,
        rows: reportRows,
      }),
      partial_state: PARTIAL.CREATED_EMPTY,
    });

    let exported = 0;
    try {
      mutationLog.push('add');
      exported = await addUriBatches(userId, destination.id, classified.acceptedUris, async ({ exported: e }) => {
        exported = e;
        persistJob({
          id: jobId,
          stage: STAGES.ADDING,
          current_count: e,
          exported_count: e,
          report_json: JSON.stringify({
            destination_url: destination.url,
            partial_state: e < classified.matched ? PARTIAL.PARTIALLY_ADDED : PARTIAL.NONE,
            rows: reportRows,
          }),
          partial_state: e < classified.matched ? PARTIAL.PARTIALLY_ADDED : PARTIAL.NONE,
        });
      });
    } catch (err) {
      const mapped = mapProviderFailure(err);
      const partialState =
        exported === 0 ? PARTIAL.CREATED_EMPTY : PARTIAL.PARTIALLY_ADDED;
      // Mark remaining matched rows that were not exported as export_failed.
      const failedRows = reportRows.map((r) => {
        if (
          (r.outcome === 'matched' || r.outcome === 'cached') &&
          r.spotify_uri &&
          !classified.acceptedUris.slice(0, exported).includes(r.spotify_uri)
        ) {
          return { ...r, outcome: 'export_failed', reason: mapped.safe_reason };
        }
        return r;
      });
      const failedCount = failedRows.filter((r) => r.outcome === 'export_failed').length;
      persistJob({
        id: jobId,
        stage: err.code === 'spotify_rate_limited' ? STAGES.PARTIAL : STAGES.PARTIAL,
        exported_count: exported,
        failed_count: failedCount,
        safe_reason: mapped.safe_reason,
        partial_state: partialState,
        destination_provider_id: destination.id,
        destination_url: destination.url,
        report_json: JSON.stringify({
          destination_url: destination.url,
          partial_state: partialState,
          rows: failedRows,
        }),
      });
      return getExportJob(userId, jobId);
    }

    const finalReport = {
      destination_url: destination.url,
      partial_state: PARTIAL.NONE,
      rows: reportRows,
    };
    persistJob({
      id: jobId,
      stage: STAGES.COMPLETED,
      current_count: classified.matched,
      exported_count: exported,
      failed_count: 0,
      partial_state: PARTIAL.NONE,
      safe_reason: null,
      destination_provider_id: destination.id,
      destination_url: destination.url,
      report_json: JSON.stringify(finalReport),
    });
    return getExportJob(userId, jobId);
  }

  /**
   * Ownership-gated export entry point used by route handlers and service tests.
   */
  async function exportPlaylist(userId, sourcePlaylistId, options = {}) {
    if (!userId) throw exportError('unauthorized', 'Authentication required');
    const playlist = loadOwnedPlaylist(userId, sourcePlaylistId);
    if (!playlist) throw exportError('not_found', 'Playlist not found');

    const songs = snapshotSourceSongs(sourcePlaylistId);
    if (songs.length === 0) {
      throw exportError('invalid_request', 'Playlist is empty');
    }

    const idempotencyKey =
      typeof options.idempotency_key === 'string' && options.idempotency_key.trim()
        ? options.idempotency_key.trim().slice(0, 128)
        : null;

    if (idempotencyKey) {
      const existing = db
        .prepare(
          `SELECT * FROM spotify_export_jobs
           WHERE user_id = ? AND source_playlist_id = ? AND idempotency_key = ?
             AND deleted_at IS NULL`
        )
        .get(userId, sourcePlaylistId, idempotencyKey);
      if (existing) {
        return jobToDto(existing);
      }
    }

    // Serialize duplicate in-flight submissions for same user/source without key.
    const inFlight = db
      .prepare(
        `SELECT * FROM spotify_export_jobs
         WHERE user_id = ? AND source_playlist_id = ? AND deleted_at IS NULL
           AND stage IN ('matching', 'creating', 'adding')
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(userId, sourcePlaylistId);
    if (inFlight && !options.force) {
      return jobToDto(inFlight);
    }

    const id = nanoid();
    const ts = nowFn().toISOString();
    db.prepare(
      `INSERT INTO spotify_export_jobs (
         id, user_id, source_playlist_id, idempotency_key, stage,
         current_count, total_count, matched_count, unmatched_count,
         exported_count, failed_count, report_json, partial_state,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, NULL, ?, ?, ?)`
    ).run(
      id,
      userId,
      sourcePlaylistId,
      idempotencyKey,
      STAGES.MATCHING,
      songs.length,
      PARTIAL.NONE,
      ts,
      ts
    );

    const mutationLog = options.mutationLog || [];
    const result = await runExportJob(userId, id, {
      market: options.market || 'from_token',
      mutationLog,
    });
    result._mutationLog = mutationLog;
    return result;
  }

  async function startExport(userId, sourcePlaylistId, options = {}) {
    return exportPlaylist(userId, sourcePlaylistId, options);
  }

  return {
    exportPlaylist,
    startExport,
    runExportJob,
    getExportJob,
    getLatestExportJob,
    STAGES,
    PARTIAL,
    ADD_BATCH_MAX,
  };
}

const defaultService = createSpotifyExportService();

module.exports = {
  createSpotifyExportService,
  exportPlaylist: (...args) => defaultService.exportPlaylist(...args),
  startExport: (...args) => defaultService.startExport(...args),
  runExportJob: (...args) => defaultService.runExportJob(...args),
  getExportJob: (...args) => defaultService.getExportJob(...args),
  getLatestExportJob: (...args) => defaultService.getLatestExportJob(...args),
  STAGES,
  PARTIAL,
  ADD_BATCH_MAX,
};
