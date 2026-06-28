#!/bin/bash
set -euo pipefail

# Harmonix Persistent Environment Manager
PROJECT_ROOT="/home/ubuntu/lyric"
LOG_DIR="$PROJECT_ROOT/logs"
BACKEND_PORT=3001
FRONTEND_PORT=3009
NGROK_URL="moral-sparrow-nationally.ngrok-free.app"

mkdir -p "$LOG_DIR"

wait_for_port() {
  local port=$1
  local label=$2
  local max_attempts=30
  local attempt=1

  while [ "$attempt" -le "$max_attempts" ]; do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1 || \
       curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:${port}/api/auth/login" \
         -H "Content-Type: application/json" -d "{}" | grep -qE "^(401|400|200)$"; then
      echo "$label is ready on port $port"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  echo "ERROR: $label failed to start on port $port"
  echo "Check logs in $LOG_DIR"
  return 1
}

wait_for_ngrok() {
  local max_attempts=20
  local attempt=1

  while [ "$attempt" -le "$max_attempts" ]; do
    if pgrep -f "ngrok http" >/dev/null; then
      local code
      code=$(curl -s -o /dev/null -w "%{http_code}" "https://${NGROK_URL}/" || true)
      if echo "$code" | grep -qE "^(200|401|400)$"; then
        echo "Ngrok tunnel is ready (https://${NGROK_URL} -> HTTP $code)"
        return 0
      fi
    fi
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "ERROR: Ngrok failed to become reachable"
  tail -20 "$LOG_DIR/ngrok.log" 2>/dev/null || true
  return 1
}

cleanup_processes() {
  echo "Cleaning up existing Harmonix processes..."

  for pid_file in server.pid client.pid ngrok.pid; do
    if [ -f "$LOG_DIR/$pid_file" ]; then
      kill -9 "$(cat "$LOG_DIR/$pid_file")" 2>/dev/null || true
    fi
  done

  kill -9 $(lsof -t -i:${BACKEND_PORT}) 2>/dev/null || true
  kill -9 $(lsof -t -i:${FRONTEND_PORT}) 2>/dev/null || true
  pkill -f "/home/ubuntu/lyric/server.*node index.js" 2>/dev/null || true
  pkill -f "/home/ubuntu/lyric/client.*next dev" 2>/dev/null || true
  pkill -f "/home/ubuntu/lyric/client.*next start" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "ngrok http" 2>/dev/null || true
  sleep 2
}

print_health_summary() {
  local backend_code frontend_code public_code
  backend_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/" || echo "fail")
  frontend_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FRONTEND_PORT}/" || echo "fail")
  public_code=$(curl -s -o /dev/null -w "%{http_code}" "https://${NGROK_URL}/" || echo "fail")

  echo "Health:"
  echo "  Backend  : HTTP $backend_code"
  echo "  Frontend : HTTP $frontend_code"
  echo "  Public   : HTTP $public_code"
}

cleanup_processes

echo "Starting Backend on port ${BACKEND_PORT}..."
cd "$PROJECT_ROOT/server"
nohup npm start > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$LOG_DIR/server.pid"
wait_for_port "$BACKEND_PORT" "Backend"

echo "Building Frontend (production)..."
cd "$PROJECT_ROOT/client"
if ! npm run build > "$LOG_DIR/client-build.log" 2>&1; then
  echo "ERROR: Frontend build failed"
  tail -30 "$LOG_DIR/client-build.log" || true
  exit 1
fi

echo "Starting Frontend on port ${FRONTEND_PORT}..."
nohup npm run start -- -p "$FRONTEND_PORT" > "$LOG_DIR/client.log" 2>&1 &
echo $! > "$LOG_DIR/client.pid"
wait_for_port "$FRONTEND_PORT" "Frontend"

echo "Starting Ngrok tunnel..."
nohup ngrok http "$BACKEND_PORT" --url="$NGROK_URL" > "$LOG_DIR/ngrok.log" 2>&1 &
echo $! > "$LOG_DIR/ngrok.pid"
wait_for_ngrok

echo "------------------------------------------------"
echo "Harmonix is now running."
echo "Backend:  http://localhost:${BACKEND_PORT}"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Public:   https://${NGROK_URL}"
echo "Logs:     ${LOG_DIR}"
print_health_summary
echo "------------------------------------------------"
