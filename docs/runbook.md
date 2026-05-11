# Open Design — local dev runbook

How to start the local dev stack reliably and recover when it breaks.

## Quick start

```bash
scripts/od-start.sh        # bring up daemon + web
scripts/od-status.sh       # check health
scripts/od-clean.sh        # full shutdown + clean stale state
```

Open http://localhost:17573 in browser.

## Why we don't use `pnpm tools-dev` for web

The web sidecar at `apps/web/sidecar/server.ts` calls Next.js's embedded API (`require("next")(opts).prepare()`). On Next.js 16 + Turbopack this **hangs forever** with no log output and 0% CPU — `app.prepare()` never resolves. Direct `next dev` CLI works in under 1 second.

Until the sidecar issue is fixed, `scripts/od-start.sh` runs daemon via `tools-dev` and web via direct `next dev`. The web's `next.config.ts` already proxies `/api`, `/artifacts`, `/frames` to `OD_PORT`, so functionally identical to sidecar.

## Known traps

### 1. Stale Turbopack cache after locale removal
**Symptom:** `ReferenceError: id is not defined at apps/web/src/i18n/index.tsx:23` after removing a locale from `LOCALES`.
**Cause:** Turbopack persists compiled chunks in `.tmp/tools-dev/<ns>/web/next/`. They keep referencing imports that no longer exist in source.
**Fix:** `rm -rf .tmp/tools-dev/default/web/next` then restart.

### 2. SQLite WAL >10MB blocks daemon startup
**Symptom:** `pnpm tools-dev start daemon` hangs, no log output. better-sqlite3 stuck on `db.open()`.
**Cause:** Stale `.od/app.sqlite-wal` from a crashed daemon.
**Fix:** Stop daemon, then `rm .od/app.sqlite-wal .od/app.sqlite-shm`. Backup first if data matters.
`scripts/od-clean.sh` does this automatically when WAL >10MB.

### 3. Stray Next.js dev server holding lock
**Symptom:** Web sidecar exits silently with `Another next dev server is already running. PID: <N>`.
**Cause:** Previous web process didn't clean up `apps/web/.next/dev/lock`.
**Fix:** `pkill -9 -f "next dev|next-server"` or run `scripts/od-clean.sh`.

### 4. `tools-dev start web` 35s timeout (was)
The original timeout in `tools/dev/src/sidecar-client.ts` was 35s. Bumped to 300s in this repo. Cold Turbopack compile + Next.js init can exceed 35s.

## Editing checklist

Before commit, run:

```bash
pnpm guard          # boundary checks
pnpm typecheck      # cross-package types
```

When changing files in:
- `apps/web/src/i18n/**` → `rm -rf .tmp/tools-dev/*/web/next` after edit
- `tools/dev/src/**` → `pnpm --filter @open-design/tools-dev build` to refresh dist
- `packages/contracts/**` → `pnpm install` to refresh workspace links
- `apps/daemon/src/**` → no rebuild needed (daemon runs via tsx in dev)

## Diagnosing a hang

If web/daemon process is alive (visible in `ps`) but doing nothing (0% CPU, no log progress), sample its stack:

```bash
sample <pid> 2 -mayDie
```

A main thread stuck in `node::SpinEventLoopInternal` with no JS frames means the event loop is empty — usually waiting for an unresolved Promise (e.g. `app.prepare()` deadlock).

## Logs

- Daemon: `.tmp/tools-dev/default/logs/daemon/latest.log`
- Web (sidecar mode): `.tmp/tools-dev/default/logs/web/latest.log`
- Web (direct mode, via od-start.sh): `.tmp/od-nextdev.log`
- Next.js internal: `apps/web/.next/dev/logs/next-development.log`
