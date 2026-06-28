#!/bin/bash
set -euo pipefail

# Standard VPS deploy: pull latest code, run tests, restart full stack via run_env.sh
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=== git pull ==="
git pull origin main

echo "=== server tests ==="
cd "$PROJECT_ROOT/server"
npm test

echo "=== run_env.sh (backend + frontend build + ngrok) ==="
bash "$PROJECT_ROOT/run_env.sh"
