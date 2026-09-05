const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const db = require('./db');
const auth = require('./auth');
const vocabRouter = require('./routes/vocab');
const studyRouter = require('./routes/study');
const progressRouter = require('./routes/progress');
const validationRouter = require('./routes/validation');
const dailyWordRouter = require('./routes/dailyWord');
const playlistsRouter = require('./routes/playlists');
const badgesRouter = require('./routes/badges');
const userRouter = require('./routes/user');
const audioRouter = require('./routes/audio');
const passwordRoutes = require('./routes/password');
const { protectedRouter: spotifyProtectedRouter, callbackRouter: spotifyCallbackRouter } = require('./routes/spotify');
const { publicRouter: sharePublicRouter, protectedRouter: shareProtectedRouter } = require('./routes/share');
const {
  isSocialCrawler,
  getPostcardById,
  publicBaseUrl,
  buildCrawlerHtml,
} = require('./services/shareOg');
const deezer = require('./services/deezerService');
require('dotenv').config();
const ttsDaemon = require('./services/ttsDaemon');
// Default to Spanish HQ model — matches most Harmonix learners and avoids a
// cold english→spanish reload on the first pronunciation click.
const defaultTtsLang = process.env.POCKET_TTS_DEFAULT_LANGUAGE || 'spanish_24l';
ttsDaemon.start(defaultTtsLang);

const {
  corsOrigin,
  securityHeaders,
  authLimiter,
  pronounceLimiter,
  publicProxyLimiter,
  validateRegistration,
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

/** Cookie options that work in WebView over ngrok HTTPS (Capacitor). */
function authCookieOptions(req) {
  const secure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.FORCE_SECURE_COOKIES === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
// Reflecting every Origin with credentials let any site call the API with the
// user's cookies. Only same-origin, dev servers, and CORS_ORIGINS are allowed.
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  try {
    const user = auth.verifyAccessToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
};

app.use('/api/auth', passwordRoutes(authenticateToken));

// --- Auth Endpoints ---

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  console.log('POST /api/auth/register - received');
  const checked = validateRegistration(req.body?.email, req.body?.password);
  if (checked.error) {
    return res.status(400).json({ error: checked.error });
  }
  const { email, password } = checked;

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = nanoid();
    const passwordHash = await auth.hashPassword(password);

    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
      .run(id, email, passwordHash);

    console.log('POST /api/auth/register - success');
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('POST /api/auth/register - error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  console.log('POST /api/auth/login - received');
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      || db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email.toLowerCase());
    if (!user) {
      console.log('POST /api/auth/login - user not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await auth.comparePassword(password, user.password_hash);
    if (!isMatch) {
      console.log('POST /api/auth/login - invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = auth.generateAccessToken(user);
    const refreshToken = auth.generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, authCookieOptions(req));

    console.log('POST /api/auth/login - success');
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        native_language: user.native_language,
        target_language: user.target_language,
        genre: user.genre,
        difficulty: user.difficulty,
        cefr_level: user.cefr_level,
      },
    });
  } catch (err) {
    console.error('POST /api/auth/login - error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', authLimiter, (req, res) => {
  console.log('POST /api/auth/refresh - received');
  const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    console.log('POST /api/auth/refresh - no refresh token');
    return res.sendStatus(401);
  }

  try {
    const decoded = auth.verifyRefreshToken(refreshToken);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) {
      console.log('POST /api/auth/refresh - user not found');
      return res.sendStatus(401);
    }

    const accessToken = auth.generateAccessToken(user);
    const newRefreshToken = auth.generateRefreshToken(user);

    res.cookie('refreshToken', newRefreshToken, authCookieOptions(req));

    console.log('POST /api/auth/refresh - success');
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.log('POST /api/auth/refresh - error:', err.message);
    return res.sendStatus(403);
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  console.log('GET /api/auth/me - for user:', req.user.id);
  const user = db.prepare('SELECT id, email, created_at, cefr_level, target_language, genre, difficulty, native_language, voice_gender FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  const spotify = db.prepare('SELECT spotify_user_id, spotify_display_name FROM user_spotify_tokens WHERE user_id = ?').get(req.user.id);
  user.is_spotify_connected = !!spotify;
  user.spotify_user_id = spotify?.spotify_user_id || null;
  user.spotify_display_name = spotify?.spotify_display_name || null;
  res.json(user);
});


// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('refreshToken', authCookieOptions(req));
  res.json({ message: 'Logged out successfully' });
});

// --- Media Proxy Endpoints ---

// Deezer Search
app.get('/api/search', publicProxyLimiter, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': process.env.DEEZER_USER_AGENT || 'Mozilla/5.0 (compatible; Harmonix/1.7; +https://harmonix.app)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Deezer search failed (${response.status})` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch from Deezer' });
  }
});

