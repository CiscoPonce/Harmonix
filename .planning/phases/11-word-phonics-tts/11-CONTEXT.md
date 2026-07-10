# Phase 11: Word Phonics TTS Integration

**Status:** Planned  
**Milestone:** v1.4 — Phonics Integration  
**Goal:** Use Pocket-TTS to generate and play pronunciation audio for the "Word of the Day" (Daily Word) and vocabulary items.

## Phase Boundary

1. **Backend Integration**: 
   - Integrate the `pocket-tts` package/service into the Express backend server.
   - Run `pocket-tts serve` as a persistent background daemon bound to `127.0.0.1:3002` (one port above backend `3001`).
   - Create a secure `/api/daily-word/pronounce` endpoint that requires user authentication, checks SQLite cache, fetches/caches from Pocket-TTS, and streams the WAV data.
2. **Frontend Integration**:
   - Add a speaker/pronunciation icon to `DailyWordCard` next to the word.
   - Play the audio on-demand when the icon is clicked.
3. **Multi-language support**:
   - Match the user's target language to the appropriate Pocket-TTS voice/model.
   - Hide the pronunciation icon for unsupported languages.

## Implementation Decisions

- **D-11-01:** Run Pocket-TTS as an HTTP server (`pocket-tts serve`) on port `3002` (one number after backend port `3001`). Bind to `127.0.0.1` to ensure security (not exposed to the public).
- **D-11-02:** Audio is generated on-the-fly and cached locally in a new SQLite table `word_pronunciation_cache` (storing raw audio BLOBs) to avoid redundant TTS generations for the same word.
- **D-11-03:** Voice mapping defaults based on target language (e.g., Spanish -> `lola`, French -> `estelle`, etc.).
- **D-11-04:** Pad the generated audio with 1 second of silence at the beginning and the end to prevent the word from being cut off or spoken too fast.
- **D-11-05:** Secure the Express route `/api/daily-word/pronounce` using the project's standard authentication middleware.
- **D-11-06:** Hide the speaker icon on the frontend if the target language is not supported by Pocket-TTS.

## Canonical References

- `server/routes/dailyWord.js` — daily word endpoints
- `client/src/components/DailyWordCard.tsx` — UI card for daily word
- `pocket-tts/README.md` — Pocket-TTS CLI / API documentation
