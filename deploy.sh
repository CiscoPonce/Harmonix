#!/bin/bash
set -euo pipefail

# Legacy / emergency deploy: pull, optional tests, host stack via run_env.sh
# Production path: push to main (GitHub Actions) or:
#   bash /home/ubuntu/lyric/scripts/coolify-redeploy.sh
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=== git pull ==="
git pull origin main

if [[ "${1:-}" == "--skip-tests" ]]; then
  echo "=== skipping server tests (--skip-tests active) ==="
else
  echo "=== server tests ==="
  cd "$PROJECT_ROOT/server"
  npm test
fi

if [[ "${1:-}" == "--coolify" || "${2:-}" == "--coolify" ]]; then
  echo "=== coolify-redeploy.sh ==="
  bash "$PROJECT_ROOT/scripts/coolify-redeploy.sh"
  exit 0
fi

echo "=== run_env.sh (LEGACY host stack + ngrok) ==="
echo "Tip: for production use --coolify or push to main."
bash "$PROJECT_ROOT/run_env.sh"
