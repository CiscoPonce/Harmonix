const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../db');
const badgeService = require('../services/badgeService');

router.get('/', (req, res) => {
  const userId = req.user.id;
  try {
    const playlists = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
      FROM playlists p
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(userId);
    res.json({ playlists });
  } catch (err) {
    console.error('GET /api/playlists error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }
  const trimmed = name.trim().slice(0, 100);
  try {
    const id = nanoid();
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, trimmed);
    const badges_unlocked = badgeService.checkAndUnlockBadges(userId);
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    res.status(201).json({ playlist, badges_unlocked });
  } catch (err) {
    console.error('POST /api/playlists error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  const userId = req.user.id;
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const songs = db.prepare(`
      SELECT ps.id as entry_id, ps.song_id, ps.added_at,
             COALESCE(sc.track_json, '{}') as track_data
      FROM playlist_songs ps
      LEFT JOIN song_cache sc ON sc.song_id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY ps.added_at DESC
    `).all(req.params.id);
    res.json({ ...playlist, songs });
  } catch (err) {
    console.error('GET /api/playlists/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }
  try {
    const existing = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) return res.status(404).json({ error: 'Playlist not found' });
    db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name.trim().slice(0, 100), req.params.id);
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
    res.json({ playlist });
  } catch (err) {
    console.error('PUT /api/playlists/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  try {
    const existing = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) return res.status(404).json({ error: 'Playlist not found' });
    db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    console.error('DELETE /api/playlists/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/songs', (req, res) => {
  const userId = req.user.id;
  const { song_id } = req.body;
  if (!song_id) return res.status(400).json({ error: 'song_id is required' });
  try {
    const existing = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) return res.status(404).json({ error: 'Playlist not found' });
    const id = nanoid();
    db.prepare('INSERT INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)').run(id, req.params.id, song_id);
    const entry = db.prepare('SELECT * FROM playlist_songs WHERE id = ?').get(id);
    res.status(201).json({ entry });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Song already in playlist' });
    }
    console.error('POST /api/playlists/:id/songs error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/songs/:songId', (req, res) => {
  const userId = req.user.id;
  try {
    const existing = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) return res.status(404).json({ error: 'Playlist not found' });
    db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').run(req.params.id, req.params.songId);
    res.json({ message: 'Song removed from playlist' });
  } catch (err) {
    console.error('DELETE /api/playlists/:id/songs/:songId error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
