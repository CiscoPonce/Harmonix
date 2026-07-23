#!/bin/bash
# Rebuild images from GitHub main and restart the Coolify-managed Harmonix stack.
set -euo pipefail

PROJECT="${PROJECT:-/home/ubuntu/lyric}"
UUID="${COOLIFY_SERVICE_UUID:-rxwdj1k3qu51fqf8uwtal389}"
VOL="${UUID}_harmonix-data"

cd "$PROJECT"

echo "==> Syncing $PROJECT to origin/main"
git fetch origin main
git reset --hard origin/main

echo "==> Building images"
docker compose build api web

echo "==> Restarting Coolify service Harmonix"
docker exec coolify php artisan tinker --execute="App\\Actions\\Service\\StartService::run(App\\Models\\Service::find(1), false, true);"

echo "==> Fixing SQLite volume permissions"
docker run --rm -v "$VOL":/data alpine sh -c 'chown -R 999:999 /data; chmod 775 /data; chmod 664 /data/*.db 2>/dev/null || true'

sleep 10

echo "==> Ensuring Traefik can reach containers"
docker network connect coolify "api-${UUID}" 2>/dev/null || true
docker network connect coolify "web-${UUID}" 2>/dev/null || true
docker network connect "$UUID" coolify-proxy 2>/dev/null || true

echo "==> Health check"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://harmonix.peeporunclub.co.uk/ || true)
echo "https://harmonix.peeporunclub.co.uk -> HTTP $code"
if [ "$code" != "200" ]; then
  echo "WARN: expected 200, got $code"
  docker ps --filter "name=${UUID}" --format 'table {{.Names}}\t{{.Status}}'
  exit 1
fi
echo "OK"
