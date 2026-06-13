# Research Summary: LyricWord

**Project:** LyricWord (Music-based Language Learning)
**Synthesized:** June 2026
**Overall confidence:** HIGH

## Executive Summary

LyricWord is evolving from a music player to a personalized language learning platform. Research for **Phase 3 (AI Vocabulary Extraction)** confirms that NVIDIA NIM (specifically Llama 3) provides the necessary reasoning capabilities to extract CEFR-level-appropriate vocabulary from song lyrics. By using **Guided Decoding** (JSON schemas) and **Two-Pass Alignment** (Exact and Normalized matching), we can reliably map AI-extracted words back to the synchronized lyrics for interactive learning.

The implementation will focus on a "zero-budget" infrastructure using SQLite for persistent caching and NVIDIA's free NIM tier. The primary risks remain legal (copyright) and educational (hallucinations/passive learning), both of which are mitigated through strict 30s audio limits and context-aware, active-engagement UI patterns.

## Key Findings

**Stack:** Next.js, Express, SQLite, and NVIDIA NIM (Llama 3).
**Architecture:** Data enrichment pipeline using NIM for vocab extraction + a Two-Pass alignment algorithm for lyric highlighting.
**Critical Pitfall:** AI hallucinations in slang/metaphor; mitigated by providing full song context and multi-step prompting.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation & Auth** - (Completed) Basic PWA shell and user management.
2. **Phase 2: Core Sync Engine** - (Completed) High-precision Karaoke-style player.
3. **Phase 3: AI Vocab Extraction** - (Current)
   - Addresses: **AI-01** (Personalized Vocab).
   - Avoids: **Word Alignment Mismatch** (via Two-Pass logic).
4. **Phase 4: Quiz Generation** - Dynamic interactive exercises based on extracted vocab.
5. **Phase 5: SRS & Gamification** - Long-term retention via FSRS and XP tracking.

**Phase ordering rationale:**
- AI Extraction (Phase 3) must precede Quizzes (Phase 4) as it provides the raw learning data.
- SRS (Phase 5) requires a critical mass of words/quizzes to be effective.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | NVIDIA NIM API is OpenAI-compatible and well-documented. |
| Features | HIGH | CEFR alignment is a standard pedagogical practice. |
| Architecture | MEDIUM | Two-pass alignment is robust but requires careful handling of multibyte characters. |
| Pitfalls | HIGH | Risks are well-defined in both AI and EdTech domains. |

## Gaps to Address

- **Llama 3 Local Hosting**: Future research needed if NIM free tier limits are reached.
- **Multilingual Tokenization**: Verification of how Llama 3 handles non-Latin script tokenization for mapping.

## Sources
- NVIDIA NIM API Documentation
- Council of Europe: CEFR Lexical Guidelines
- Radix UI Documentation
