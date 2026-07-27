const db = require('../db');
const spotifyService = require('./spotifyService');

const upsertProfile = db.prepare(`
  INSERT INTO user_spotify_profiles (
    user_id, top_genres_json, top_artists_json, last_synced_at
  ) VALUES (
    @user_id, @top_genres_json, @top_artists_json, @last_synced_at
  )
  ON CONFLICT(user_id) DO UPDATE SET
    top_genres_json = excluded.top_genres_json,
    top_artists_json = excluded.top_artists_json,
    last_synced_at = excluded.last_synced_at
`);

const selectProfile = db.prepare(`
  SELECT * FROM user_spotify_profiles WHERE user_id = ?
`);

/**
 * Fetch top artists and tracks from Spotify for a user, extract genres & artists, and cache locally.
 */
async function syncUserProfile(userId) {
  if (!userId) throw new Error('userId is required');

  const status = spotifyService.getConnectionStatus(userId);
  if (status.status !== 'connected') {
    return { synced: false, reason: 'not_connected' };
  }

  let topArtistsRes = null;
  let topTracksRes = null;

  try {
    topArtistsRes = await spotifyService.fetchWithAuth(userId, '/me/top/artists?limit=20&time_range=medium_term');
  } catch (err) {
    console.warn(`[SpotifyProfile] Failed to fetch top artists for user ${userId}:`, err.message);
  }

  try {
    topTracksRes = await spotifyService.fetchWithAuth(userId, '/me/top/tracks?limit=20&time_range=medium_term');
  } catch (err) {
    console.warn(`[SpotifyProfile] Failed to fetch top tracks for user ${userId}:`, err.message);
  }

  const genreMap = {};
  const artistSet = new Set();

  if (topArtistsRes && Array.isArray(topArtistsRes.items)) {
    for (const artist of topArtistsRes.items) {
      if (artist.name) artistSet.add(artist.name);
      if (Array.isArray(artist.genres)) {
        for (const g of artist.genres) {
          genreMap[g] = (genreMap[g] || 0) + 2;
        }
      }
    }
  }

  if (topTracksRes && Array.isArray(topTracksRes.items)) {
    for (const track of topTracksRes.items) {
      if (Array.isArray(track.artists)) {
        for (const a of track.artists) {
          if (a.name) artistSet.add(a.name);
        }
      }
    }
  }

  const sortedGenres = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);

  const topArtists = Array.from(artistSet).slice(0, 30);
  const now = new Date().toISOString();

  upsertProfile.run({
    user_id: userId,
    top_genres_json: JSON.stringify(sortedGenres.slice(0, 20)),
    top_artists_json: JSON.stringify(topArtists),
    last_synced_at: now,
  });

  return {
    synced: true,
    top_genres: sortedGenres.slice(0, 20),
    top_artists: topArtists,
    last_synced_at: now,
  };
}

/**
 * Get cached music profile for a user.
 */
function getUserMusicProfile(userId) {
  if (!userId) return null;
  const row = selectProfile.get(userId);
  if (!row) return null;

  try {
    return {
      top_genres: JSON.parse(row.top_genres_json || '[]'),
      top_artists: JSON.parse(row.top_artists_json || '[]'),
      last_synced_at: row.last_synced_at,
    };
  } catch {
    return null;
  }
}

module.exports = {
  syncUserProfile,
  getUserMusicProfile,
};
