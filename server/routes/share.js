'use strict';

const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { resolvePlayableSpotifyTrack } = require('../services/spotifyPlayResolve');
const {
  getPostcardById,
  buildPostcardPng,
  postcardSeo,
} = require('../services/shareOg');

const publicRouter = express.Router();
const protectedRouter = express.Router();

function spotifyUriToWebUrl(uri) {
  const m = String(uri || '').match(/^spotify:track:([A-Za-z0-9]+)$/);
  return m ? `https://open.spotify.com/track/${m[1]}` : null;
}

function spotifySearchUrl(artist, title) {
  const q = [artist, title].filter(Boolean).join(' ').trim();
  if (!q) return null;
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}

function sanitizePostcardInput(body = {}) {
  const wordText = String(body.word?.text || '').trim().slice(0, 80);
  if (!wordText) {
    const err = new Error('word.text is required');
    err.status = 400;
    throw err;
  }

  const songTitle = String(body.song?.title || '').trim().slice(0, 200);
  const songArtist = String(body.song?.artist || '').trim().slice(0, 200);
  if (!songTitle || !songArtist) {
    const err = new Error('song.title and song.artist are required');
    err.status = 400;
    throw err;
  }

  const snippet = String(body.lyric?.snippet || '').trim().slice(0, 500);
  const charStart = Number.isFinite(Number(body.lyric?.char_start))
    ? Math.max(0, Math.floor(Number(body.lyric.char_start)))
    : 0;
  const charEnd = Number.isFinite(Number(body.lyric?.char_end))
    ? Math.max(charStart, Math.floor(Number(body.lyric.char_end)))
    : charStart;

  return {
    word: {
      text: wordText,
      translation: String(body.word?.translation || '').trim().slice(0, 200) || null,
      pronunciation: String(body.word?.pronunciation || '').trim().slice(0, 80) || null,
      part_of_speech: String(body.word?.part_of_speech || '').trim().slice(0, 40) || null,
    },
    lyric: snippet
      ? {
          snippet,
          char_start: charStart,
          char_end: Math.min(charEnd, snippet.length),
        }
      : null,
    song: {
      id: body.song?.id != null ? String(body.song.id).slice(0, 64) : null,
      title: songTitle,
      artist: songArtist,
    },
  };
}

async function resolveSpotifyShareUrl(userId, song) {
  try {
    const resolved = await resolvePlayableSpotifyTrack(userId, {
      title: song.title,
      artist: song.artist,
      song_id: song.id,
    });
    const fromUri = spotifyUriToWebUrl(resolved?.uri);
    if (fromUri) return fromUri;
  } catch {
    /* fall through to search link */
  }
  return spotifySearchUrl(song.artist, song.title);
}

/** GET /api/share/postcards/:id — public postcard snapshot (no account). */
publicRouter.get('/postcards/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length > 40) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  const card = getPostcardById(id);
  if (!card) return res.status(404).json({ error: 'not_found' });
  return res.json(card);
});

/** GET /api/share/postcards/:id/og.png — Open Graph image for WhatsApp / iMessage. */
publicRouter.get('/postcards/:id/og.png', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const card = getPostcardById(id);
  if (!card) return res.status(404).json({ error: 'not_found' });

  // Prefer the Next.js designed OG card when the frontend is up.
  try {
    const upstream = await fetch(
      `http://127.0.0.1:3009/share/${encodeURIComponent(id)}/opengraph-image`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (upstream.ok) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set({
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      });
      return res.send(buf);
    }
  } catch {
    /* fall through to local PNG */
  }

  try {
    const png = buildPostcardPng(card);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Disposition': `inline; filename="harmonix-${id}.png"`,
    });
    return res.send(png);
  } catch (err) {
    console.error('OG png error:', err.message);
    return res.status(500).json({ error: 'og_failed' });
  }
});

/** GET /api/share/postcards/:id/meta — SEO helpers for the Next share page. */
publicRouter.get('/postcards/:id/meta', (req, res) => {
  const card = getPostcardById(String(req.params.id || '').trim());
  if (!card) return res.status(404).json({ error: 'not_found' });
  return res.json({ card, seo: postcardSeo(card) });
});

/** POST /api/share/postcards — create a shareable word postcard. */
protectedRouter.post('/postcards', async (req, res) => {
  try {
    const core = sanitizePostcardInput(req.body);
    const spotifyUrl = await resolveSpotifyShareUrl(req.user.id, core.song);
    const id = nanoid(12);
    const payload = { ...core, spotify_url: spotifyUrl };

    db.prepare(
      `INSERT INTO shared_postcards (id, user_id, payload_json, spotify_url)
       VALUES (?, ?, ?, ?)`
    ).run(id, req.user.id, JSON.stringify(payload), spotifyUrl);

    return res.status(201).json({
      id,
      path: `/share/${id}`,
      spotify_url: spotifyUrl,
      word: core.word,
      lyric: core.lyric,
      song: core.song,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('POST /api/share/postcards error:', err.message);
    }
    return res.status(status).json({ error: err.message || 'share_failed' });
  }
});

module.exports = {
  publicRouter,
  protectedRouter,
  spotifyUriToWebUrl,
  spotifySearchUrl,
  sanitizePostcardInput,
};
