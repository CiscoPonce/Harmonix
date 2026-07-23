#!/usr/bin/env bash
# Harmonix fresh-start migration helper (Phase 14 ops)
#
# Use when you want a clean ship path WITHOUT copying the old SQLite DB.
# Public surface can be ngrok (no custom domain) or a real domain later.
#
# Usage examples:
#   bash scripts/fresh-start-migrate.sh                  # interactive
#   bash scripts/fresh-start-migrate.sh --mode=ngrok --fresh-db --write
#   bash scripts/fresh-start-migrate.sh --mode=domain --host=app.example.com --write
#   bash scripts/fresh-start-migrate.sh --mode=ngrok --write --restart
#
# Flags:
#   --mode=ngrok|domain     Public URL strategy (default: ngrok)
#   --host=HOSTNAME         Public host without scheme (required for domain; optional for ngrok)
#   --fresh-db              Archive + delete server/harmonix.db (start empty)
#   --write                 Write server/.env + client/.env URL fields
#   --restart               After write, run bash run_env.sh (VPS)
#   --yes                   Skip confirmation prompts
#   --help                  Show this help

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_ENV="$ROOT/server/.env"
CLIENT_ENV="$ROOT/client/.env"
SERVER_EXAMPLE="$ROOT/server/.env.example"
CLIENT_EXAMPLE="$ROOT/client/.env.example"
DB_FILE="$ROOT/server/harmonix.db"
DEFAULT_NGROK_HOST="moral-sparrow-nationally.ngrok-free.app"

MODE=""
HOST=""
FRESH_DB=0
WRITE=0
RESTART=0
YES=0

usage() {
  sed -n '2,22p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode=*) MODE="${1#*=}" ;;
    --host=*) HOST="${1#*=}" ;;
    --fresh-db) FRESH_DB=1 ;;
    --write) WRITE=1 ;;
    --restart) RESTART=1 ;;
    --yes|-y) YES=1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
  shift
done

