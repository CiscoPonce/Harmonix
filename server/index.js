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
const deezer = require('./services/deezerService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

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

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
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

// --- Auth Endpoints ---

// Register
app.post('/api/auth/register', async (req, res) => {
  console.log('POST /api/auth/register - received');
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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
app.post('/api/auth/login', async (req, res) => {
  console.log('POST /api/auth/login - received');
  const { email, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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
    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('POST /api/auth/login - error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', (req, res) => {
  console.log('POST /api/auth/refresh - received');
  const refreshToken = req.cookies.refreshToken;
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
    res.json({ accessToken });
  } catch (err) {
    console.log('POST /api/auth/refresh - error:', err.message);
    return res.sendStatus(403);
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  console.log('GET /api/auth/me - for user:', req.user.id);
  const user = db.prepare('SELECT id, email, created_at, cefr_level, target_language, genre, difficulty, native_language FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
});


// Reset Password (MVP — no email verification)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }
    const passwordHash = await auth.hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, user.id);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('POST /api/auth/reset-password - error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('refreshToken', authCookieOptions(req));
  res.json({ message: 'Logged out successfully' });
});

// --- Media Proxy Endpoints ---

// Deezer Search
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch from Deezer' });
  }
});

// Deezer Track Metadata + Offset Calculation
app.get('/api/tracks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const response = await fetch(`https://api.deezer.com/track/${id}`);
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
      preview_offset: previewOffset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch track from Deezer' });
  }
});

// LRCLib Lyric Proxy
app.get('/api/lyrics', async (req, res) => {
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
app.use('/api/vocab', authenticateToken, vocabRouter);
app.use('/api/study', authenticateToken, studyRouter);
app.use('/api/progress', authenticateToken, progressRouter);
app.use('/api/validation', authenticateToken, validationRouter);
app.use('/api/daily-word', authenticateToken, dailyWordRouter);
app.use('/api/playlists', authenticateToken, playlistsRouter);
app.use('/api/badges', authenticateToken, badgesRouter);
app.use('/api/user', authenticateToken, userRouter);

// --- Frontend Proxy ---
const { createProxyMiddleware } = require('http-proxy-middleware');
app.use('/', createProxyMiddleware({
  target: 'http://127.0.0.1:3009',
  changeOrigin: true,
  ws: true,
}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
