#!/bin/bash
# Zero-downtime redeploy for Coolify-managed Harmonix.
# Builds while live, keeps a Traefik standby API, and a web standby with the
# `web` DNS alias so api→web proxy never 502s during cutover.
set -euo pipefail

PROJECT="${PROJECT:-/home/ubuntu/lyric}"
UUID="${COOLIFY_SERVICE_UUID:-rxwdj1k3qu51fqf8uwtal389}"
VOL="${UUID}_harmonix-data"
WORKDIR="/data/coolify/services/${UUID}"
DOMAIN="${PUBLIC_DOMAIN:-harmonix.peeporunclub.co.uk}"
API="api-${UUID}"
WEB="web-${UUID}"
API_STANDBY="api-${UUID}-standby"
WEB_STANDBY="web-${UUID}-standby"

if [ ! -d "$WORKDIR" ]; then
  WORKDIR="$PROJECT"
fi

run_compose() {
  # Coolify workdir is root-owned
  sudo docker compose --project-directory "$WORKDIR" -f "${WORKDIR}/docker-compose.yml" --project-name "$UUID" "$@"
}
log() { echo "==> $*"; }

wait_https() {
  local want="${1:-200}" tries="${2:-45}"
  local i code
  for i in $(seq 1 "$tries"); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://${DOMAIN}/" || true)
    if [ "$code" = "$want" ]; then
      echo "https://${DOMAIN}/ -> ${code}"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: https://${DOMAIN}/ still HTTP ${code:-000} after ${tries} tries"
  return 1
}

wait_container_http() {
  local name="$1" url="$2" tries="${3:-40}"
  local i
  for i in $(seq 1 "$tries"); do
    if docker exec "$name" node -e "fetch('${url}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: ${name} did not become ready at ${url}"
  echo "=== ${name} Container Logs ==="
  docker logs --tail 50 "$name" || true
  return 1
}

ensure_networks() {
  docker network connect coolify "$API" 2>/dev/null || true
  docker network connect coolify "$WEB" 2>/dev/null || true
  docker network connect "$UUID" coolify-proxy 2>/dev/null || true
}

fix_sqlite_perms() {
  docker run --rm -v "${VOL}:/data" alpine \
    sh -c 'chown -R 999:999 /data; chmod 777 /data; chmod 666 /data/*.db 2>/dev/null || true'
}

cleanup_standbys() {
  sudo docker rm -f "$API_STANDBY" >/dev/null 2>&1 || true
  sudo docker rm -f "$WEB_STANDBY" >/dev/null 2>&1 || true
}

start_api_standby() {
  sudo docker rm -f "$API_STANDBY" >/dev/null 2>&1 || true
  log "Starting Traefik standby API (keeps site live during API cutover)"
  local env_tmp
  env_tmp=$(mktemp)
  sudo cat "${WORKDIR}/.env" > "$env_tmp"
  chmod 600 "$env_tmp"

  docker run -d \
    --name "$API_STANDBY" \
    --restart "no" \
    --network "$UUID" \
    --network-alias "api-standby" \
    --env-file "$env_tmp" \
    -e PORT=3001 \
    -e NODE_ENV=production \
    -e SQLITE_PATH=/data/harmonix.db \
    -e FRONTEND_PROXY_TARGET="http://web:3009" \
    -e TTS_SKIP_SPAWN=true \
    -e TTS_BASE_URL="${TTS_BASE_URL:-http://host.docker.internal:3002}" \
    -e PUBLIC_BASE_URL="https://${DOMAIN}" \
    -e FORCE_SECURE_COOKIES=true \
    -v "${VOL}:/data" \
    --add-host "host.docker.internal:host-gateway" \
    --label "traefik.enable=true" \
    --label "traefik.docker.network=coolify" \
    --label "traefik.http.routers.harmonix-standby-http.rule=Host(\`${DOMAIN}\`)" \
    --label "traefik.http.routers.harmonix-standby-http.entrypoints=http" \
    --label "traefik.http.routers.harmonix-standby-http.middlewares=harmonix-standby-https-redirect" \
    --label "traefik.http.middlewares.harmonix-standby-https-redirect.redirectscheme.scheme=https" \
    --label "traefik.http.middlewares.harmonix-standby-https-redirect.redirectscheme.permanent=true" \
    --label "traefik.http.routers.harmonix-standby-https.rule=Host(\`${DOMAIN}\`)" \
    --label "traefik.http.routers.harmonix-standby-https.entrypoints=https" \
    --label "traefik.http.routers.harmonix-standby-https.tls=true" \
    --label "traefik.http.routers.harmonix-standby-https.tls.certresolver=letsencrypt" \
    --label "traefik.http.routers.harmonix-standby-https.service=harmonix-standby-svc" \
    --label "traefik.http.services.harmonix-standby-svc.loadbalancer.server.port=3001" \
    --health-cmd "node -e \"fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" \
    --health-interval 5s \
    --health-timeout 4s \
    --health-retries 12 \
    --health-start-period 5s \
    lyric-api:latest >/dev/null

  rm -f "$env_tmp"
  docker network connect coolify "$API_STANDBY" 2>/dev/null || true
  wait_container_http "$API_STANDBY" "http://127.0.0.1:3001/api/health" 40
  sleep 5
  wait_https 200 30
  local p
  for p in 1 2 3 4 5; do
    curl -s -o /dev/null --max-time 5 "https://${DOMAIN}/" || true
    sleep 1
  done
}

