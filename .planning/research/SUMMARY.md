# Research Summary: LyricWord

**Project:** LyricWord (Music-based Language Learning)
**Synthesized:** October 26, 2023
**Status:** COMPLETE

## Executive Summary

LyricWord is a language-learning platform that leverages the emotional and rhythmic power of music to facilitate vocabulary acquisition. Research indicates that the most successful products in this space combine precise "Karaoke-style" synchronization with active learning loops that force users to use words outside of the musical context. To ensure rapid development and legal safety, the project will utilize a "Zero-Budget" MVP stack featuring NVIDIA NIM for AI analysis and 30-second audio previews for copyright compliance.

The technical approach focuses on a Progressive Web App (PWA) architecture using Next.js and Express, with a heavy emphasis on the Web Audio API for high-fidelity synchronization. The primary risks identified are "The Illusion of Learning" (where users enjoy the music without retaining knowledge) and copyright-related takedowns. These will be mitigated through "Active Production" quizzes and strict adherence to industry-standard snippet lengths.

## Key Findings

### From STACK.md
- **Core Stack**: Next.js (Frontend), Express (Backend), SQLite (Local Cache/DB).
- **AI & Data**: NVIDIA NIM (LLM for translation/vocab), LRCLib (LRC synchronized lyrics), Deezer API (30s audio previews).
- **Rationale**: SQLite and NVIDIA NIM's free tier enable a high-performance MVP with zero infrastructure overhead.

### From FEATURES.md
- **Table Stakes**: Synced lyrics, 30s audio snippets, and SRS-based vocabulary flashcards.
- **Differentiators**: AI Metaphor Decoder (explaining poetic slang) and a "Validation Loop" to ensure audio/lyric alignment.
- **Strategic Deferment**: Native mobile apps and full song playback are excluded from v1 to reduce complexity and legal risk.

### From ARCHITECTURE.md
- **Patterns**: Use the Web Audio API hardware clock for sync (avoiding JS drift).
- **AI Strategy**: Multi-step grounding (Literal -> Poetic) to prevent LLM hallucinations in creative translations.
- **Data Flow**: A proxy-based architecture where the Express backend enriches raw lyric data with AI-generated vocabulary before serving it to the PWA.

### From PITFALLS.md
- **Top Risks**: Copyright shutdowns, passive consumption (learning the song, not the language), and audio-lyric timing drift.
- **Mitigation**: Implement 30s limits, de-contextualized "Active Production" quizzes, and hardware-based timing clocks from Day 1.

## Implications for Roadmap

### Suggested Phase Structure

1. **Phase 1: The Core Sync Engine**
   - **Rationale**: The product lives or dies by the "Karaoke" experience.
   - **Focus**: Web Audio API integration, LRCLib/Deezer synchronization, and basic PWA shell.
   - **Avoids Pitfall**: Audio-Lyric Timing Drift.

2. **Phase 2: AI Learning Loop**
   - **Rationale**: Transitions the app from a "player" to a "learning tool."
   - **Focus**: NVIDIA NIM integration for vocab extraction and metaphor decoding; initial SRS implementation.
   - **Avoids Pitfall**: Illusion of Learning (via Active Production quizzes).

3. **Phase 3: Validation & Offline Persistence**
   - **Rationale**: Improves reliability and mobile usability.
   - **Focus**: Robust "Validation Loop" for audio/lyric version matching; SQLite/Cache API for offline learning.
   - **Avoids Pitfall**: Version Mismatch (Radio vs. Album edits).

4. **Phase 4: Content Discovery & Polish**
   - **Rationale**: Drives long-term retention.
   - **Focus**: Trending song discovery, slang/grammar tagging, and UI/UX refinement.

### Research Flags
- **Needs Research**: Detailed legal review of "Transformative Use" for lyrics if scaling beyond 1,000 users.
- **Standard Patterns**: Next.js PWA setup and Express proxying are well-documented; no deep research required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on standard, battle-tested modern web technologies. |
| Features | HIGH | Strongly aligned with user expectations and competitor gaps. |
| Architecture | MEDIUM | Web Audio API sync requires precise implementation to be truly "High." |
| Pitfalls | HIGH | Risks are well-documented in both EdTech and Music industry history. |

### Gaps to Address
- **Mobile Audio Policy**: iOS/Android "user-interaction-first" policies for audio playback need to be handled carefully in the PWA.
- **LRC Availability**: Coverage of LRCLib for non-English/Spanish languages should be verified if targeting global markets.

## Sources
- LRCLib API & Deezer API Documentation
- NVIDIA NIM Discovery Guides
- MDN Web Audio API Best Practices
- Copyright Fair Use Doctrine (17 U.S.C. § 107)
- Competitor Analysis (Lirica, LyricsTraining)
