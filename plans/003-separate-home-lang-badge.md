# Plan 003: Stop nesting home-language code inside the translation gloss

> **Drift check**: `git diff --stat 6ced6d9..HEAD -- client/src/components/DailyWordCard.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6ced6d9`, 2026-07-25

## Why this matters

Screenshot shows **when EN** under the word. Users (and prior bugs) read `EN` as a broken translation tag. Server `sanitizeGloss` already strips trailing language codes from the **string**; the UI still appends `homeLanguage` inside the same bold text node as the meaning.

## Current state

`client/src/components/DailyWordCard.tsx` ~772-776, 900-906:

```tsx
const homeLanguage = (user?.native_language || "en").toUpperCase();
const meaning = data.word.translation?.trim();
// ...
<span className="text-sm sm:text-base font-bold ...">
  {meaning}
  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 ...">
    {homeLanguage}
  </span>
</span>
```

Flutter `learn_screen.dart` shows translation only (no badge) — do not add EN there.

## Steps

### 1. Split meaning and home-language into separate UI elements

On the WOTD front face:

- Keep `{meaning}` as its own text node (bold).
- Render home language as a **separate** chip matching the existing part-of-speech pill style (same row as POS), with `aria-label` like `Home language: English` or `Translation language: EN`.
- Do **not** place the ISO code adjacent inside the meaning `<span>`.

Exemplar for pill styling: the `part_of_speech` span immediately above (~895-898).

### 2. Visual check

- Meaning alone: `when`
- Chip: `EN` (or full language name if you prefer — keep short ISO to match Settings, but separated)
- No screenshot should read as a single string `when EN`

### 3. Optional accessibility

`title` / `aria-label` on the chip: `Shown in your home language ({code})`.

## Done criteria

- [ ] Translation text node contains only the gloss (no nested ISO).
- [ ] Home language still visible as a distinct chip/label.
- [ ] Flutter unchanged unless it already nests a badge the same way (it does not).

## STOP conditions

- If design system forbids chips on the flip card front — use a muted label **below** the meaning on its own line, still separate.

## Out of scope

- Server gloss sanitization (already strips EN from string)
- Changing native_language values
