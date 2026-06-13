const db = require('../db');

const DEFAULT_TTL_DAYS = 7;

function parseLrc(lrcString) {
 if (!lrcString || typeof lrcString !== 'string') return [];
 const lines = lrcString.split('\n');
 const parsed = [];
 const timeRe = /\[(\d{1,2}):(\d{1,2})(?:[\.:](\d{1,3}))?\]/;

 for (const raw of lines) {
 const match = raw.match(timeRe);
 if (!match) continue;
 const min = parseInt(match[1], 10);
 const sec = parseInt(match[2], 10);
 const frac = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
 const ms = (min * 60 + sec) * 1000 + frac;
 const text = raw.replace(timeRe, '').trim();
 parsed.push({ time: ms, text });
 }

 return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Validate that an LRC timeline matches the song duration.
 * Heuristics:
 * - timestamps must be non-negative
 * - timestamps must be < duration + 5s (allow small drift)
 * - at least 3 lines
 * - no two consecutive identical timestamps
 * @returns { valid: boolean, issues: string[], score: 0..1 }
 */
function validateSongSync(trackData, lrcData) {
 const issues = [];
 let score = 1.0;

 if (!trackData || !trackData.duration) {
 return { valid: false, issues: ['missing_track_duration'], score: 0 };
 }

 if (!lrcData || (typeof lrcData === 'string' && lrcData.length === 0)) {
 return { valid: false, issues: ['missing_lrc'], score: 0 };
 }

 const lines = parseLrc(lrcData);
 if (lines.length < 3) {
 issues.push('too_few_lines');
 score -= 0.5;
 }

 let prevTime = -1;
 const durationMs = trackData.duration * 1000;
 // Tolerance: 5% of song length or 10s, whichever is larger.
 const toleranceMs = Math.max(10000, durationMs * 0.05);
 const oobThreshold = durationMs + toleranceMs;
 let oob = 0;

 for (const line of lines) {
 if (line.time < 0) {
 issues.push('negative_timestamp');
 score -= 0.2;
 }
 if (line.time > oobThreshold) {
 oob++;
 }
 if (line.time <= prevTime) {
 issues.push('non_monotonic_timestamps');
 score -= 0.1;
 }
 prevTime = line.time;
 }

 if (oob > 0) {
 issues.push(`out_of_bounds:${oob}`);
 score -= Math.min(0.5, oob * 0.05);
 }

 score = Math.max(0, Math.min(1, score));
 const valid = score >= 0.6 && issues.indexOf('missing_lrc') === -1;

 return { valid, issues, score };
}

function cacheSongData(songId, lyrics, track, ttlDays = DEFAULT_TTL_DAYS) {
 const expires = new Date();
 expires.setDate(expires.getDate() + ttlDays);

 const lyricsJson = JSON.stringify({ syncedLyrics: lyrics?.syncedLyrics || null, plainLyrics: lyrics?.plainLyrics || null });
 const trackJson = JSON.stringify(track || {});

 db.prepare(`
 INSERT INTO song_cache (song_id, lyrics_json, track_json, cached_at, expires_at)
 VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
 ON CONFLICT(song_id) DO UPDATE SET
 lyrics_json = excluded.lyrics_json,
 track_json = excluded.track_json,
 cached_at = CURRENT_TIMESTAMP,
 expires_at = excluded.expires_at
 `).run(songId, lyricsJson, trackJson, expires.toISOString());
}

function getCachedSong(songId) {
 const row = db.prepare('SELECT * FROM song_cache WHERE song_id = ?').get(songId);
 if (!row) return null;
 if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
 return {
 lyrics: row.lyrics_json ? JSON.parse(row.lyrics_json) : null,
 track: row.track_json ? JSON.parse(row.track_json) : null,
 cachedAt: row.cached_at,
 expiresAt: row.expires_at
 };
}

function recordValidation(songId, artist, title, duration, result) {
 db.prepare(`
 INSERT INTO validated_songs (song_id, artist, title, duration, lrc_valid, lrc_checked_at, score)
 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
 ON CONFLICT(song_id) DO UPDATE SET
 artist = excluded.artist,
 title = excluded.title,
 duration = excluded.duration,
 lrc_valid = excluded.lrc_valid,
 lrc_checked_at = CURRENT_TIMESTAMP,
 score = excluded.score
 `).run(
 songId,
 artist || null,
 title || null,
 duration || null,
 result.valid ? 1 : 0,
 result.score
 );
}

function getValidation(songId) {
 return db.prepare('SELECT * FROM validated_songs WHERE song_id = ?').get(songId);
}

module.exports = {
 parseLrc,
 validateSongSync,
 cacheSongData,
 getCachedSong,
 recordValidation,
 getValidation,
};
