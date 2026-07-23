const express = require('express');
const { Readable } = require('stream');
const deezer = require('../services/deezerService');
const validation = require('../services/validationService');

const router = express.Router();

router.get('/preview/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const artistQ = typeof req.query.artist === 'string' ? req.query.artist : '';
  const titleQ = typeof req.query.title === 'string' ? req.query.title : '';

  try {
    const cached = validation.getCachedSong(String(trackId));
    const cachedTrack = cached?.track || {};
    const artist = artistQ || cachedTrack.artist || cachedTrack.artist_name || '';
    const title = titleQ || cachedTrack.title || cachedTrack.track_name || '';
    const cachedPreview = cachedTrack.preview || null;

    const { previewUrl } = await deezer.resolvePreviewForTrackId(
      trackId,
      { artist, title, cachedPreview }
    );

    const upstreamHeaders = { ...deezer.PREVIEW_STREAM_HEADERS };
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    let audioRes = await fetch(previewUrl, { headers: upstreamHeaders });
    let provider = deezer.isItunesTrackId(trackId)
      || (previewUrl && String(previewUrl).includes('itunes.apple.com'))
      ? 'itunes'
      : 'deezer';

    // Deezer CDN often geo-blocks cloud IPs; retry via iTunes when we know the song.
    if (!audioRes.ok && artist && title && !deezer.isItunesTrackId(trackId)) {
      const itunes = await deezer.searchItunesTrack(artist, title);
      if (itunes?.preview) {
        audioRes = await fetch(itunes.preview, {
          headers: { ...deezer.PREVIEW_STREAM_HEADERS, ...(req.headers.range ? { Range: req.headers.range } : {}) },
        });
        if (audioRes.ok) provider = 'itunes';
      }
    }

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
    res.setHeader('X-Harmonix-Preview-Provider', provider);
    res.setHeader('Access-Control-Expose-Headers', 'X-Harmonix-Preview-Provider');

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
