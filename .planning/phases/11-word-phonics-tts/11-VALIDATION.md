---
phase: 11
slug: word-phonics-tts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha + Chai (backend) |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `cd server && NODE_ENV=test npx mocha 'routes/**/*.test.js'` |
| **Full suite command** | `cd server && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && NODE_ENV=test npx mocha 'routes/dailyWord.test.js'`
- **After every plan wave:** Run `cd server && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | Phase 11 | — | N/A | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 | ⬜ pending |
| 11-01-02 | 01 | 1 | Phase 11 | — | N/A | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 | ⬜ pending |
| 11-01-03 | 01 | 1 | Phase 11 | — | N/A | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 | ⬜ pending |
| 11-01-04 | 01 | 1 | Phase 11 | — | N/A | unit | `mocha 'routes/dailyWord.test.js' --grep pronounce` | ❌ Wave 0 | ⬜ pending |
| 11-01-05 | 01 | 1 | Phase 11 | — | N/A | unit | `mocha 'services/ttsService.test.js' --grep pad` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/dailyWord.test.js` — tests for `/pronounce` endpoint
- [ ] `server/services/ttsService.test.js` — tests for WAV padding + cache logic
- [ ] Framework install: None needed (Mocha + Chai already installed)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pocket-TTS daemon starts and responds | Phase 11 | Requires running external process | Start daemon, verify health endpoint responds |
| Audio plays in browser | Phase 11 | Requires browser interaction | Click pronunciation icon, verify audio plays |
| Pulsing animation works | Phase 11 | Visual verification | Click pronunciation icon, observe animation |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
