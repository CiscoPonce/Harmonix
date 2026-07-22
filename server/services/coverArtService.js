'use strict';

const db = require('../db');
const deezer = require('./deezerService');

function parseTrackJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function upsertTrackCache(songId, track) {
  db.prepare(`
    INSERT INTO song_cache (song_id, track_json, cached_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(song_id) DO UPDATE SET
      track_json = excluded.track_json,
      cached_at = CURRENT_TIMESTAMP
  `).run(String(songId), JSON.stringify(track));
}

/**
 * Ensure a track object has a Deezer cover URL; persist into song_cache.
 */
async function ensureTrackCover(songId, trackInput = {}, fetchImpl = fetch) {
  const id = String(songId || '').trim();
  const track = { ...parseTrackJson(trackInput) };
  const existing = deezer.extractCoverFromCachedTrack(track);
  if (existing) {
    track.cover = existing;
    return track;
  }
  if (!id) return track;

  try {
    const data = await deezer.fetchTrack(id, fetchImpl);
    const cover = deezer.coverFromDeezerTrack(data);
    if (cover) track.cover = cover;
    if (!track.title && data.title) track.title = data.title;
    if (!track.artist && data.artist?.name) track.artist = data.artist.name;
    if (track.id == null) track.id = data.id;
    if (!track.duration && data.duration) track.duration = data.duration;
    if (!track.preview && data.preview) {
      track.preview = deezer.previewProxyPath(data.id);
    }
    upsertTrackCache(id, track);
  } catch {
    /* keep track without cover */
  }
  return track;
}

function coversForPlaylistSync(playlistId, limit = 4) {
  const rows = db
    .prepare(
      `
    SELECT sc.track_json
    FROM playlist_songs ps
    LEFT JOIN song_cache sc ON sc.song_id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.added_at DESC
    LIMIT ?
  `
    )
    .all(playlistId, limit);

  const covers = [];
  const seen = new Set();
  for (const row of rows) {
    const cover = deezer.extractCoverFromCachedTrack(row.track_json);
    if (!cover || seen.has(cover)) continue;
    seen.add(cover);
    covers.push(cover);
  }
  return covers;
}

async function coversForPlaylist(playlistId, limit = 4, fetchImpl = fetch) {
  const rows = db
    .prepare(
      `
    SELECT ps.song_id, sc.track_json
    FROM playlist_songs ps
    LEFT JOIN song_cache sc ON sc.song_id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.added_at DESC
    LIMIT ?
  `
    )
    .all(playlistId, Math.max(limit, 4));

  const covers = [];
  const seen = new Set();

  for (const row of rows) {
    if (covers.length >= limit) break;
    let cover = deezer.extractCoverFromCachedTrack(row.track_json);
    if (!cover && row.song_id) {
      const enriched = await ensureTrackCover(row.song_id, row.track_json, fetchImpl);
      cover = enriched.cover || null;
    }
    if (!cover || seen.has(cover)) continue;
    seen.add(cover);
    covers.push(cover);
  }

  return covers;
}

module.exports = {
  parseTrackJson,
  upsertTrackCache,
  ensureTrackCover,
  coversForPlaylistSync,
  coversForPlaylist,
};
