# Phase 11: Word Phonics TTS Integration - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 7
**Analogs found:** 6 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/services/ttsService.js` (NEW) | service | request-response | `server/routes/audio.js` | role-match |
| `server/services/ttsDaemon.js` (NEW) | service | event-driven | — | no analog |
| `server/routes/dailyWord.js` | controller | request-response | `server/routes/dailyWord.js` (self) | exact |
| `server/db.js` | migration | CRUD | `server/db.js` (self) | exact |
| `client/src/components/DailyWordCard.tsx` | component | request-response | `client/src/components/DailyWordCard.tsx` (self) | exact |
| `server/services/wordQueueService.js` | service | event-driven | `server/services/wordQueueService.js` (self) | exact |
| `server/routes/dailyWord.test.js` | test | — | `server/routes/dailyWord.test.js` (self) | exact |

## Pattern Assignments

### `server/services/ttsService.js` (service, request-response)

**Analog:** `server/routes/audio.js` (audio proxy pattern)

**Imports pattern** (lines 1-5):
```javascript
const express = require('express');
const { Readable } = require('stream');
const deezer = require('../services/deezerService');
```

**Core proxy pattern** — proxy external audio service through Express, returning audio/wav:
```javascript
// server/routes/audio.js lines 7-46 — proxy pattern to adapt
router.get('/preview/:trackId', async (req, res) => {
  const { trackId } = req.params;
  try {
    const track = await deezer.fetchTrack(trackId);
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
    // error handling pattern: specific error codes → specific HTTP status
    if (err.code === 'no_preview') {
      return res.status(404).json({ error: 'no_preview_available' });
    }
    console.error('GET /api/audio/preview/:trackId error:', err.message);
    res.status(500).json({ error: 'preview_stream_failed' });
  }
});
```

**Adaptation for ttsService.js:** This file should export functions (not a router) that:
1. `getCachedPronunciation(word)` — SQLite query to `word_pronunciation_cache`
2. `fetchPronunciation(word, voiceUrl)` — POST to `http://127.0.0.1:3002/tts` with form data
3. `cachePronunciation(word, audioBlob)` — INSERT into `word_pronunciation_cache`
4. `padWavWithSilence(wavBuffer)` — Buffer manipulation per RESEARCH.md Pattern 2
5. `getPronunciationForWord(word, langCode)` — orchestrator: check cache → fetch → pad → cache → return

**Key patterns to copy:**
- `fetch()` to external service (lines 17-23)
- Error handling with specific error codes (lines 37-44)
- `res.setHeader('Content-Type', 'audio/wav')` for audio responses
- `res.setHeader('Cache-Control', 'private, max-age=86400')` for immutable content

**WAV silence padding pattern** (from RESEARCH.md):
```javascript
function padWavWithSilence(wavBuffer, sampleRate = 24000, silenceSeconds = 1) {
  const HEADER_SIZE = 44;
  const BYTES_PER_SAMPLE = 2;
  const silenceBytes = sampleRate * silenceSeconds * BYTES_PER_SAMPLE;
  const silence = Buffer.alloc(silenceBytes, 0);
  const pcmData = wavBuffer.subarray(HEADER_SIZE);
  const paddedPcm = Buffer.concat([silence, pcmData, silence]);
  const result = Buffer.alloc(HEADER_SIZE + paddedPcm.length);
  wavBuffer.copy(result, 0, 0, HEADER_SIZE);
  paddedPcm.copy(result, HEADER_SIZE);
  result.writeUInt32LE(result.length - 8, 4);
  result.writeUInt32LE(paddedPcm.length, 40);
  return result;
}
```

**DB interaction pattern** — copy from `server/db.js`:
```javascript
// server/db.js lines 1-3 — import pattern
const db = require('../db');

// Query pattern (used throughout db.js, e.g. line 80)
db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_canonical_key ON vocab_items(canonical_key)");

// INSERT pattern with OR IGNORE (line 342)
db.prepare('INSERT OR IGNORE INTO badges ...');
```

---

### `server/services/ttsDaemon.js` (service, event-driven)

