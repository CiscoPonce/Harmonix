# Advisor plans — Harmonix personalization recovery

**Planned at:** `6ced6d9` (2026-07-25)  
**Executed on branch:** `cursor/personalization-recovery-1e8c`

## Recommended execution order

```text
001 (unblock Next) ──► 002 (friendly errors) ──► 003 (EN badge)
         │
         └──► 004 (Flutter Hear-it provider) ──► 005 (thin genre honesty + catalog)
```

| Plan | Priority | Effort | Status | Depends on |
|------|----------|--------|--------|------------|
| [001-unblock-next-song-reuse](001-unblock-next-song-reuse.md) | P1 | M | DONE | none |
| [002-friendly-generation-errors](002-friendly-generation-errors.md) | P1 | S | DONE | none |
| [003-separate-home-lang-badge](003-separate-home-lang-badge.md) | P1 | S | DONE | none |
| [004-flutter-hearit-provider-header](004-flutter-hearit-provider-header.md) | P1 | M | DONE | none |
| [005-thin-genre-pool-and-honesty](005-thin-genre-pool-and-honesty.md) | P2 | M | DONE | 001 |

## Notes

- Plan 005 implements honest widen (`style_relaxed` + UI copy). Growing thin verified catalogs further is optional follow-up.
- Device confirmation for Flutter Hear-it still recommended after deploy.
