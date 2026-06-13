# Technology Stack: LyricWord

**Project:** LyricWord
**Researched:** October 26, 2023 (Updated June 2026)
**Confidence:** HIGH

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | v20+ | Backend Runtime | Industry standard, excellent for API orchestration and handling music streams. |
| Express.js | 4.x | API Framework | Lightweight, fast development for the Lyric Validation Loop. |
| Next.js | 15.x | Frontend Framework | Best-in-class PWA support, SSR for SEO, and React for interactive lyric components. |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite | 3.x | Storage & Caching | Zero-config, perfect for MVP caching of lyrics and audio snippets. |
| better-sqlite3 | Latest | DB Driver | Synchronous, high-performance driver for Node.js. |

### Infrastructure & AI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| NVIDIA NIM | Latest | AI Inference | Free tier available for "zero-budget" MVP; handles translation and vocab generation. |
| LRCLib | API | Lyrics Data | Open-source database for synchronized lyrics (LRC format). |
| Deezer API | API | Audio Previews | Reliable 30-second song previews for contextual listening. |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | Latest | Auth | JWT signing and verification for user sessions. |
| bcryptjs | Latest | Security | Password hashing. |
| next-themes | Latest | UI | Theme management (Dark Mode) with no flashing. |
| lucide-react | Latest | UI Icons | Lightweight icons for music controls. |
| Web Audio API | Native | Audio Sync | For precision timing between lyrics and audio playback. |
| lrc-file-parser | 2.x | LRC Parsing | Used with `requestAnimationFrame` for high-precision UI updates. |
| openai | Latest | AI SDK | Official client for NVIDIA NIM's OpenAI-compatible API. |
| @radix-ui/react-tooltip | Latest | UI Popovers | Accessible, high-contrast definition tooltips. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | SQLite | PostgreSQL | SQLite is zero-cost and requires no infrastructure management for MVP. |
| AI Inference | NVIDIA NIM | OpenAI GPT-4 | NIM provides a free path for specific models; OpenAI has high per-token costs. |
| UI | Radix UI | Framer Motion | Radix provides better accessibility primitives for complex UI components like tooltips. |

## Installation

```bash
# Backend
npm install express better-sqlite3 jsonwebtoken bcryptjs openai

# Frontend
npm install @radix-ui/react-tooltip lucide-react next-themes lrc-file-parser
```

## Sources
- [LRCLib API Documentation](https://lrclib.net/docs)
- [NVIDIA NIM Guided Decoding Documentation](https://docs.nvidia.com/nim/large-language-models/latest/guided-decoding.html)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
