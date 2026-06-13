# Architecture Patterns: LyricWord

**Domain:** EdTech / Music Streaming
**Researched:** October 26, 2023 (Updated June 2026)
**Confidence:** MEDIUM

## Recommended Architecture

A decoupled frontend-backend architecture with a focus on caching and AI-driven enrichment.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **PWA (Next.js)** | User Interface, Audio Playback, Sync Engine. | API Gateway, Local Storage (PWA) |
| **API Gateway (Express)** | Auth, Orchestration, AI Enrichment, Proxying. | NVIDIA NIM, Music Adapters, SQLite |
| **AI Engine (NVIDIA NIM)** | Vocab Extraction, Metaphor Explanation. | API Gateway |
| **SQLite DB** | Persistent cache for validated songs and user progress. | API Gateway |

### Data Flow (AI Enrichment)

1. **Trigger**: User opens a song for the first time.
2. **Analysis**: API Gateway sends the full LRC text and user's CEFR level to NVIDIA NIM.
3. **Extraction**: NIM returns 5-10 words with definitions and lemmata in structured JSON.
4. **Alignment**: Gateway runs the "Two-Pass" matching algorithm to find `line_index` for each word.
5. **Persistence**: The enriched data is cached in SQLite (`songs`, `vocab_items`, `song_vocab_map`).
6. **Delivery**: Next.js receives the song metadata + enriched vocabulary for highlighting.

## Patterns to Follow

### Pattern 1: Audio-Clock Synchronization
**What:** Using `requestAnimationFrame` to poll `audio.currentTime` against a high-precision hardware clock.
**When:** For any "Karaoke" style highlighting.

### Pattern 2: Two-Pass Keyword Alignment
**What:** Matching LLM-extracted words to original text via Exact -> Normalized (Fuzzy) search.
**Why:** Ensures high reliable highlighting even when LLMs normalize word forms.

### Pattern 3: Guided AI Decoding
**What:** Using JSON schemas (via `guided_json`) to force LLMs to adhere to technical formats.
**Why:** Eliminates parsing errors in the backend enrichment pipeline.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Real-time AI Generation on Every Play
**Why bad:** High latency and redundant API costs.
**Instead:** Always cache enriched lyrics in SQLite; only generate once per song-level pair.

### Anti-Pattern 2: Complex Regex for Mapping
**Why bad:** Prone to edge cases with punctuation and casing.
**Instead:** Use a multi-pass approach with explicit normalization steps.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **AI Cost** | Near zero (NIM free) | Switch to managed (OpenAI/Anthropic) | Custom hosted NIM instances |
| **Database** | Single SQLite file | SQLite with WAL mode | Migrate to PostgreSQL |

## Sources
- [Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [NVIDIA NIM Integration Guides](https://build.nvidia.com/explore/discover)