confirm() {
  local prompt="$1"
  if [[ "$YES" -eq 1 ]]; then return 0; fi
  read -r -p "$prompt [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

upsert_env() {
  local file="$1" key="$2" value="$3"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    # portable in-place replace
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" '
      BEGIN { done=0 }
      index($0, k "=") == 1 { print k "=" v; done=1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ensure_env_skeleton() {
  if [[ ! -f "$SERVER_ENV" ]]; then
    cp "$SERVER_EXAMPLE" "$SERVER_ENV"
    echo "Created $SERVER_ENV from example (fill secrets next)."
  fi
  if [[ ! -f "$CLIENT_ENV" ]]; then
    cp "$CLIENT_EXAMPLE" "$CLIENT_ENV"
    echo "Created $CLIENT_ENV from example."
  fi
}

# --- interactive defaults ---
if [[ -z "$MODE" ]]; then
  echo "Public URL strategy:"
  echo "  1) ngrok  (no custom domain — recommended for now)"
  echo "  2) domain (when you own HTTPS hostname)"
  read -r -p "Choose [1/2] (default 1): " choice
  case "${choice:-1}" in
    2) MODE="domain" ;;
    *) MODE="ngrok" ;;
  esac
fi

if [[ "$MODE" != "ngrok" && "$MODE" != "domain" ]]; then
  echo "ERROR: --mode must be ngrok or domain"
  exit 1
fi

if [[ -z "$HOST" ]]; then
  if [[ "$MODE" == "ngrok" ]]; then
    read -r -p "ngrok host (default ${DEFAULT_NGROK_HOST}): " HOST
    HOST="${HOST:-$DEFAULT_NGROK_HOST}"
  else
    read -r -p "Domain host (e.g. app.harmonix.example): " HOST
    if [[ -z "$HOST" ]]; then
      echo "ERROR: domain host is required"
      exit 1
    fi
  fi
fi

# strip scheme / trailing slash if pasted
HOST="${HOST#https://}"
HOST="${HOST#http://}"
HOST="${HOST%/}"

PUBLIC_BASE="https://${HOST}"
API_BASE="${PUBLIC_BASE}/api"
# Prefer short /callback alias (Dashboard-friendly); Express aliases to /api/spotify/oauth/callback
SPOTIFY_REDIRECT_URI="${PUBLIC_BASE}/callback"
SPOTIFY_WEB_SUCCESS_URL="${PUBLIC_BASE}/playlists?spotify=connected"
SPOTIFY_WEB_ERROR_URL="${PUBLIC_BASE}/settings?spotify=error"
SPOTIFY_ANDROID_SUCCESS_URL="${PUBLIC_BASE}/app/library?spotify=connected"
SPOTIFY_ANDROID_ERROR_URL="${PUBLIC_BASE}/app/settings?spotify=error"

# Interactive: offer actions when no apply flags were passed
if [[ "$WRITE" -eq 0 && "$FRESH_DB" -eq 0 && "$YES" -eq 0 ]]; then
  echo ""
  if confirm "Start with a fresh empty DB (archive current harmonix.db)?"; then
    FRESH_DB=1
  fi
  if confirm "Write public URL fields into server/.env + client/.env?"; then
    WRITE=1
  fi
  if [[ "$WRITE" -eq 1 ]] && confirm "Restart stack with run_env.sh after write?"; then
    RESTART=1
  fi
fi

echo ""
echo "=== Harmonix fresh-start migration plan ==="
echo "Mode           : $MODE"
echo "Public site    : $PUBLIC_BASE"
echo "API base       : $API_BASE"
echo "Spotify redirect: $SPOTIFY_REDIRECT_URI"
echo "Fresh DB       : $([[ $FRESH_DB -eq 1 ]] && echo yes || echo no)"
echo "Write env files: $([[ $WRITE -eq 1 ]] && echo yes || echo no)"
echo "Restart stack  : $([[ $RESTART -eq 1 ]] && echo yes || echo no)"
echo ""

if [[ "$FRESH_DB" -eq 0 && "$WRITE" -eq 0 ]]; then
  echo "Dry-run only (no files changed)."
  echo "Re-run with --write [--fresh-db] [--restart] when ready."
  echo ""
fi

echo "=== Spotify Developer Dashboard (manual) ==="
echo "Add these Redirect URIs exactly:"
echo "  1. ${SPOTIFY_REDIRECT_URI}"
echo "  2. ${PUBLIC_BASE}/api/spotify/oauth/callback   # optional full-path alias"
echo "Web settings success/error land on Library / Settings automatically via env."
echo ""
echo "=== Flutter / mobile API ==="
echo "Build with:"
echo "  flutter run --dart-define=API_BASE=${API_BASE}"
echo "  flutter build apk --release --dart-define=API_BASE=${API_BASE}"
echo ""

if [[ "$WRITE" -eq 0 && "$FRESH_DB" -eq 0 ]]; then
  exit 0
fi

if ! confirm "Apply changes now?"; then
  echo "Aborted."
  exit 1
fi

ensure_env_skeleton

if [[ "$FRESH_DB" -eq 1 ]]; then
  if [[ -f "$DB_FILE" ]]; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    archive="$ROOT/server/harmonix.db.archived-${stamp}"
    echo "Archiving DB → $archive (not copied into the new DB; new process starts empty)."
    mv "$DB_FILE" "$archive"
    # WAL sidecars
    [[ -f "${DB_FILE}-wal" ]] && mv "${DB_FILE}-wal" "${archive}-wal" || true
    [[ -f "${DB_FILE}-shm" ]] && mv "${DB_FILE}-shm" "${archive}-shm" || true
  else
    echo "No existing $DB_FILE — fresh DB will be created on next boot."
  fi
fi

if [[ "$WRITE" -eq 1 ]]; then
  echo "Updating env URL fields…"
  upsert_env "$SERVER_ENV" "SPOTIFY_REDIRECT_URI" "$SPOTIFY_REDIRECT_URI"
  upsert_env "$SERVER_ENV" "SPOTIFY_WEB_SUCCESS_URL" "$SPOTIFY_WEB_SUCCESS_URL"
  upsert_env "$SERVER_ENV" "SPOTIFY_WEB_ERROR_URL" "$SPOTIFY_WEB_ERROR_URL"
  upsert_env "$SERVER_ENV" "SPOTIFY_ANDROID_SUCCESS_URL" "$SPOTIFY_ANDROID_SUCCESS_URL"
  upsert_env "$SERVER_ENV" "SPOTIFY_ANDROID_ERROR_URL" "$SPOTIFY_ANDROID_ERROR_URL"
  upsert_env "$SERVER_ENV" "PUBLIC_BASE_URL" "$PUBLIC_BASE"
  upsert_env "$CLIENT_ENV" "NEXT_PUBLIC_API_URL" "$API_BASE"

  # Keep run_env ngrok host in sync when using ngrok mode on VPS checkout
  if [[ "$MODE" == "ngrok" && -f "$ROOT/run_env.sh" ]]; then
    if grep -qE '^NGROK_URL=' "$ROOT/run_env.sh"; then
      tmp="$(mktemp)"
      sed "s|^NGROK_URL=.*|NGROK_URL=\"${HOST}\"|" "$ROOT/run_env.sh" > "$tmp"
      mv "$tmp" "$ROOT/run_env.sh"
      echo "Updated run_env.sh NGROK_URL=${HOST}"
    fi
  fi

  echo ""
  echo "Still required in server/.env (secrets — not overwritten):"
  echo "  JWT_SECRET, JWT_REFRESH_SECRET"
  echo "  SPOTIFY_CLIENT_ID, SPOTIFY_TOKEN_ENCRYPTION_KEY (+ version)"
  echo "  NVIDIA_NIM_API_KEY and/or OPENROUTER_API_KEY"
  echo ""
fi

if [[ "$RESTART" -eq 1 ]]; then
  if [[ ! -x "$ROOT/run_env.sh" && ! -f "$ROOT/run_env.sh" ]]; then
    echo "run_env.sh not found — skip restart."
  else
    echo "Restarting stack via run_env.sh…"
    bash "$ROOT/run_env.sh"
  fi
fi

echo ""
echo "=== Done ==="
echo "Next steps:"
echo "  1. Confirm Spotify Dashboard redirect URIs match above"
echo "  2. Fill any missing secrets in server/.env"
echo "  3. bash run_env.sh   (if you did not pass --restart)"
echo "  4. Open ${PUBLIC_BASE}/login and register a fresh account"
echo "  5. Connect Spotify from Settings; Library should sync"
echo "  6. Mobile: --dart-define=API_BASE=${API_BASE}"