start_web_standby() {
  sudo docker rm -f "$WEB_STANDBY" >/dev/null 2>&1 || true
  log "Starting web standby (DNS alias web — keeps API proxy alive during web cutover)"
  # Same Compose network + alias `web` so Docker DNS still resolves while
  # the primary web container is force-recreated.
  docker run -d \
    --name "$WEB_STANDBY" \
    --restart "no" \
    --network "$UUID" \
    --network-alias "web" \
    -e NODE_ENV=production \
    -e PORT=3009 \
    -e HOSTNAME=0.0.0.0 \
    lyric-web:latest >/dev/null

  wait_container_http "$WEB_STANDBY" "http://127.0.0.1:3009/" 40
  # Primary (and standby) API must resolve web → standby before we tear down primary web
  local i
  for i in $(seq 1 30); do
    if docker exec "$API" node -e "fetch('http://web:3009/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  wait_https 200 20
}

cd "$PROJECT"

# Pull first, then re-exec so this process never keeps running an outdated
# script after git reset replaces the file on disk (bash keeps the old inode).
if [ "${HARMONIX_REDEPLOY_BOOTED:-}" != "1" ]; then
  log "Syncing ${PROJECT} to origin/main"
  git fetch origin main
  git reset --hard origin/main
  export HARMONIX_REDEPLOY_BOOTED=1
  exec bash "${PROJECT}/scripts/coolify-redeploy.sh" "$@"
fi

if [ -d "$WORKDIR" ] && [ "$WORKDIR" != "$PROJECT" ]; then
  log "Syncing updated codebase to Coolify service directory: ${WORKDIR}"
  sudo cp -r "${PROJECT}/." "${WORKDIR}/"
fi

log "Building images (live traffic stays on current containers)"
run_compose build --no-cache api web

fix_sqlite_perms
trap cleanup_standbys EXIT

start_api_standby

log "Rolling api (standby serves Traefik; old web still up)"
run_compose up -d --no-deps --force-recreate api
ensure_networks
fix_sqlite_perms
wait_container_http "$API" "http://127.0.0.1:3001/api/health" 40
wait_https 200 45

start_web_standby

log "Rolling web (web standby keeps http://web:3009 reachable)"
run_compose up -d --no-deps --force-recreate web
docker network connect coolify "$WEB" 2>/dev/null || true
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$WEB" 2>/dev/null || echo starting)
  [ "$st" = "healthy" ] || [ "$st" = "running" ] && break
  sleep 2
done
for i in $(seq 1 30); do
  if docker exec "$API" node -e "fetch('http://web:3009/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 2
done
wait_https 200 45

log "Removing standbys"
cleanup_standbys
trap - EXIT

ensure_networks
sleep 2
wait_https 200 30

log "OK — https://${DOMAIN}/ stays up through deploy"
docker ps --filter "name=${UUID}" --format 'table {{.Names}}\t{{.Status}}'
