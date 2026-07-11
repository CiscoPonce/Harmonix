# Phase 11: Word Phonics TTS Integration - Research

**Researched:** 2026-07-11
**Domain:** Text-to-Speech integration via Pocket-TTS (CPU-based, local)
**Confidence:** HIGH

## Summary

Phase 11 integrates Pocket-TTS (Kyutai's 100M-parameter CPU TTS model) to generate pronunciation audio for daily words and vocabulary items. The system runs Pocket-TTS as a local HTTP server (`pocket-tts serve`) on port 3002, proxied through the Express backend at `/api/daily-word/pronounce`. Audio is cached in SQLite as WAV blobs. The frontend adds a speaker icon to `DailyWordCard` that plays pronunciation on click.

**Critical finding:** The voice names specified in CONTEXT.md D-11-03 contain 4 names that do NOT exist in Pocket-TTS. Only `lola` (Spanish) and `estelle` (French) are valid. The planner MUST raise this as a blocking issue before implementation.

**Second critical finding:** `pocket-tts serve` loads ONE language model at startup. Multi-language support requires either running multiple serve instances (one per language) or accepting that non-matching language text will produce degraded audio when served through a single instance.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-11-01:** Run Pocket-TTS as an HTTP server (`pocket-tts serve`) on port `3002` (one number after backend port `3001`). Bind to `127.0.0.1`.
- **D-11-02:** Audio cached in SQLite table `word_pronunciation_cache` (raw audio BLOBs).
- **D-11-03:** Voice mapping: Spanish → `lola`, French → `estelle`, German → `helena`, Portuguese → `brasil`, English → `amy`, Italian → `fiamma`. ⚠️ 4 of 6 names are invalid — see Open Questions.
- **D-11-04:** Pad generated audio with 1 second silence at beginning and end.
- **D-11-05:** Secure `/api/daily-word/pronounce` with standard auth middleware.
- **D-11-06:** Hide speaker icon for unsupported languages.
- **D-11-07:** Use user's `target_language` field for voice selection.
- **D-11-08:** Fixed voice per language (no male/female options).
- **D-11-09:** Store as WAV blobs (native format).
- **D-11-10:** Cache key is word only (not word + language).
- **D-11-11:** Cached audio never expires.
- **D-11-12:** Pre-cache pronunciation when daily word is generated/queued.
- **D-11-13:** Immediate play on click; show loading spinner only if >200ms delay.
- **D-11-14:** Pulsing icon animation during playback.
- **D-11-15:** Return to speaker icon when audio finishes.
- **D-11-16:** Place pronunciation button next to phonics/phonetic representation.
- **D-11-17:** Use Lucide `Volume2` icon.
- **D-11-18:** Silent retry on failure (1 retry). If retry fails, show toast.
- **D-11-19:** Error toast: "Pronunciation unavailable".

### the agent's Discretion
- SQLite schema design for `word_pronunciation_cache`
- Background daemon management (start/stop/restart) for Pocket-TTS
- Specific Lucide icon import and animation implementation
- Toast notification component integration

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

No specific requirement IDs were provided. The phase goal is: "Use Pocket-TTS to generate and play pronunciation audio for the Word of the Day and vocabulary items."

This phase contributes to the overall platform quality and learning experience but does not map to a specific requirement in REQUIREMENTS.md.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TTS model loading & audio generation | External service (Pocket-TTS on port 3002) | Backend API | Pocket-TTS runs as standalone HTTP server |
| Pronunciation endpoint (`/api/daily-word/pronounce`) | API / Backend | — | Express route handles auth, cache, proxy |
| Audio caching (SQLite BLOBs) | Database / Storage | API / Backend | SQLite stores WAV blobs, backend reads/writes |
| Pre-caching on daily word generation | API / Backend | External service | Backend triggers TTS generation during word queue fill |
| Speaker icon + audio playback UI | Browser / Client | — | React component, HTML audio element |
| Language-to-voice mapping | API / Backend | — | Configurable mapping table |
| Daemon lifecycle management | Infrastructure | Backend | Process start/stop/health checks |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pocket-tts` | 2.1.0 | CPU-based TTS model (100M params) | Local, no API key needed, 6 languages, fast on CPU |
| `better-sqlite3` | 11.x | Audio BLOB cache storage | Already used in project, synchronous API |
| `express` | 4.x | Backend proxy endpoint | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | latest | `Volume2` icon | Already imported in DailyWordCard |
| `child_process` (Node.js) | built-in | Pocket-TTS daemon management | Start/stop `pocket-tts serve` process |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pocket-TTS serve (HTTP) | Pocket-TTS Python API directly | Simpler per-request but loses model caching between requests; each request would cold-load the model |
| SQLite BLOB cache | File-system cache | BLOB simpler for single-server; filesystem better for multi-server |
| Multiple serve instances | Single instance with model switching | Single instance can't switch models; multiple instances use more RAM but are correct |

**Installation:**
```bash
# Pocket-TTS is already vendored at ./pocket-tts/
# Install into a venv to avoid polluting system Python
cd pocket-tts && uv venv .venv && uv pip install -e .
# Or system-wide: pip install pocket-tts
```

**Version verification:** Pocket-TTS 2.1.0 confirmed on PyPI. Local copy in `./pocket-tts/` matches. [VERIFIED: PyPI + local source]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| pocket-tts | PyPI | ~6 months | — | [github.com/kyutai-labs/pocket-tts](https://github.com/kyutai-labs/pocket-tts) | [OK] | Approved (vendored locally) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*pocket-tts passes slopcheck [OK] but has no source repository linked on PyPI. Verified legitimate via local vendored copy from kyutai-labs GitHub.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  DailyWordCard                                      │
│  ├─ Pronunciation button (Volume2 icon)             │
│  ├─ Audio element (Blob URL from /pronounce)        │
│  └─ Loading/error states                            │
└──────────────────────┬──────────────────────────────┘
                       │ apiFetch("/daily-word/pronounce?word=...")
                       ▼
┌─────────────────────────────────────────────────────┐
│              Express Backend (port 3001)             │
│  /api/daily-word/pronounce (GET, auth required)     │
│  ├─ Authenticate token (JWT)                        │
│  ├─ Query word_pronunciation_cache (SQLite)         │
│  │   └─ HIT → stream WAV blob from DB               │
│  │   └─ MISS → fetch from Pocket-TTS → cache → stream│
│  └─ Return WAV audio/wav                            │
└──────────────────────┬──────────────────────────────┘
                       │ fetch("http://127.0.0.1:3002/tts", ...)
                       ▼
┌─────────────────────────────────────────────────────┐
│          Pocket-TTS Server (port 3002)              │
│  POST /tts                                          │
│  ├─ Form: text="hola", voice_url="lola"            │
│  ├─ Load model (cached in memory)                   │
│  ├─ Generate audio (streaming)                      │
│  └─ Return WAV (audio/wav, streaming)               │
│                                                     │
│  Note: One language model loaded at startup.        │
│  Voice quality degrades if text language ≠ model.   │
└─────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
server/
├── routes/dailyWord.js          # Add /pronounce endpoint
├── services/
│   ├── ttsService.js            # NEW: Pocket-TTS proxy + cache logic
│   └── ttsDaemon.js             # NEW: Pocket-TTS process management
├── db.js                        # Add word_pronunciation_cache table
└── index.js                     # No changes needed (daily-word already mounted)

client/src/
├── components/DailyWordCard.tsx  # Add pronunciation button
└── lib/api.ts                    # No changes needed (apiFetch handles auth)

pocket-tts/                       # Vendored, no changes needed
```

### Pattern 1: Express Audio Proxy (Streaming)
**What:** Proxy audio from external service through authenticated Express endpoint
**When to use:** When frontend needs audio from an unauthenticated internal service
**Example:**
```javascript
// Source: Adapted from existing audio.js pattern in server/routes/audio.js
router.get("/pronounce", async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: "word required" });

  // 1. Check cache
  const cached = db.prepare(
    "SELECT audio_blob FROM word_pronunciation_cache WHERE word = ?"
  ).get(word);

  if (cached) {
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.send(cached.audio_blob);
  }

  // 2. Fetch from Pocket-TTS
  const formData = new FormData();
  formData.append("text", word);
  formData.append("voice_url", voiceForLanguage(user.target_language));

  const ttsRes = await fetch("http://127.0.0.1:3002/tts", {
    method: "POST",
    body: formData,
  });

  if (!ttsRes.ok) {
    return res.status(502).json({ error: "tts_generation_failed" });
  }

  const wavBuffer = Buffer.from(await ttsRes.arrayBuffer());

  // 3. Pad with 1s silence (D-11-04)
  const padded = padWithSilence(wavBuffer, ttsModel.sampleRate);

  // 4. Cache
  db.prepare(
    "INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)"
  ).run(word, padded);

  // 5. Stream
  res.setHeader("Content-Type", "audio/wav");
  res.send(padded);
});
```

### Pattern 2: WAV Silence Padding
**What:** Add silence before/after TTS output to prevent clipping
**When to use:** Every TTS generation (D-11-04)
**Example:**
```javascript
// WAV format: 44-byte header + PCM samples
// Pocket-TTS uses 24000 Hz sample rate, 16-bit mono
function padWithSilence(wavBuffer, sampleRate = 24000, seconds = 1) {
  const headerSize = 44;
  const bytesPerSample = 2; // 16-bit
  const silenceBytes = sampleRate * seconds * bytesPerSample;

  const silence = Buffer.alloc(silenceBytes, 0);
  const header = wavBuffer.subarray(0, headerSize);
  const pcmData = wavBuffer.subarray(headerSize);

  // Reconstruct WAV with padded PCM
  const paddedPcm = Buffer.concat([silence, pcmData, silence]);
  const totalSize = headerSize + paddedPcm.length;

  // Update WAV header fields
  const result = Buffer.alloc(totalSize);
  header.copy(result);
  paddedPcm.copy(result, headerSize);

  // Update chunk size (offset 4) and data size (offset 40)
  result.writeUInt32LE(totalSize - 8, 4);
  result.writeUInt32LE(paddedPcm.length, 40);

  return result;
}
```

### Pattern 3: Pocket-TTS Daemon Lifecycle
**What:** Start/stop/health-check the Pocket-TTS server process
**When to use:** At server startup and for health monitoring
**Example:**
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

### Pattern 4: Frontend Audio Playback (Existing Pattern)
**What:** The DailyWordCard already uses `useRef<HTMLAudioElement>` for song preview playback
**When to use:** Reuse the same pattern for pronunciation audio
**Key difference:** Pronunciation uses a Blob URL (from `apiFetch` response), not a direct URL
**Example:**
```typescript
// Source: Adapted from DailyWordCard.tsx togglePlay pattern
const pronunciationRef = useRef<HTMLAudioElement>(null);
const [isSpeaking, setIsSpeaking] = useState(false);
const [showPronounceSpinner, setShowPronounceSpinner] = useState(false);

const playPronunciation = async () => {
  try {
    const res = await apiFetch(`/daily-word/pronounce?word=${encodeURIComponent(data.word.text)}`);
    if (!res.ok) throw new Error("Pronunciation unavailable");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    pronunciationRef.current = audio;
    audio.play();
    setIsSpeaking(true);
    audio.onended = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(url);
    };
  } catch {
    // D-11-18: silent retry once, then toast
    // D-11-19: "Pronunciation unavailable"
  }
};
```

### Anti-Patterns to Avoid
- **Running multiple Pocket-TTS instances without process management:** Each instance loads a model into RAM. Without proper lifecycle management, zombie processes accumulate.
- **Storing audio as base64 in JSON:** BLOBs in SQLite are more efficient. Base64 increases size by 33%.
- **Loading Pocket-TTS in the Express process:** The model is 100M params (~400MB RAM). Keeping it in a separate process prevents Express memory pressure.
- **Generating TTS on every request without caching:** TTS generation takes ~200ms per word. Cache is essential.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV silence padding | Custom audio DSP library | Buffer manipulation (44-byte WAV header + PCM) | WAV is simple enough; no need for audio libs |
| HTTP proxy to Pocket-TTS | Direct child_process calls per request | Express route with fetch to localhost:3002 | HTTP is language-agnostic, testable, and decoupled |
| Audio playback | Web Audio API | HTML `<audio>` element + Blob URL | Already proven in DailyWordCard; simpler |
| Process management | Custom daemon supervisor | `child_process.spawn` with health check | Pocket-TTS serve handles its own lifecycle; we just need start/stop |

## Common Pitfalls

### Pitfall 1: Pocket-TTS Serve Uses Wrong Port
**What goes wrong:** Pocket-TTS default port is 8000; if `--port 3002` is not passed, the proxy fails silently.
**Why it happens:** Default in Pocket-TTS is 8000; CONTEXT.md says 3002.
**How to avoid:** Always pass `--port 3002` explicitly. Health-check on startup before accepting traffic.
**Warning signs:** 502 errors from `/api/daily-word/pronounce` when Pocket-TTS is "running".

### Pitfall 2: Voice Name Mismatch
**What goes wrong:** Pocket-TTS returns 400 "voice_url must start with http://, https://, or hf://" because the voice name isn't in `_ORIGINS_OF_PREDEFINED_VOICES`.
**Why it happens:** CONTEXT.md D-11-03 specifies 4 invalid voice names (helena, brasil, amy, fiamma).
**How to avoid:** Use the actual voice names: `lola` (es), `estelle` (fr), `juergen` (de), `rafael` (pt), `alba` (en), `giovanni` (it). See Open Questions.
**Warning signs:** 400 errors from Pocket-TTS `/tts` endpoint.

### Pitfall 3: Single Language Model in Serve
**What goes wrong:** Text in language X served through model Y produces garbled or heavily-accented audio.
**Why it happens:** `pocket-tts serve --language english` loads only the English model. Spanish text through an English model sounds wrong.
**How to avoid:** Either (a) run one serve instance per language on separate ports, or (b) accept the limitation and use the correct `--language` flag per user. See Open Questions for recommendation.
**Warning signs:** Users report pronunciation sounds "wrong" or "accented".

### Pitfall 4: WAV Header Corruption After Padding
**What goes wrong:** Manually editing WAV bytes corrupts the audio stream.
**Why it happens:** WAV format has specific byte offsets for chunk sizes; mistakes cause silent or distorted audio.
**How to avoid:** Use a minimal, tested WAV padding function. Verify with `ffprobe` or similar during development. Alternatively, use Pocket-TTS's Python API to pad audio server-side before returning.
**Warning signs:** Audio plays but is silent, distorted, or truncated.

### Pitfall 5: SQLite BLOB Size Limitations
**What goes wrong:** Large audio files cause SQLite performance issues.
**Why it happens:** SQLite recommends BLOBs <1MB for performance. Single-word TTS WAVs are typically 10-50KB (short words at 24kHz, 16-bit mono).
**How to avoid:** Monitor blob sizes. With 1-second padding, a typical word pronunciation is under 100KB. This is well within SQLite's comfort zone.
**Warning signs:** Slow queries on `word_pronunciation_cache` table.

### Pitfall 6: CORS on Pocket-TTS Serve
**What goes wrong:** Browser requests to Pocket-TTS are blocked by CORS.
**Why it happens:** Pocket-TTS serve only allows `localhost:3000` in CORS. But we proxy through Express on port 3001, so this is a non-issue.
**How to avoid:** Always proxy through Express (`/api/daily-word/pronounce`), never call Pocket-TTS directly from the browser.
**Warning signs:** CORS errors in browser console (should not occur if architecture is followed).

## Code Examples

### Backend: TTS Proxy Route
```javascript
// server/routes/dailyWord.js — add to existing router
const db = require("../db");

const VOICE_MAP = {
  es: "lola",
  fr: "estelle",
  de: "juergen",
  pt: "rafael",
  en: "alba",
  it: "giovanni",
};

const SUPPORTED_LANGUAGES = Object.keys(VOICE_MAP);

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

router.get("/pronounce", async (req, res) => {
  const { word } = req.query;
  if (!word?.trim()) return res.status(400).json({ error: "word required" });

  const user = loadUser(req.user.id);
  if (!user) return res.sendStatus(404);

  const langCode = user.target_language || "es";
  if (!SUPPORTED_LANGUAGES.includes(langCode)) {
    return res.status(404).json({ error: "unsupported_language" });
  }

  // Check cache (D-11-10: word only, not word+language)
  const cached = db.prepare(
    "SELECT audio_blob FROM word_pronunciation_cache WHERE word = ?"
  ).get(word);

  if (cached) {
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.send(cached.audio_blob);
  }

  // Fetch from Pocket-TTS
  try {
    const formData = new URLSearchParams();
    formData.append("text", word);
    formData.append("voice_url", VOICE_MAP[langCode]);

    const ttsRes = await fetch("http://127.0.0.1:3002/tts", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!ttsRes.ok) {
      console.error(`Pocket-TTS returned ${ttsRes.status}`);
      return res.status(502).json({ error: "tts_generation_failed" });
    }

    const wavBuffer = Buffer.from(await ttsRes.arrayBuffer());
    const padded = padWavWithSilence(wavBuffer);

    // Cache
    db.prepare(
      "INSERT OR IGNORE INTO word_pronunciation_cache (word, audio_blob) VALUES (?, ?)"
    ).run(word, padded);

    res.setHeader("Content-Type", "audio/wav");
    res.send(padded);
  } catch (err) {
    console.error("Pronunciation generation failed:", err.message);
    res.status(502).json({ error: "tts_unavailable" });
  }
});
```

### Backend: SQLite Table Migration
```javascript
// server/db.js — add alongside existing table creation
db.exec(`
  CREATE TABLE IF NOT EXISTS word_pronunciation_cache (
    word TEXT PRIMARY KEY,
    audio_blob BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

### Frontend: Pronunciation Button in DailyWordCard
```typescript
// client/src/components/DailyWordCard.tsx — add to imports
import { Volume2 } from "lucide-react";

// Add state and ref alongside existing state
const [isSpeaking, setIsSpeaking] = useState(false);
const [pronounceError, setPronounceError] = useState<string | null>(null);
const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);

// Add play function
const playPronunciation = async () => {
  if (isSpeaking) return;
  setPronounceError(null);

  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await apiFetch(
        `/daily-word/pronounce?word=${encodeURIComponent(data.word.text)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Pronunciation unavailable");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      pronunciationAudioRef.current = audio;
      audio.play();
      setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      return; // success
    } catch {
      if (attempt === maxRetries) {
        setPronounceError("Pronunciation unavailable");
        setTimeout(() => setPronounceError(null), 3000);
      }
    }
  }
};

