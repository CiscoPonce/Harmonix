#!/usr/bin/env bash
# Capacitor / production WebView smoke — runnable without a device.
# Device UI checks remain in docs/MOBILE-B-CAPACITOR.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${PUBLIC_BASE_URL:-https://harmonix.peeporunclub.co.uk}"
FAIL=0

pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAIL=1; }

echo "== Capacitor smoke against $BASE =="

code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "$BASE/" || echo 000)
[[ "$code" == "200" ]] && pass "GET / → $code" || fail "GET / → $code"

code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "$BASE/discover" || echo 000)
[[ "$code" == "200" ]] && pass "GET /discover → $code" || fail "GET /discover → $code"

code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "$BASE/login" || echo 000)
[[ "$code" == "200" ]] && pass "GET /login → $code" || fail "GET /login → $code"

# Unauth API should 401 (Express alive for WebView same-origin /api)
code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "$BASE/api/auth/me" || echo 000)
[[ "$code" == "401" ]] && pass "GET /api/auth/me → $code" || fail "GET /api/auth/me → $code (want 401)"

code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "$BASE/api/playlists" || echo 000)
[[ "$code" == "401" ]] && pass "GET /api/playlists → $code" || fail "GET /api/playlists → $code (want 401)"

# Capacitor config must point at production HTTPS
cfg="$ROOT/client/capacitor.config.ts"
if grep -q "harmonix.peeporunclub.co.uk" "$cfg" && grep -q "androidScheme: 'https'" "$cfg"; then
  pass "capacitor.config.ts → production HTTPS"
else
  fail "capacitor.config.ts missing production URL or https scheme"
fi

# Flip CSS markers exist in web source (served to Capacitor WebView)
if grep -q "daily-word-flip-inner" "$ROOT/client/src/app/globals.css" \
  && grep -q "is-flipped" "$ROOT/client/src/app/globals.css"; then
  pass "web flip CSS present (Capacitor inherits)"
else
  fail "web flip CSS missing"
fi

# Add-to-playlist modal present in web
if [[ -f "$ROOT/client/src/components/AddToPlaylistModal.tsx" ]]; then
  pass "web AddToPlaylistModal present"
else
  fail "web AddToPlaylistModal missing"
fi

# Android project + APK artifact
[[ -d "$ROOT/client/android" ]] && pass "client/android present" || fail "client/android missing"
if [[ -f "$ROOT/releases/Harmonix-debug.apk" ]]; then
  pass "releases/Harmonix-debug.apk present ($(du -h "$ROOT/releases/Harmonix-debug.apk" | awk '{print $1}'))"
else
  fail "releases/Harmonix-debug.apk missing"
fi

# Flutter primary path artifacts / sources
[[ -f "$ROOT/mobile/lib/widgets/add_to_playlist_sheet.dart" ]] \
  && pass "Flutter AddToPlaylistSheet present" \
  || fail "Flutter AddToPlaylistSheet missing"
[[ -f "$ROOT/mobile/lib/widgets/word_flip_card.dart" ]] \
  && pass "Flutter WordFlipCard present" \
  || fail "Flutter WordFlipCard missing"

echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "All automated Capacitor smoke checks passed."
  echo "Still required on device: login → flip WOTD → Add to playlist → Library refresh (see docs/MOBILE-B-CAPACITOR.md)."
  exit 0
fi
echo "Capacitor smoke FAILED."
exit 1
