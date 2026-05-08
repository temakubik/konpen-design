#!/usr/bin/env bash
# Clean shutdown of all Open Design dev processes and stale state.
# Run before any start if status is unclear or web/daemon misbehave.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "[od-clean] stopping tools-dev..."
pnpm tools-dev stop 2>/dev/null || true

echo "[od-clean] killing stragglers..."
pkill -9 -f "apps/web/sidecar" 2>/dev/null || true
pkill -9 -f "apps/daemon/src/sidecar" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true

echo "[od-clean] removing IPC sockets..."
rm -f /tmp/open-design/ipc/default/web.sock 2>/dev/null || true

echo "[od-clean] removing Next.js dev lock..."
rm -rf "$REPO_ROOT/apps/web/.next/dev/lock" 2>/dev/null || true

# Only remove WAL when daemon is fully stopped — otherwise corrupts DB.
if ! pgrep -f "apps/daemon" >/dev/null 2>&1; then
  WAL="$REPO_ROOT/.od/app.sqlite-wal"
  if [ -f "$WAL" ]; then
    SIZE=$(stat -f%z "$WAL" 2>/dev/null || stat -c%s "$WAL" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 10485760 ]; then
      echo "[od-clean] WAL >10MB ($SIZE bytes) — backing up + removing"
      cp "$WAL" "$WAL.bak.$(date +%s)"
      rm -f "$WAL" "$REPO_ROOT/.od/app.sqlite-shm"
    fi
  fi
fi

echo "[od-clean] done"
