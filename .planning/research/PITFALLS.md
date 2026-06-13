# Domain Pitfalls: Language Learning through Music

**Domain:** Language Learning / EdTech / Music
**Researched:** October 26, 2023 (Updated June 2026)
**Overall confidence:** HIGH

## Critical Pitfalls

### 1. The "Copyright Shutdown"
**What goes wrong:** Using full lyrics or song audio without proper licensing.
**Prevention:** Use strictly <30s audio previews; frame lyric usage as "Linguistic Analysis."

### 2. The "Illusion of Learning" (Passive Consumption)
**What goes wrong:** Users enjoy the music but fail to actually acquire vocabulary.
**Prevention:** Force **Active Production** (quizzes) and use **Contextual Popovers** to force engagement.

### 3. AI Hallucinations in Slang
**What goes wrong:** LLMs misinterpret song lyrics or poetic slang, giving incorrect definitions.
**Prevention:** Provide the full lyric block for context; use "Multi-step Grounding" (Literal -> Poetic).

## Moderate Pitfalls

### 1. Word Alignment Mismatch
**What goes wrong:** AI extracts a word but the app can't find it in the original LRC to highlight it.
**Prevention:** Implement a **Two-Pass Alignment** (Exact -> Normalized).

### 2. NIM Latency Spikes
**What goes wrong:** User waits 10s for the song to "load" while AI generates words.
**Prevention:** Use **Persistent Caching** in SQLite. Pre-generate for popular tracks.

### 3. SQLite Concurrent Access
**What goes wrong:** "Database is locked" errors during high-frequency learning events.
**Prevention:** Enable **WAL Mode** and use `better-sqlite3`'s synchronous nature carefully.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 2: Player | **Timing Sync** | Use `requestAnimationFrame` + `audio.currentTime`. |
| Phase 3: AI Vocab | **Mapping Failure** | Use Two-Pass Alignment (Exact -> Normalized). |
| Phase 3: AI Vocab | **Guided Decoding** | Use JSON Schema (`guided_json`) to prevent parse errors. |
| Phase 5: SRS | **Over-testing** | Limit daily new words (max 10-20) to prevent burnout. |

## Sources
- [better-sqlite3 Performance Guide](https://github.com/wiselibs/better-sqlite3)
- [NVIDIA NIM Guided Decoding Docs](https://docs.nvidia.com/nim/large-language-models/latest/guided-decoding.html)
