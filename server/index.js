const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const db = require('./db');
const auth = require('./auth');
const vocabRouter = require('./routes/vocab');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
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

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await auth.comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = auth.generateAccessToken(user);
    const refreshToken = auth.generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.sendStatus(401);

  try {
    const decoded = auth.verifyRefreshToken(refreshToken);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    
    if (!user) return res.sendStatus(401);

    const accessToken = auth.generateAccessToken(user);
    const newRefreshToken = auth.generateRefreshToken(user);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken });
  } catch (err) {
    return res.sendStatus(403);
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
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
      preview: data.preview,
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

// --- Vocabulary Endpoints ---
app.use('/api/vocab', authenticateToken, vocabRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
