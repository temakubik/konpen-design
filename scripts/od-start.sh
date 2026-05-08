#!/usr/bin/env bash
# Start the full Open Design dev stack: daemon (via tools-dev) + web (via direct next dev).
#
# Why direct next dev: the embedded `app.prepare()` API used by apps/web/sidecar/server.ts
# hangs forever in Next.js 16 + Turbopack. Direct CLI works in <1s. See docs/runbook.md.
#
# Idempotent: run again to recover from a half-started state.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DAEMON_PORT="${OD_DAEMON_PORT:-17456}"
WEB_PORT="${OD_WEB_PORT_ARG:-17573}"

# 1. Daemon via tools-dev (sidecar IPC works fine for daemon).
echo "[od-start] daemon..."
if curl -sf -o /dev/null "http://127.0.0.1:$DAEMON_PORT/api/health"; then
  echo "[od-start] daemon already up at port $DAEMON_PORT"
else
  pnpm tools-dev start daemon --daemon-port "$DAEMON_PORT" >/dev/null
  for i in $(seq 1 30); do
    curl -sf -o /dev/null "http://127.0.0.1:$DAEMON_PORT/api/health" && break
    sleep 1
  done
  curl -sf -o /dev/null "http://127.0.0.1:$DAEMON_PORT/api/health" || {
    echo "[od-start] daemon failed to come up — check .tmp/tools-dev/default/logs/daemon/latest.log"
    exit 1
  }
  echo "[od-start] daemon up at http://127.0.0.1:$DAEMON_PORT"
fi

# 2. Web via direct `next dev` with /api proxy to daemon (next.config.ts rewrites).
echo "[od-start] web..."
if curl -sf -o /dev/null "http://localhost:$WEB_PORT/"; then
  echo "[od-start] web already up at port $WEB_PORT"
else
  WEB_LOG="$REPO_ROOT/.tmp/od-nextdev.log"
  mkdir -p "$(dirname "$WEB_LOG")"
  : > "$WEB_LOG"
  ( cd "$REPO_ROOT/apps/web" \
    && OD_PORT="$DAEMON_PORT" \
       nohup node node_modules/next/dist/bin/next dev --port "$WEB_PORT" \
       > "$WEB_LOG" 2>&1 & )
  for i in $(seq 1 60); do
    grep -q "Ready in" "$WEB_LOG" 2>/dev/null && break
    grep -q "EADDRINUSE\|Error" "$WEB_LOG" 2>/dev/null && {
      echo "[od-start] web start error — see $WEB_LOG"
      tail -20 "$WEB_LOG"
      exit 1
    }
    sleep 1
  done
  if ! curl -sf -o /dev/null "http://localhost:$WEB_PORT/"; then
    echo "[od-start] web did not become reachable"
    tail -20 "$WEB_LOG"
    exit 1
  fi
  echo "[od-start] web up at http://localhost:$WEB_PORT (log: $WEB_LOG)"
fi

echo ""
echo "Open: http://localhost:$WEB_PORT"
echo "Stop: scripts/od-clean.sh"
echo "Status: scripts/od-status.sh"
