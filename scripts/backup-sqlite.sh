#!/bin/bash
# Nightly consistent SQLite backup of the Harmonix production database.
#
# Uses better-sqlite3's online backup API inside the running api container
# (safe while the app is writing), then copies the file to the host and prunes
# old copies. Install with scripts/systemd/harmonix-backup.{service,timer}.
#
#   BACKUP_DIR   host directory for backups   (default /home/ubuntu/backups/harmonix)
#   KEEP_DAYS    retention in days            (default 14)
set -euo pipefail

UUID="${COOLIFY_SERVICE_UUID:-rxwdj1k3qu51fqf8uwtal389}"
API="api-${UUID}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/harmonix}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP_IN_CONTAINER="/data/backup-${STAMP}.db"
OUT="${BACKUP_DIR}/harmonix-${STAMP}.db"

log() { echo "[backup $(date -u +%H:%M:%S)] $*"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$API"; then
  echo "api container $API is not running" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

log "online backup inside $API"
docker exec "$API" node -e '
  const Database = require("better-sqlite3");
  const src = process.env.SQLITE_PATH || "/data/harmonix.db";
  const db = new Database(src, { readonly: true });
  db.backup(process.argv[1]).then(() => { db.close(); }).catch((e) => { console.error(e); process.exit(1); });
' "$TMP_IN_CONTAINER"

log "copy to host"
docker cp "${API}:${TMP_IN_CONTAINER}" "$OUT"
docker exec "$API" rm -f "$TMP_IN_CONTAINER"

# Verify integrity from the host copy using the container's sqlite (no host deps).
log "integrity check"
docker run --rm -v "${BACKUP_DIR}:/b:ro" --entrypoint node "$(docker inspect -f '{{.Config.Image}}' "$API")" -e '
  const Database = require("better-sqlite3");
  const db = new Database(process.argv[1], { readonly: true });
  const r = db.prepare("PRAGMA integrity_check").get();
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  db.close();
  if (r.integrity_check !== "ok") { console.error("integrity:", r); process.exit(1); }
  console.log(`ok · users=${users}`);
' "/b/$(basename "$OUT")"

gzip -f "$OUT"
log "wrote ${OUT}.gz ($(du -h "${OUT}.gz" | cut -f1))"

log "prune older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -name 'harmonix-*.db.gz' -mtime "+${KEEP_DAYS}" -print -delete || true
ls -1t "$BACKUP_DIR" | head -5
