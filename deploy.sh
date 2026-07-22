#!/bin/bash
set -euo pipefail

# Standard VPS deploy: pull latest code, run tests, restart full stack via run_env.sh
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

echo "=== run_env.sh (backend + frontend build + ngrok) ==="
bash "$PROJECT_ROOT/run_env.sh"