**No analog found.** This is a new pattern for the project.

**Reference pattern from RESEARCH.md:**
```javascript
const { spawn } = require("child_process");

class TTSDaemon {
  constructor() {
    this.process = null;
    this.port = 3002;
    this.host = "127.0.0.1";
  }

  start(language = "english") {
    if (this.process) return;
    this.process = spawn("pocket-tts", [
      "serve", "--host", this.host, "--port", String(this.port),
      "--language", language,
    ], { stdio: "pipe" });
    this.process.stderr?.on("data", (d) => {
      if (d.includes("Uvicorn running")) this.ready = true;
    });
  }

  async healthCheck() {
    try {
      const res = await fetch(`http://${this.host}:${this.port}/health`);
      return res.ok;
    } catch { return false; }
  }
}
```

**Service module pattern** — copy from `server/services/wordQueueService.js`:
```javascript
// wordQueueService.js lines 1-1 — import pattern
const db = require("../db");

// wordQueueService.js lines 192-212 — export pattern
module.exports = {
  REFILL_THRESHOLD,
  // ... exported functions
};
```

---

### `server/routes/dailyWord.js` (controller, request-response — MODIFY)

**Self-reference:** This file already exists. Add a new `GET /pronounce` route.

**Imports pattern** (lines 1-5):
```javascript
const express = require("express");
const router = express.Router();
const db = require("../db");
const dailyWordService = require("../services/dailyWordService");
const wordQueue = require("../services/wordQueueService");
```

**Route handler pattern** (lines 35-38 — simple GET):
```javascript
router.get("/recent", (req, res) => {
  const days = req.query.days || 7;
  const recent = dailyWordService.getRecentDailyWords(req.user.id, days);
  res.json({ recent });
});
```

**Route handler pattern with error handling** (lines 13-33):
```javascript
async function handleDailyWord(req, res, force) {
  const started = Date.now();
  console.log(`${req.method} /api/daily-word${force ? "/new" : ""} - user: ${req.user.id}, force=${force}`);
  try {
    const user = loadUser(req.user.id);
    if (!user) return res.sendStatus(404);
    const payload = await dailyWordService.generateDailyWord(user, { force });
    console.log(`${req.method} /api/daily-word${force ? "/new" : ""} - success in ${Date.now() - started}ms`);
    res.json({ ...payload, queue: wordQueue.getQueueStatus(user.id) });
  } catch (err) {
    console.error(`${req.method} /api/daily-word - failed in ${Date.now() - started}ms:`, err.code || err.message);
    const reason = err.code || err.message;
    res.status(reason === "cooldown_active" ? 429 : 503).json({
      error: "daily_word_unavailable",
      reason,
      retryAfterSec: err.retryAfterSec || null,
      queue: wordQueue.getQueueStatus(req.user.id),
    });
  }
}
```

**User loading pattern** (lines 7-11):
```javascript
function loadUser(userId) {
  return db.prepare(
    "SELECT id, email, cefr_level, native_language, target_language, genre, difficulty FROM users WHERE id = ?"
  ).get(userId);
}
```

**New `/pronounce` route should follow:**
1. `router.get("/pronounce", ...)` after existing routes (before `module.exports`)
2. Use `loadUser(req.user.id)` to get `target_language`
3. Call `ttsService.getPronunciationForWord(word, langCode)`
4. Return `audio/wav` content type with the WAV buffer

**Auth is already applied** at mount point — `server/index.js` line 297:
```javascript
app.use('/api/daily-word', authenticateToken, dailyWordRouter);
```

---

### `server/db.js` (migration — MODIFY)

**Self-reference:** Add a new `CREATE TABLE IF NOT EXISTS word_pronunciation_cache` block.

**Table creation pattern** (lines 32-40):
```javascript
db.exec(`
 CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
 )
`);
```

**Migration pattern** (lines 43-46 — check columns, add if missing):
```javascript
const usersColumns = db.prepare("PRAGMA table_info(users)").all();
if (!usersColumns.some(col => col.name === 'cefr_level')) {
 db.exec("ALTER TABLE users ADD COLUMN cefr_level TEXT DEFAULT 'B1'");
}
```

**Index creation pattern** (line 80, 255-256):
```javascript
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_canonical_key ON vocab_items(canonical_key)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_words_user_generated ON daily_words(user_id, generated_at DESC)`);
```

