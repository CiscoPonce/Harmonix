const express = require('express');
const router = express.Router();
const validation = require('../services/validationService');

router.get('/status/:songId', (req, res) => {
 const { songId } = req.params;
 const record = validation.getValidation(songId);
 if (!record) return res.json({ validated: false });
 res.json({
 validated: true,
 song_id: record.song_id,
 lrc_valid: !!record.lrc_valid,
 score: record.score,
 checked_at: record.lrc_checked_at
 });
});

router.post('/check/:songId', async (req, res) => {
 const { songId } = req.params;
 try {
 const cached = validation.getCachedSong(songId);
 if (cached && cached.track && cached.lyrics) {
 const result = validation.validateSongSync(cached.track, cached.lyrics.syncedLyrics || cached.lyrics.plainLyrics);
 validation.recordValidation(songId, cached.track.artist, cached.track.title, cached.track.duration, result);
 return res.json({ song_id: songId, ...result });
 }

 const trackRes = await fetch(`https://api.deezer.com/track/${songId}`);
 if (!trackRes.ok) return res.status(trackRes.status).json({ error: 'track_not_found' });
 const trackData = await trackRes.json();
 if (trackData.error) return res.status(404).json({ error: 'track_not_found' });

 const track = {
 id: trackData.id,
 artist_name: trackData.artist?.name,
 track_name: trackData.title,
 duration: trackData.duration
 };

 const lyricsUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist_name)}&track_name=${encodeURIComponent(track.track_name)}&duration=${track.duration}`;
 const lyricsRes = await fetch(lyricsUrl);

 let lyricsData = null;
 if (lyricsRes.ok) {
 lyricsData = await lyricsRes.json();
 } else {
 const fallback = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist_name)}&track_name=${encodeURIComponent(track.track_name)}`);
 if (fallback.ok) lyricsData = await fallback.json();
 }

 if (!lyricsData || (!lyricsData.syncedLyrics && !lyricsData.plainLyrics)) {
 const result = { valid: false, issues: ['missing_lyrics'], score: 0 };
 validation.recordValidation(songId, track.artist_name, track.track_name, track.duration, result);
 validation.cacheSongData(songId, null, track);
 return res.json({ song_id: songId, ...result });
 }

 const lrc = lyricsData.syncedLyrics || lyricsData.plainLyrics;
 const result = validation.validateSongSync(track, lrc);
 validation.recordValidation(songId, track.artist_name, track.track_name, track.duration, result);
 validation.cacheSongData(songId, lyricsData, track);

 res.json({ song_id: songId, ...result });
 } catch (err) {
 console.error('validation error:', err);
 res.status(500).json({ error: 'internal_error' });
 }
});

module.exports = router;
