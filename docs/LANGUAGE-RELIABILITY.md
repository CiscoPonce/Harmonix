# Language reliability runbook

## Supported targets

`en`, `es`, `fr`, `de`, `pt`, `it` — any native→target pair where native ≠ target (30 pairs).

## Smoke tests

From `server/`:

```bash
# Catalog size + language wiring (no live APIs)
npm test -- --grep "Language"

# Live Deezer + LRCLib scan of verified catalogs (slow; rate-limit friendly)
# Requires network. Expect ≥8 OK songs per language.
node scripts/scan-verified-songs.js

# Live combination smoke: sample songs per target language
node scripts/test-language-combinations.js
```

Skip live scripts when Deezer/LRCLib are down; document the outage and re-run after recovery.

## Re-scan catalogs after LRCLib outages

1. Run `node scripts/scan-verified-songs.js` on the VPS (with delays).
2. Promote titles marked `OK` to the front of `VERIFIED_SONGS` in `services/aiService.js`.
3. Demote or remove titles that fail `deezer` / `lyrics` repeatedly.
4. Keep `VALIDATE_CONCURRENCY = 3` — do not raise unbounded parallel validation.
5. Redeploy server and purge affected user queues if language was switched mid-outage:

```sql
DELETE FROM user_word_queue WHERE user_id = '<id>';
```

## Operator notes

- NVIDIA NIM 429 → OpenRouter fallback (needs `OPENROUTER_API_KEY`).
- Preference change of `target_language` purges that user's queue automatically.
- Cold generation can take 30–75s; stocked queue should deliver next words in milliseconds.
