# Phase 3 Plan 03: Frontend Interactive Lyrics Summary

Implemented interactive frontend elements for vocabulary learning, including word highlighting, definition popovers, proficiency selection, and a fallback sidebar for unmapped words.

## Key Changes

### Frontend
- **VocabPopover Component**: Created a high-contrast Radix UI popover that displays word definitions, lemmas, and CEFR levels. Includes a "Report Error" button for user feedback.
- **CefrSelector Component**: Implemented a Radix UI select dropdown for users to manage their proficiency level (A1-C2).
- **LyricList Enhancement**: Updated the lyric renderer to identify and highlight vocabulary words within the synchronized lyrics using character-based mapping.
- **Player Page Integration**: 
    - Updated `PlayerPage` to fetch vocabulary from the backend API (`/api/vocab/:id`).
    - Integrated `CefrSelector` into the player header.
    - Added a "Words in this song" sidebar that displays vocabulary items that couldn't be automatically mapped to specific lyric lines.
- **Dependencies**: Added `@radix-ui/react-popover` and `@radix-ui/react-select`.

## Verification Results

### Automated Tests
- Verified installation of Radix UI components.
- Verified presence of "Report Error" button in `VocabPopover.tsx`.
- Verified handling of `unmapped` vocabulary in `PlayerPage`.

### Success Criteria
- [x] Target vocabulary words are visually highlighted in the lyrics.
- [x] Clicking a highlighted word opens a definition popover.
- [x] Popover includes a "Report Error" button.
- [x] Unmapped vocabulary words are displayed in a sidebar.
- [x] User can change their proficiency level via a selector UI.

## Deviations
- None - plan executed as written.

## Known Stubs
- `handleReportError` in `VocabPopover.tsx`: Currently logs to console and shows an alert. Needs backend integration in a future phase.
- `handleCefrChange` in `PlayerPage.tsx`: Currently updates local state. Persistence to the backend profile is noted as a future task.

## Self-Check: PASSED
- [x] `client/src/components/VocabPopover.tsx` exists.
- [x] `client/src/components/CefrSelector.tsx` exists.
- [x] `LyricList.tsx` correctly handles `mappedVocab`.
- [x] `PlayerPage` fetches and passes vocabulary data.
- [x] All commits made for each task.
