# Architecture Patterns: LyricWord

**Domain:** EdTech / Music Streaming
**Researched:** October 26, 2023
**Confidence:** MEDIUM

## Recommended Architecture

A decoupled frontend-backend architecture with a focus on caching and API orchestration.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **PWA (Next.js)** | User Interface, Audio Playback, Local Learning Loop. | API Gateway, SQLite (Local Cache) |
| **API Gateway (Express)** | Authentication, Request Routing, Rate Limiting. | AI Engine, Music Adapters, SQLite |
| **AI Engine (NVIDIA NIM)** | Translation, Metaphor Explanation, Vocab Generation. | API Gateway |
| **Music Adapters** | Normalizing data from LRCLib and Deezer. | API Gateway, External APIs |
| **SQLite DB** | Storing user progress, cached lyrics, and validated songs. | API Gateway |

### Data Flow (Lyric Validation)

1. **Request**: User searches for "Song X".
2. **Fetch**: API fetches LRC from LRCLib and Track Metadata from Deezer.
3. **Validate**: Logic compares durations and track titles to ensure a match.
4. **Enrich**: AI Engine generates a list of 5 vocabulary words from the lyrics based on user level.
5. **Serve**: Combined JSON object sent to PWA.
6. **Cache**: Result stored in SQLite to avoid redundant external API calls.

## Patterns to Follow

### Pattern 1: Audio-Clock Synchronization
**What:** Using the Web Audio API hardware clock instead of the main thread JS clock.
**When:** For any "Karaoke" style highlighting.
**Example:**
```typescript
const context = new (window.AudioContext || window.webkitAudioContext)();
const source = context.createBufferSource();
// Use context.currentTime for logic, not setInterval
```

### Pattern 2: Multi-Step AI Grounding
**What:** Asking the LLM to provide a literal translation BEFORE a poetic explanation.
**Why:** Prevents "hallucinated" meanings by grounding the model in the literal text first.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct External API Calls from Frontend
**Why bad:** Exposes API keys (Deezer), fails if the user is offline, and makes rate-limiting impossible.
**Instead:** Always route through the Express proxy.

### Anti-Pattern 2: Storing Audio Blobs in SQLite
**Why bad:** SQLite database size will explode, impacting performance.
**Instead:** Store audio file paths/URLs and use the browser's Cache API for actual binary storage.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **AI Cost** | Near zero (NIM free) | Switch to managed (OpenAI/Anthropic) | Custom hosted NIM instances |
| **API Limits** | Standard tier | Enterprise LyricFind/Deezer | Direct licensing with labels |
| **Database** | Single SQLite file | SQLite with WAL mode | Migrate to PostgreSQL |

## Sources
- [Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [NVIDIA NIM Integration Guides](https://build.nvidia.com/explore/discover)
