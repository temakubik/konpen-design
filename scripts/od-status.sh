#!/usr/bin/env bash
# Health check for running Open Design dev stack.
# Reports daemon HTTP, web HTTP, processes, sockets, WAL size.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DAEMON_URL=$(pnpm tools-dev status --json 2>/dev/null \
  | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}',t,re.S); print((json.loads(m.group(0))['apps']['daemon'].get('url') or '') if m else '')" 2>/dev/null)
WEB_PORT=17573

echo "--- daemon ---"
if [ -n "$DAEMON_URL" ] && curl -sf -o /dev/null "$DAEMON_URL/api/health"; then
  echo "OK  $DAEMON_URL"
else
  echo "DOWN"
fi

echo "--- web ---"
if curl -sf -o /dev/null "http://localhost:$WEB_PORT/"; then
  echo "OK  http://localhost:$WEB_PORT"
else
  echo "DOWN  port $WEB_PORT"
fi

echo "--- procs ---"
pgrep -afl "apps/daemon|apps/web/sidecar|next dev|next-server" 2>/dev/null | sed 's| --[a-z-]*=[^ ]*||g' | head -10

echo "--- sockets ---"
ls /tmp/open-design/ipc/default/ 2>/dev/null || echo "(none)"

echo "--- WAL ---"
if [ -f "$REPO_ROOT/.od/app.sqlite-wal" ]; then
  ls -lh "$REPO_ROOT/.od/app.sqlite-wal" | awk '{print $5, $9}'
  SIZE=$(stat -f%z "$REPO_ROOT/.od/app.sqlite-wal" 2>/dev/null || stat -c%s "$REPO_ROOT/.od/app.sqlite-wal" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 10485760 ]; then
    echo "WARNING: WAL >10MB — stop daemon + run scripts/od-clean.sh"
  fi
else
  echo "(no WAL — daemon clean)"
fi

echo "--- Next.js cache ---"
if [ -d "$REPO_ROOT/.tmp/tools-dev/default/web/next" ]; then
  du -sh "$REPO_ROOT/.tmp/tools-dev/default/web/next" 2>/dev/null
else
  echo "(no Turbopack cache)"
fi
