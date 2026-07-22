'use strict';

const db = require('../db');
const { safeSpotifyExternalUrl } = require('./spotifyService');

function isSocialCrawler(userAgent) {
  const ua = String(userAgent || '');
  // Broad match: WhatsApp/Meta often use variants; empty UA sometimes used by preview bots.
  if (!ua.trim()) return true;
  return /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|skypeuripreview|embedly|quora link preview|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|meta-externalagent|meta-externalads|instagram|pinterestbot/i.test(
    ua
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPostcardById(id) {
  const key = String(id || '').trim();
  if (!key || key.length > 40) return null;
  const row = db.prepare('SELECT * FROM shared_postcards WHERE id = ?').get(key);
  if (!row) return null;
  let payload;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    return null;
  }
  return {
    id: row.id,
    word: payload.word,
    lyric: payload.lyric,
    song: payload.song,
    cover: payload.cover || null,
    spotify_url: safeSpotifyExternalUrl(row.spotify_url) || payload.spotify_url || null,
    created_at: row.created_at,
  };
}

function postcardSeo(card) {
  const word = String(card?.word?.text || 'Word').trim();
  const meaning = String(card?.word?.translation || '').trim();
  const title = meaning ? `${word} · ${meaning}` : word;
  const songLine =
    card?.song?.title && card?.song?.artist
      ? `${card.song.title} — ${card.song.artist}`
      : '';
  const description = [
    meaning ? `Meaning: ${meaning}` : null,
    songLine ? `From ${songLine}` : null,
    'Learn vocabulary through real song lyrics on Harmonix.',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    title: `${title} | Harmonix`,
    ogTitle: title,
    description,
    songLine,
  };
}

function publicBaseUrl(req) {
  const proto =
    req.get('x-forwarded-proto') ||
    (req.secure ? 'https' : 'http');
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3001';
  return `${proto}://${host}`.replace(/\/$/, '');
}

/** Minimal HTML for WhatsApp / Facebook / Slack link unfurling. */
function buildCrawlerHtml(card, baseUrl) {
  const seo = postcardSeo(card);
  const pageUrl = `${baseUrl}/share/${encodeURIComponent(card.id)}`;
  // Cache-busted image URL helps WhatsApp refetch after OG improvements.
  const imageUrl = `${baseUrl}/api/share/postcards/${encodeURIComponent(card.id)}/og.png?v=3`;
  const word = escapeHtml(card.word?.text || '');
  const meaning = escapeHtml(card.word?.translation || '');
  const song = escapeHtml(seo.songLine);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeHtml(seo.description)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Harmonix" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(seo.ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(seo.description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(seo.ogTitle)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(seo.ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <link rel="image_src" href="${escapeHtml(imageUrl)}" />
</head>
<body style="margin:0;background:#06140e;color:#f2f5f3;font-family:Georgia,serif;">
  <main style="max-width:28rem;margin:0 auto;padding:3rem 1.5rem;">
    <p style="letter-spacing:.3em;text-transform:uppercase;font-size:10px;color:#3dcf7a;">Harmonix postcard</p>
    <h1 style="font-size:3rem;margin:.5rem 0 0;">${word}</h1>
    ${meaning ? `<p style="font-size:1.25rem;color:#a7f3d0;">${meaning}</p>` : ''}
    ${song ? `<p style="margin-top:2rem;color:#a1a1aa;">${song}</p>` : ''}
    <p><a href="${escapeHtml(pageUrl)}" style="color:#3dcf7a;">Open postcard</a></p>
  </main>
</body>
</html>`;
}

/**
 * Build a real PNG (1200×630) without native deps — uncompressed truecolor + tEXt-free.
 * Enough for WhatsApp / iMessage OG previews.
 */
function buildPostcardPng(card) {
  const width = 1200;
  const height = 630;
  const word = String(card?.word?.text || 'Word').slice(0, 28);
  const meaning = String(card?.word?.translation || '').slice(0, 40);
  const song = card?.song?.title && card?.song?.artist
    ? `${card.song.title} — ${card.song.artist}`.slice(0, 48)
    : '';

  // Pixel buffer RGB
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      // Deep forest gradient
      const t = y / height;
      const side = Math.abs(x / width - 0.5);
      pixels[i] = Math.floor(6 + t * 18 + (1 - side) * 8); // R
      pixels[i + 1] = Math.floor(20 + t * 40 + (1 - side) * 30); // G
      pixels[i + 2] = Math.floor(14 + t * 22); // B
      // Soft vignette glow top-center
      const dx = (x - width / 2) / width;
      const dy = (y - height * 0.2) / height;
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx * 4 + dy * dy * 6));
      pixels[i] = Math.min(255, pixels[i] + Math.floor(glow * 25));
      pixels[i + 1] = Math.min(255, pixels[i + 1] + Math.floor(glow * 70));
      pixels[i + 2] = Math.min(255, pixels[i + 2] + Math.floor(glow * 35));
    }
  }

  // Draw text as blocky bitmap font (5x7) — readable at OG size for short words
  const glyph = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
    C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
    F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
    G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
    K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
    N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
    R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    W: [0b10001, 0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b01010],
    X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
    a: [0b00000, 0b00000, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111],
    e: [0b00000, 0b00000, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
    i: [0b00100, 0b00000, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
    o: [0b00000, 0b00000, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
    u: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101],
    n: [0b00000, 0b00000, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001],
    r: [0b00000, 0b00000, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000],
    s: [0b00000, 0b00000, 0b01110, 0b10000, 0b01110, 0b00001, 0b11110],
    t: [0b01000, 0b01000, 0b11100, 0b01000, 0b01000, 0b01001, 0b00110],
    l: [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    '·': [0b00000, 0b00000, 0b00100, 0b00000, 0b00000, 0b00000, 0b00000],
    '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
    '—': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
    '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b00100],
    ',': [0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b00100, 0b01000],
    "'": [0b00100, 0b00100, 0b01000, 0b00000, 0b00000, 0b00000, 0b00000],
    ':': [0b00000, 0b00100, 0b00000, 0b00000, 0b00100, 0b00000, 0b00000],
  };

  function setPixel(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }

  function drawText(text, startX, startY, scale, rgb) {
    let x = startX;
    const normalized = String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const ch of normalized) {
      const rows = glyph[ch] || glyph[ch.toUpperCase()] || glyph['·'];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (rows[row] & (1 << (4 - col))) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                setPixel(x + col * scale + sx, startY + row * scale + sy, rgb[0], rgb[1], rgb[2]);
              }
            }
          }
        }
      }
      x += 6 * scale;
    }
  }

  const wordScale = word.length > 12 ? 6 : word.length > 8 ? 8 : word.length > 5 ? 9 : 11;
  drawText('HARMONIX  WORD POSTCARD', 80, 64, 3, [120, 220, 160]);
  drawText(word.toUpperCase(), 80, 170, wordScale, [255, 255, 255]);
  if (meaning) {
    drawText(meaning, 80, 170 + 7 * wordScale + 36, 5, [180, 240, 210]);
  }
  if (song) {
    drawText(song, 80, 520, 3, [180, 180, 180]);
  }

  return rgbToPng(pixels, width, height);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function rgbToPng(rgb, width, height) {
  // Filter byte 0 per row + RGB
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = {
  isSocialCrawler,
  getPostcardById,
  postcardSeo,
  publicBaseUrl,
  buildCrawlerHtml,
  buildPostcardPng,
  escapeHtml,
};
