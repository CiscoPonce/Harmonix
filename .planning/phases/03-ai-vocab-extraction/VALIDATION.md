# Validation: Phase 3 — AI Vocabulary Extraction

## Phase Goal
Users receive personalized vocabulary words extracted from song lyrics and can interact with them during playback.

## 1. Observable Truths (User Perspective)
- [ ] I can see target vocabulary words highlighted with a dotted underline in the lyrics.
- [ ] I can click a highlighted word to see its definition, lemma, and CEFR level.
- [ ] I can see a "Words in this song" list for vocabulary that wasn't matched to specific lines.
- [ ] I can set my proficiency level (A1-C2) to change the complexity of extracted words.
- [ ] I can report an error if a definition seems incorrect or a word is mapped poorly.

## 2. Required Artifacts
| Artifact | Provides | Status |
|----------|----------|--------|
| `server/services/aiService.js` | NVIDIA NIM integration for word extraction | [ ] |
| `server/utils/alignment.js` | Two-pass word-to-lyric mapping | [ ] |
| `client/src/components/VocabPopover.tsx` | High-contrast definition UI with "Report" button | [ ] |
| `client/src/components/CefrSelector.tsx` | User proficiency selection UI | [ ] |
| `song_vocab_map` (SQLite) | Persistent mapping with multi-occurrence support | [ ] |

## 3. Key Links & Wiring
- **AI to Lyrics**: `alignment.js` correctly maps "lemma" or "word" to `line_index` and `char_start`.
- **UI to Data**: `LyricList.tsx` receives `vocab` array and renders `VocabPopover` triggers.
- **User to AI**: User's `cefr_level` from DB is passed to `aiService.extractVocabulary`.

## 4. Automated Verification
- [ ] `npm --prefix server test` passes (includes AI and Alignment tests).
- [ ] SQLite schema check: `song_vocab_map` has composite PK `(song_id, vocab_id, line_index, char_start)`.
- [ ] SQLite schema check: `users` table has `cefr_level` column.

## 5. Human-in-the-loop (UAT)
1. **Extraction Quality**: Load 3 different songs; verify that words chosen are appropriate for the set CEFR level.
2. **Highlighting Accuracy**: Verify that highlighted words in the UI match the actual word in the lyrics (no off-by-one errors).
3. **Fallback Display**: Check "Words in this song" sidebar when an extracted word is not found in the text.
4. **Interactive Popover**: Verify "Report Error" button is present and clickable.
