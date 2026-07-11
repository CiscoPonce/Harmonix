# Phase 11: Word Phonics TTS Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 11-word-phonics-tts
**Areas discussed:** Playback UX, Error Fallback, Supported Languages, Cache Strategy

---

## Playback UX

### Question 1: When the user clicks the pronunciation icon, what should happen first?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate play | Click plays audio instantly; show subtle loading spinner only if >200ms delay | ✓ |
| Loading state first | Show spinner immediately on click, play when ready (clear feedback but slower perceived speed) | |
| You decide | Pick the best UX based on existing patterns in DailyWordCard | |

**User's choice:** Immediate play (Recommended)
**Notes:** None

### Question 2: What visual feedback during playback?

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing icon | Speaker icon pulses/waves while audio plays; matches minimalist dark theme | ✓ |
| Waveform animation | Small animated waveform under the word; more dynamic but adds complexity | |
| No animation | Static icon changes to pause/stop state; simplest approach | |

**User's choice:** Pulsing icon (Recommended)
**Notes:** None

### Question 3: When audio finishes playing, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Return to speaker icon | Icon reverts to original state; user can click again to replay | ✓ |
| Show replay button | Change to a replay/refresh icon to make repeat action explicit | |
| Auto-highlight word | Flash/highlight the word text briefly after pronunciation completes | |

**User's choice:** Return to speaker icon (Recommended)
**Notes:** None

### Question 4: Where should the pronunciation button be placed on the DailyWordCard?

| Option | Description | Selected |
|--------|-------------|----------|
| Next to word text | Small icon right after the word itself; most intuitive proximity | |
| Card header area | Group with refresh/play controls at top; keeps word area clean | |
| Below the word | Dedicated row under the word+translation; more space but less discoverable | |
| Free text | "will be an icon next to the pronuciation phonics representation" | ✓ |

**User's choice:** Free text — "will be an icon next to the pronunciation phonics representation"
**Notes:** User wants the button placed next to the phonetic pronunciation display, not next to the word itself.

### Question 5: What icon style for the pronunciation button?

| Option | Description | Selected |
|--------|-------------|----------|
| Speaker with sound waves | Standard volume/speaker icon from Lucide (already imported); universally recognized | ✓ |
| Speaker with phonetic symbol | Custom icon combining speaker + IPA symbol; more specific but needs custom SVG | |
| You decide | Pick the most fitting icon based on existing Lucide imports | |

**User's choice:** Speaker with sound waves
**Notes:** None

---

## Error Fallback

### Question 1: If TTS generation fails on first attempt, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Show error toast | Brief toast message: 'Pronunciation unavailable'; icon stays but is disabled | |
| Silent retry | Retry once automatically; only show error if retry also fails | ✓ |
| Hide button entirely | Remove pronunciation icon if generation fails; clean but hides capability | |

**User's choice:** Silent retry
**Notes:** None

### Question 2: How many automatic retries before showing error?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 retry | Retry once silently; if fails again, show toast and disable button for this session | ✓ |
| 2 retries | Two silent retries; more resilient but longer potential wait | |
| You decide | Pick based on Pocket-TTS reliability characteristics | |

**User's choice:** 1 retry (Recommended)
**Notes:** None

### Question 3: After failed retry, should the button be disabled for the rest of the session?

| Option | Description | Selected |
|--------|-------------|----------|
| Disable for session | Button greys out; prevents repeated failed attempts; refreshes on next word load | |
| Keep enabled | User can try again manually; useful if failure was transient | ✓ |
| Disable for 5 minutes | Time-based cooldown; balances retry prevention with recovery | |

**User's choice:** Keep enabled
**Notes:** None

### Question 4: What should the error toast message say?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple message | 'Pronunciation unavailable' — brief, non-technical | ✓ |
| Actionable message | 'Pronunciation unavailable — tap to retry' — gives user control | |
| You decide | Match existing toast patterns in the app | |

**User's choice:** Simple message (Recommended)
**Notes:** None

---

## Supported Languages

### Question 1: Which languages should be supported at launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Top 4 | Spanish, French, German, Portuguese — covers most learners; expand later | |
| Top 6 | Add Italian and Japanese — broader but more voice mapping work | |
| All Pocket-TTS supports | Full language list from day one; maximize coverage upfront | |
| Free text | "Need to match the one offer in harmonix, Spanish, french, german, portuguese, english and italian" | ✓ |

**User's choice:** Free text — Spanish, French, German, Portuguese, English, Italian
**Notes:** User wants languages to match what Harmonix already offers.

### Question 2: How should voice selection work per language?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed mapping | One voice per language (e.g., Spanish → Lola); simple, consistent | ✓ |
| Multiple voices per language | Male/female options per language; more choice but UI complexity | |
| You decide | Pick voices that sound natural for each language | |

**User's choice:** Fixed mapping (Recommended)
**Notes:** None

### Question 3: How should the app determine which voice to use?

| Option | Description | Selected |
|--------|-------------|----------|
| User's target language | Use target_language from user profile; already stored in DB | ✓ |
| Word's language field | Use language metadata from the word itself; more accurate but may not always be set | |
| Both with fallback | Prefer word language, fallback to user's target language | |

**User's choice:** User's target language (Recommended)
**Notes:** None

### Question 4: If user's target language isn't supported, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide pronunciation icon | D-11-06 already decided this; clean, no dead UI | ✓ |
| Show disabled icon with tooltip | Icon visible but greyed out; tooltip says 'Coming soon for [language]' | |
| Show with fallback voice | Use English voice as fallback; pronunciation may be inaccurate | |

**User's choice:** Hide pronunciation icon (Recommended)
**Notes:** None

---

## Cache Strategy

### Question 1: How long should pronunciation audio be cached in SQLite?

| Option | Description | Selected |
|--------|-------------|----------|
| Never expire | Pronunciation doesn't change; cache forever; simplest approach | ✓ |
| 30 days | Periodic cleanup; balances storage with freshness | |
| Until word changes | Invalidate only if word text changes; semantically correct | |

**User's choice:** Never expire (Recommended)
**Notes:** None

### Question 2: What should the cache key be based on?

| Option | Description | Selected |
|--------|-------------|----------|
| Word + language | Same word in different languages = different audio; simple composite key | |
| Word + language + voice | Allows voice variations per language; more flexible but complex | |
| Word only | Assumes one voice per word; simpler but less flexible | ✓ |

**User's choice:** Word only
**Notes:** User chose to cache by word only, even though different languages may produce different pronunciations.

### Question 3: What format should cached audio be stored in?

| Option | Description | Selected |
|--------|-------------|----------|
| WAV blob | Pocket-TTS outputs WAV; store as-is; no conversion needed | ✓ |
| MP3/OGG blob | Compressed format; smaller storage but requires conversion step | |
| File path reference | Store audio as files on disk; reference by path; lighter DB | |

**User's choice:** WAV blob (Recommended)
**Notes:** None

### Question 4: Should pronunciation be pre-cached when daily word is generated?

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand only | Generate when user clicks icon; simpler; audio generated <1s | |
| Pre-cache with word | Generate audio when word is queued; faster first click but more storage | ✓ |
| Background pre-cache | Generate audio in background for queued words; best UX but more complexity | |

**User's choice:** Pre-cache with word
**Notes:** None

---

## the agent's Discretion

- SQLite schema design for `word_pronunciation_cache` table
- Background daemon management for Pocket-TTS
- Lucide icon import and animation implementation details
- Toast notification component integration

## Deferred Ideas

None — discussion stayed within phase scope.