// Render next to pronunciation display (D-11-16)
// Inside the front face, after the pronunciation span:
{data.word.pronunciation && (
  <span className="text-base sm:text-lg font-medium text-zinc-500 dark:text-zinc-400 tracking-wide font-serif italic break-words">
    {formatPronunciation(data.word.pronunciation)}
  </span>
)}
{SUPPORTED_LANGUAGES.includes(user?.target_language || "") && (
  <button
    onClick={(e) => { e.stopPropagation(); playPronunciation(); }}
    className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
    aria-label="Listen to pronunciation"
  >
    <Volume2 className={`w-4 h-4 ${isSpeaking ? "animate-pulse text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}`} />
  </button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pocket-TTS 1.x | Pocket-TTS 2.1.0 | 2026 | Better voice quality, multi-language support, serve command with FastAPI |
| Google TTS / AWS Polly | Pocket-TTS (local CPU) | 2026 | No API key, no cost, runs on-device, ~200ms latency |

**Key Pocket-TTS serve endpoints (v2.1.0):**
- `GET /health` → `{"status": "healthy"}`
- `POST /tts` → Form data: `text` (required), `voice_url` (optional), `voice_wav` (optional File). Returns streaming `audio/wav`.
- `GET /` → Web UI (HTML)

**Predefined voices (from `_ORIGINS_OF_PREDEFINED_VOICES`):**
`alba` (en), `lola` (es), `estelle` (fr), `juergen` (de), `rafael` (pt), `giovanni` (it), plus ~20 English-only voices.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pocket-TTS CORS allows Express proxy from localhost:3001 | Architecture | Medium — would need CORS config update on Pocket-TTS serve |
| A2 | WAV sample rate from Pocket-TTS is 24000 Hz | Code Examples | Low — can verify from `tts_model.sample_rate` at runtime |
| A3 | `child_process.spawn` is sufficient for daemon management | Code Examples | Low — could upgrade to PM2 if more complex lifecycle needed |
| A4 | Single-word TTS WAVs are under 100KB | Common Pitfalls | Low — can verify empirically |
| A5 | PyTorch 2.11.0+cu130 on this machine is compatible with Pocket-TTS 2.1.0 | Environment | Low — Pocket-TTS requires torch>=2.5.0 |

## Open Questions

### 1. ⚠️ CRITICAL: Voice Name Mismatch in D-11-03
**What we know:** CONTEXT.md D-11-03 specifies: Spanish → `lola` ✅, French → `estelle` ✅, German → `helena` ❌, Portuguese → `brasil` ❌, English → `amy` ❌, Italian → `fiamma` ❌.
**What's unclear:** The 4 invalid names (`helena`, `brasil`, `amy`, `fiamma`) will cause Pocket-TTS to return HTTP 400 errors.
**Recommendation:** Replace with actual Pocket-TTS voices: German → `juergen`, Portuguese → `rafael`, English → `alba`, Italian → `giovanni`. Must be confirmed by user before implementation.

### 2. Multi-Language Architecture
**What we know:** `pocket-tts serve --language english` loads ONLY the English model. The `/tts` endpoint can accept a `voice_url` parameter, but the model's language understanding is fixed at startup.
**What's unclear:** Whether to run one serve instance (accepting degraded quality for non-matching languages) or multiple instances (one per language, consuming more RAM).
**Recommendation:** Run a **single Pocket-TTS instance per user session language**. Since users study ONE target language at a time, the daemon can be restarted with `--language` matching the active user's `target_language`. This uses ~400MB RAM per instance instead of ~2.4GB for all 6. If multi-user concurrent access is needed, fall back to running the 6 most common instances. For MVP, a single instance with restart-on-language-change is simplest.

### 3. Pre-Caching Integration Point
**What we know:** D-11-12 says pre-cache pronunciation when daily word is generated/queued.
**What's unclear:** The exact function in `dailyWordService.js` or `wordQueueService.js` where pre-caching should hook in. The word queue fill function (`enqueuePayloads` in `wordQueueService.js`) is the most natural place — it already iterates over word payloads.
**Recommendation:** Add a `preCachePronunciation(word)` call inside `wordQueueService.js` after each word is enqueued. This ensures pronunciation is ready by the time the user sees the word.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.10+ | Pocket-TTS | ✓ | 3.12.3 | — |
| PyTorch 2.5+ | Pocket-TTS | ✓ | 2.11.0+cu130 | — |
| uv | Pocket-TTS venv management | ✓ | 0.11.3 | pip3 |
| Node.js | Express backend | ✓ | (assumed from existing project) | — |
| 23GB RAM | Multiple TTS instances | ✓ | — | Can run 1-2 instances comfortably |

**Missing dependencies with no fallback:** None identified.

**Note:** PyTorch is installed with CUDA 13.0 support but no CUDA device is available. Pocket-TTS will use CPU (which it's optimized for). No action needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha + Chai (backend) |
| Config file | none — see Wave 0 |
| Quick run command | `cd server && NODE_ENV=test npx mocha 'routes/**/*.test.js'` |
| Full suite command | `cd server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (Phase 11) | Pronounce endpoint returns WAV for cached word | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 |
| (Phase 11) | Pronounce endpoint returns 404 for unsupported language | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 |
| (Phase 11) | Pronounce endpoint returns 400 for missing word param | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 |
| (Phase 11) | Cache hit skips Pocket-TTS call | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 |
| (Phase 11) | WAV padding adds silence correctly | unit | `mocha 'services/ttsService.test.js' --grep pad` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && NODE_ENV=test npx mocha 'routes/dailyWord.test.js'`
- **Per wave merge:** `cd server && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/routes/dailyWord.test.js` — tests for `/pronounce` endpoint
- [ ] `server/services/ttsService.test.js` — tests for WAV padding + cache logic
- [ ] Framework install: None needed (Mocha + Chai already installed)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT via existing `authenticateToken` middleware (D-11-05) |
| V3 Session Management | no | Not affected by this phase |
| V4 Access Control | yes | `target_language` from authenticated user profile (D-11-07) |
| V5 Input Validation | yes | Word parameter sanitization, language code validation |
| V6 Cryptography | no | Not generating/verifying signatures |

### Known Threat Patterns for Express + Pocket-TTS Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated TTS requests | Elevation of Privilege | `authenticateToken` middleware already applied to `/api/daily-word` |
| Word parameter injection (SQL) | Tampering | `db.prepare` with parameterized queries (already project standard) |
| Pocket-TTS SSRF (if voice_url is user-controlled) | Information Disclosure | Voice URL is server-mapped from `target_language`, not user-provided |
| Large word input causing memory issues | Denial of Service | Limit word parameter length to 100 chars server-side |
| Pocket-TTS process crash | Denial of Service | Health check + auto-restart on failure |

## Sources

### Primary (HIGH confidence)
- [Pocket-TTS README](https://github.com/kyutai-labs/pocket-tts/blob/main/README.md) — Voice list, serve command, API endpoints
- [Pocket-TTS serve docs](https://kyutai-labs.github.io/pocket-tts/CLI%20Commands/serve/) — Command options, CORS config
- [Local source: pocket-tts/pocket_tts/main.py] — FastAPI `/tts` endpoint, voice validation logic
- [Local source: pocket-tts/pocket_tts/default_parameters.py] — Voice-to-language mapping
- [Local source: pocket-tts/pocket_tts/utils/utils.py] — `_ORIGINS_OF_PREDEFINED_VOICES` dict
- [PyPI pocket-tts](https://pypi.org/project/pocket-tts/) — Version 2.1.0 confirmed

### Secondary (MEDIUM confidence)
- [Local source: server/routes/dailyWord.js] — Existing Express route patterns
- [Local source: server/routes/audio.js] — Existing audio proxy pattern
- [Local source: client/src/components/DailyWordCard.tsx] — Existing audio playback pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Pocket-TTS vendored locally, all source code verified
- Architecture: HIGH — Based on existing project patterns and verified Pocket-TTS API
- Pitfalls: HIGH — Voice name mismatch confirmed by cross-referencing source code

**Research date:** 2026-07-11
**Valid until:** 2026-08-11 (stable — Pocket-TTS is mature, project patterns are established)
