# Technology Stack: LyricWord

**Project:** LyricWord
**Researched:** October 26, 2023
**Confidence:** HIGH

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | v20+ | Backend Runtime | Industry standard, excellent for API orchestration and handling music streams. |
| Express.js | 4.x | API Framework | Lightweight, fast development for the Lyric Validation Loop. |
| Next.js | 14.x | Frontend Framework | Best-in-class PWA support, SSR for SEO, and React for interactive lyric components. |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite | 3.x | Storage & Caching | Zero-config, perfect for MVP caching of lyrics and audio snippets. High performance for local search. |

### Infrastructure & AI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| NVIDIA NIM | Latest | AI Inference | Free tier available for "zero-budget" MVP; handles translation and vocab generation. |
| LRCLib | API | Lyrics Data | Open-source database for synchronized lyrics (LRC format). |
| Deezer API | API | Audio Previews | Reliable 30-second song previews for contextual listening. |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Audio API | Native | Audio Sync | For precision timing between lyrics and audio playback. |
| lrc-kit | 1.x | LRC Parsing | Parsing LRCLib response into JavaScript objects for the UI. |
| lucide-react | Latest | UI Icons | Lightweight icons for music controls. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | SQLite | PostgreSQL | SQLite is zero-cost and requires no infrastructure management for MVP. |
| AI Inference | NVIDIA NIM | OpenAI GPT-4 | NIM provides a free path for specific models; OpenAI has high per-token costs. |
| UI | Next.js | Flutter (Web) | Next.js has better SEO and faster initial load for a PWA. Flutter deferred to Phase 4. |

## Installation

```bash
# Backend
npm install express sqlite3 dotenv axios

# Frontend
npx create-next-app@latest lyricword-ui
npm install lrc-kit framer-motion lucide-react
```

## Sources
- [LRCLib API Documentation](https://lrclib.net/docs)
- [NVIDIA NIM Getting Started](https://www.nvidia.com/en-us/ai-data-science/generative-ai/nims/)
- [Next.js PWA Guide](https://nextjs.org/docs/app/building-your-application/optimizing/pwas)
