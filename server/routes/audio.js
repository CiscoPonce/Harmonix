const express = require('express');
const { Readable } = require('stream');
const deezer = require('../services/deezerService');

const router = express.Router();

router.get('/preview/:trackId', async (req, res) => {
  const { trackId } = req.params;

  try {
    const track = await deezer.fetchTrack(trackId);
    const upstreamHeaders = {};
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    const audioRes = await fetch(track.preview, { headers: upstreamHeaders });
    if (!audioRes.ok) {
      return res.status(audioRes.status === 404 ? 404 : 502).json({
        error: 'preview_fetch_failed',
      });
    }

    res.status(audioRes.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = audioRes.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (!audioRes.body) {
      return res.status(502).json({ error: 'preview_empty' });
    }

    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    if (err.code === 'no_preview') {
      return res.status(404).json({ error: 'no_preview_available' });
    }
    if (err.code === 'track_not_found') {
      return res.status(404).json({ error: 'track_not_found' });
    }
    console.error('GET /api/audio/preview/:trackId error:', err.message);
    res.status(500).json({ error: 'preview_stream_failed' });
  }
});

module.exports = router;
