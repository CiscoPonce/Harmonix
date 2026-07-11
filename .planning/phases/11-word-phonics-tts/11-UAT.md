---
status: testing  # API tests 1,2,4,5 + 401 verified; UI tests 6-10 still pending
phase: 11-word-phonics-tts
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md
started: 2026-07-11T17:05:00Z
updated: 2026-07-11T18:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Server boots with Pocket-TTS daemon
expected: |
  Kill any running server. Start the application from scratch.
  Server boots without errors. Pocket-TTS daemon starts on port 3002.
  Health check endpoint responds successfully.
awaiting: user response

## Tests

### 1. Server boots with Pocket-TTS daemon
expected: Server boots without errors. Pocket-TTS daemon starts on port 3002. Health check responds.
result: pass — pocket-tts healthy on 127.0.0.1:3002 after run_env restart (2026-07-11)

### 2. Pronounce endpoint returns WAV for cached word
expected: GET /api/daily-word/pronounce?word=hola returns 200 with Content-Type: audio/wav and valid WAV data.
result: pass — HTTP 200 audio/wav RIFF 24kHz mono (hola + großer)

### 3. Pronounce endpoint returns 404 for unsupported language
expected: GET /api/daily-word/pronounce?word=test returns 404 if user's target language is not supported.
result: [pending]

### 4. Pronounce endpoint returns 400 for missing word
expected: GET /api/daily-word/pronounce returns 400 with error message when word parameter is missing.
result: pass — HTTP 400 {"error":"word required"}

### 5. Cache hit skips Pocket-TTS call
expected: Second request for same word returns cached audio without calling Pocket-TTS again.
result: pass — second hola identical bytes, ~0.22s vs first gen

### 6. Speaker icon visible for supported languages
expected: DailyWordCard shows Volume2 speaker icon next to phonics for Spanish, French, German, Portuguese, English, Italian.
result: [pending]

### 7. Speaker icon hidden for unsupported languages
expected: DailyWordCard hides speaker icon when user's target language is not in supported list.
result: [pending]

### 8. Audio plays on click
expected: Clicking speaker icon triggers audio playback. Pulsing animation appears during playback. Icon returns to normal when audio finishes.
result: [pending]

### 9. Error toast on TTS failure
expected: When TTS fails, "Pronunciation unavailable" toast appears. Speaker icon remains clickable for retry.
result: [pending]

### 10. No regression in existing DailyWordCard
expected: Word flip, song preview, queue status, and all existing DailyWordCard functionality work unchanged.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