**New table to add:**
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS word_pronunciation_cache (
    word TEXT PRIMARY KEY,
    audio_blob BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

---

### `client/src/components/DailyWordCard.tsx` (component, request-response — MODIFY)

**Self-reference:** Add pronunciation button + audio playback state.

**Imports pattern** (lines 1-8):
```typescript
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/Button";
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles, RotateCw } from "lucide-react";
```

**Auth hook pattern** (line 64):
```typescript
const { user } = useAuth();
```
Access `user?.target_language` for language-based icon visibility.

**apiFetch pattern** (lines 76-84):
```typescript
const fetchQueueStatus = useCallback(async () => {
  try {
    const res = await apiFetch("/daily-word/queue-status");
    if (res.ok) {
      setQueueStatus(await res.json());
    }
  } catch {
    /* non-fatal */
  }
}, []);
```

**Audio playback pattern** — existing song preview (lines 177-198):
```typescript
const togglePlay = () => {
  const audio = audioRef.current;
  if (!audio || !data) return;
  if (isPlaying) { audio.pause(); setIsPlaying(false); return; }
  const startSec = data.audio.preview_offset + data.lyric.timestamp_ms / 1000;
  audio.currentTime = Math.max(0, startSec - 2);
  audio.play().catch((err) => {
    console.error("Playback failed:", err);
    setRefreshError("Audio preview unavailable in your region.");
    setIsPlaying(false);
  });
  setIsPlaying(true);
};

useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;
  const stop = () => setIsPlaying(false);
  audio.addEventListener("ended", stop);
  audio.addEventListener("pause", stop);
  return () => { audio.removeEventListener("ended", stop); audio.removeEventListener("pause", stop); };
}, [data]);
```

**Pronunciation playback adaptation** — use Blob URL pattern from RESEARCH.md:
```typescript
const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
const [isSpeaking, setIsSpeaking] = useState(false);

const playPronunciation = async () => {
  if (isSpeaking) return;
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await apiFetch(`/daily-word/pronounce?word=${encodeURIComponent(data.word.text)}`);
      if (!res.ok) throw new Error("Pronunciation unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      pronunciationAudioRef.current = audio;
      audio.play();
      setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      return;
    } catch {
      if (attempt === maxRetries) { /* toast: "Pronunciation unavailable" */ }
    }
  }
};
```

**Pronunciation display location** (lines 315-319):
```tsx
{data.word.pronunciation && (
  <span className="text-base sm:text-lg font-medium text-zinc-500 dark:text-zinc-400 tracking-wide font-serif italic break-words">
    {formatPronunciation(data.word.pronunciation)}
  </span>
)}
```
Place pronunciation button immediately after this span, inside the same flex container.

**Button styling pattern** (lines 288-291):
```tsx
<Button variant="ghost" size="sm" onClick={...} disabled={refreshing} className="shrink-0 text-[10px] font-bold uppercase tracking-wide sm:tracking-widest gap-2 whitespace-nowrap">
```

**Language visibility check:**
```tsx
{SUPPORTED_LANGUAGES.includes(user?.target_language || "") && (
  <button ...>
    <Volume2 ... />
  </button>
)}
```

---

### `server/services/wordQueueService.js` (service, event-driven — MODIFY)

**Self-reference:** Add `preCachePronunciation(word)` call inside `enqueuePayloads`.

**Enqueue pattern** (lines 30-48):
```javascript
function enqueuePayloads(userId, payloads) {
  if (!payloads?.length) return 0;
  purgeExpired(userId);
  const ready = countReady(userId);
  const slots = Math.max(0, QUEUE_MAX - ready);
  if (slots === 0) return 0;

  const insert = db.prepare(`
    INSERT INTO user_word_queue (user_id, word_json, generated_at, expires_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', ?))
  `);

  let inserted = 0;
  for (const payload of payloads.slice(0, slots)) {
    insert.run(userId, JSON.stringify(payload), `+${EXPIRY_DAYS} days`);
    inserted += 1;
  }
  return inserted;
}
```

**Pre-cache hook:** After line 44 (`inserted += 1;`), add a call like:
```javascript
// Pre-cache pronunciation (fire-and-forget)
try {
  const wordText = payload?.word?.text;
  if (wordText) {
    const ttsService = require('./ttsService');
    ttsService.preCachePronunciation(wordText).catch(() => {});
  }
} catch {}
```

---

### `server/routes/dailyWord.test.js` (test — MODIFY)

**Test pattern** (lines 1-33):
```javascript
const { expect } = require("chai");
const dailyWordRouter = require("./dailyWord");
const dailyWordService = require("../services/dailyWordService");
const db = require("../db");

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  r.sendStatus = (c) => { r.statusCode = c; return r; };
  return r;
};

describe("Daily Word Routes", () => {
  const userId = "daily-route-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "route@test.com", "x");
    db.prepare("DELETE FROM user_word_queue WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_queue_refill WHERE user_id = ?").run(userId);
  });

  it("GET / returns daily word payload", async () => {
    const original = dailyWordService.generateDailyWord;
    dailyWordService.generateDailyWord = async () => ({ date: "2026-06-14", word: { text: "hola" } });
    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.body.word.text).to.equal("hola");
    dailyWordService.generateDailyWord = original;
  });
});
```

**New tests to add:**
1. `GET /pronounce returns WAV for cached word` — mock db cache hit
2. `GET /pronounce returns 400 for missing word param`
3. `GET /pronounce returns 404 for unsupported language`
4. `Cache hit skips Pocket-TTS call`

---

## Shared Patterns

### Authentication
**Source:** `server/index.js` lines 47-60
**Apply to:** `/api/daily-word/pronounce` route (already applied at mount point)
```javascript
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
```
The daily-word router is already mounted with `authenticateToken` at `server/index.js` line 297:
```javascript
app.use('/api/daily-word', authenticateToken, dailyWordRouter);
```
No additional auth middleware needed on the new `/pronounce` route.

### Error Handling
**Source:** `server/routes/audio.js` lines 36-45
**Apply to:** `ttsService.js` and `/pronounce` route
```javascript
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
```

### Frontend Auth-aware Fetch
**Source:** `client/src/lib/api.ts` lines 54-98
**Apply to:** `DailyWordCard.tsx` pronunciation button
```typescript
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const config: RequestInit = { ...options, headers, credentials: 'include' };
  let response = await fetch(url, config);
  // Auto-refresh on 401...
  return response;
}
```

### Voice Mapping Config
**Source:** RESEARCH.md (corrected voice names)
**Apply to:** `ttsService.js`
```javascript
const VOICE_MAP = {
  es: "lola",
  fr: "estelle",
  de: "juergen",
  pt: "rafael",
  en: "alba",
  it: "giovanni",
};
const SUPPORTED_LANGUAGES = Object.keys(VOICE_MAP);
```

### Lucide Icon Import
**Source:** `client/src/components/DailyWordCard.tsx` line 8
**Apply to:** Same file, add `Volume2` to existing import
```typescript
import { BookOpen, Loader2, Music2, Play, Pause, RefreshCw, Sparkles, RotateCw, Volume2 } from "lucide-react";
```

### Supported Languages Constant (Frontend)
**Source:** Must mirror `VOICE_MAP` keys
**Apply to:** `DailyWordCard.tsx` for conditional rendering
```typescript
const SUPPORTED_PRONUNCIATION_LANGUAGES = ["es", "fr", "de", "pt", "en", "it"];
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server/services/ttsDaemon.js` | service | event-driven | No process lifecycle management exists yet; new pattern using `child_process.spawn` |

---

## Metadata

**Analog search scope:** `server/routes/`, `server/services/`, `server/*.js`, `client/src/components/`, `client/src/lib/`, `client/src/hooks/`
**Files scanned:** ~15
**Pattern extraction date:** 2026-07-11