// Track Metadata + Offset Calculation (Deezer numeric ids or itunes_* fallback ids)
app.get('/api/tracks/:id', publicProxyLimiter, async (req, res) => {
  const { id } = req.params;

  try {
    // iTunes-sourced daily words use itunes_* ids — resolve via deezerService, not Deezer /track/:id
    if (deezer.isItunesTrackId?.(id)) {
      const track = await deezer.fetchTrack(id);
      if (!track?.preview) {
        return res.status(404).json({ error: 'No audio preview available for this track' });
      }
      const duration = track.duration || 0;
      let previewOffset = 0;
      if (duration > 60) previewOffset = 30;
      else if (duration > 30) previewOffset = duration - 30;
      return res.json({
        id: track.id,
        title: track.title,
        artist: track.artist,
        preview: deezer.previewProxyPath(track.id, track.artist, track.title),
        duration,
        preview_offset: previewOffset,
        cover: track.cover || null,
      });
    }

    const response = await fetch(`https://api.deezer.com/track/${id}`, {
      headers: {
        'User-Agent': process.env.DEEZER_USER_AGENT || 'Mozilla/5.0 (compatible; Harmonix/1.7; +https://harmonix.app)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Track not found on Deezer' });
    
    const data = await response.json();
    if (data.error) return res.status(404).json({ error: data.error.message });
    if (!data.preview) return res.status(404).json({ error: 'No audio preview available for this track' });

    const duration = data.duration;
    let previewOffset = 0;

    if (duration > 60) {
      previewOffset = 30;
    } else if (duration > 30) {
      previewOffset = duration - 30;
    } else {
      previewOffset = 0;
    }

    res.json({
      id: data.id,
      title: data.title,
      artist: data.artist.name,
      preview: deezer.previewProxyPath(data.id),
      duration: duration,
      preview_offset: previewOffset,
      cover: deezer.coverFromDeezerTrack(data),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch track from Deezer' });
  }
});

// LRCLib Lyric Proxy
app.get('/api/lyrics', publicProxyLimiter, async (req, res) => {
  const { artist_name, track_name, album_name, duration } = req.query;

  if (!artist_name || !track_name) {
    return res.status(400).json({ error: 'artist_name and track_name are required' });
  }

  try {
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.append('artist_name', artist_name);
    url.searchParams.append('track_name', track_name);
    if (album_name) url.searchParams.append('album_name', album_name);
    if (duration) url.searchParams.append('duration', duration);

    const response = await fetch(url.toString());
    
    if (response.status === 404) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }

    const data = await response.json();
    res.json({ syncedLyrics: data.syncedLyrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lyrics from LRCLib' });
  }
});

// --- Audio preview proxy (same-origin; Deezer CDN URLs expire) ---
app.use('/api/audio', audioRouter);

// --- Vocabulary Endpoints ---
const adminRouter = require('./routes/admin');
app.use('/api/vocab', authenticateToken, vocabRouter);
app.use('/api/study', authenticateToken, studyRouter);
app.use('/api/progress', authenticateToken, progressRouter);
app.use('/api/validation', authenticateToken, validationRouter);
// Allow public pronunciation lookup for daily words; require authentication for other daily-word routes
app.use('/api/daily-word', (req, res, next) => {
  if (req.path === '/pronounce') return pronounceLimiter(req, res, next);
  authenticateToken(req, res, next);
}, dailyWordRouter);
app.use('/api/playlists', authenticateToken, playlistsRouter);
app.use('/api/badges', authenticateToken, badgesRouter);
app.use('/api/user', authenticateToken, userRouter);
app.use('/api/admin', authenticateToken, adminRouter);

// Public word postcards (no account) + authenticated create
app.use('/api/share', sharePublicRouter);
app.use('/api/share', authenticateToken, shareProtectedRouter);

// Spotify — public callback must mount before authenticated /api/spotify routes
app.use('/api/spotify/oauth', spotifyCallbackRouter);
app.use('/api/spotify', authenticateToken, spotifyProtectedRouter);

// Spotify short redirect alias (Dashboard-friendly)
// Spotify Dashboard often fails with long paths; /callback aliases the OAuth handler.
app.get("/callback", (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  res.redirect(302, `/api/spotify/oauth/callback${q ? `?${q}` : ""}`);
});

// Social crawlers (WhatsApp, etc.) get static OG HTML — no JS, no account.
app.get('/share/:id', (req, res, next) => {
  if (!isSocialCrawler(req.get('user-agent'))) return next();
  const card = getPostcardById(req.params.id);
  if (!card) return next();
  const html = buildCrawlerHtml(card, publicBaseUrl(req));
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
  return res.status(200).send(html);
});

// --- Frontend Proxy ---
// In Docker/Coolify, Next runs as a sibling service (e.g. http://web:3009).
const { createProxyMiddleware } = require('http-proxy-middleware');
const frontendTarget = process.env.FRONTEND_PROXY_TARGET || 'http://127.0.0.1:3009';
app.use('/', createProxyMiddleware({
  target: frontendTarget,
  changeOrigin: true,
  ws: true,
}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (frontend proxy → ${frontendTarget})`);
  if (process.env.NODE_ENV !== 'test') {
    try {
      const glossCache = require('./services/glossCacheService');
      const { translationLooksSuspicious } = require('./services/aiService');
      const inserted = glossCache.backfillFromDailyWords({
        isSuspicious: translationLooksSuspicious,
      });
      if (inserted > 0) {
        console.log(`gloss cache: warmed ${inserted} historical meanings (${glossCache.count()} total)`);
      }
      const { commonGlossLookup } = require("./services/aiService");
      const filled = glossCache.fillThinStoredWords(commonGlossLookup);
      if (filled.updated > 0) {
        console.log(`gloss cache: filled ${filled.updated} stored words that had no meaning`);
      }
    } catch (err) {
      console.warn(`gloss cache backfill skipped: ${err.message || err}`);
    }
  }
});
