---
phase: quick-260422-rax
plan: 01
subsystem: ingest/db
tags: [trigger-dev, neon, websocket, nodejs-22, hotfix]
requires:
  - Trigger.dev v4 managed runtime on Node 22+
  - "@neondatabase/serverless ^1.0.2"
  - "ws ^8.20.0"
provides:
  - Unconditional ws binding for Neon serverless in all Node runtimes
affects:
  - src/trigger/ingest-hourly.ts (consumes src/lib/db/client.ts)
  - src/trigger/process-pending.ts (consumes src/lib/db/client.ts)
  - src/trigger/refresh-clusters.ts (consumes src/lib/db/client.ts)
  - Any Next.js Node-runtime RSC page that queries Neon
tech_stack_added: []
patterns: []
key_files_created: []
key_files_modified:
  - src/lib/db/client.ts
decisions:
  - Bind `neonConfig.webSocketConstructor = ws` unconditionally; do not branch on `typeof WebSocket` because Node 22+ Undici native WebSocket lacks Neon's required handshake options
metrics:
  duration: 1min
  tasks: 1
  files: 1
  completed: 2026-04-22T11:43:00Z
---

# Quick 260422-rax: Fix Trigger.dev ingest-hourly Neon WebSocket Handshake Summary

Unconditionally bind the `ws` package as Neon serverless' WebSocket constructor so Trigger.dev prod `ingest-hourly` survives Node 22's native `globalThis.WebSocket` (Undici), which silently fails Neon's binary-framing handshake.

## One-line Root Cause

Node 22 exposes a native `globalThis.WebSocket` (Undici); the prior `if (typeof WebSocket === 'undefined')` guard short-circuited the `ws` shim binding, and Neon's serverless handshake does not work against Undici's WebSocket — handshake died in ~1.6s before any query ran.

## The Fix

`src/lib/db/client.ts` — removed the runtime-sensitive guard, bound `ws` unconditionally at module top level:

```typescript
neonConfig.webSocketConstructor = ws;
```

No other changes: imports, `Pool` construction, `drizzle()` call, and exports are identical.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Unconditional ws binding | `fdd0719` | `src/lib/db/client.ts` |

## Verification

Automated (local):
- `pnpm typecheck` — exit 0 (tsc --noEmit clean)
- `pnpm test` — 23 suites / 181 tests passed (full vitest run)
- Grep invariants hold: `typeof WebSocket` absent; exactly one `neonConfig.webSocketConstructor` line

Prod (Trigger.dev) — deferred to user, see "Follow-ups" below.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Auth Gates

None encountered.

## Follow-ups (Required User Action)

1. **Deploy to Trigger.dev prod** (not run by executor per constraint):
   - CI path: merge master → wait for Trigger.dev CI deploy to match new commit SHA (`fdd0719` or subsequent merge commit) on the Deployments tab of the `ai-hotspot` project.
   - Manual path (local): `pnpm trigger:deploy` (requires `TRIGGER_ACCESS_TOKEN` and a prod-resolving `TRIGGER_PROJECT_REF`).

2. **Validate the fix in prod:**
   - Open Trigger.dev dashboard → project `ai-hotspot` → Tasks → `ingest-hourly` → Test / Run now.
   - Expected: run reaches COMPLETED (or runs into downstream RSSHub 503 at the child-fetch-source layer — see next item). Duration dominated by `fetch-source` children, not a sub-2s abort. No `Failed query: select id, rss_url from sources where is_active = $1` error in logs.
   - Failure signal: sub-2s run failure still occurring → prod bundle cached, force redeploy or confirm commit SHA matches.

3. **Unrelated blocker (still open, not regressed by this fix):**
   - Phase 2 SC#2: RSSHub at `lurnings-rsshub.hf.space` returns 503 on all canary routes. After this fix, `ingest-hourly` will reach the fan-out stage successfully but `failures > 0` / `newItemsTotal == 0` will appear at the `fetch-source` layer — that is the pre-existing Phase 2 blocker, not a regression.

## Threat Flags

None — surgical change to an existing, already-exercised code path.

## Self-Check: PASSED

- FOUND: src/lib/db/client.ts (modified)
- FOUND: commit fdd0719 in `git log --oneline`
- FOUND: `neonConfig.webSocketConstructor = ws;` at module top level (line 11)
- CONFIRMED: no `typeof WebSocket` guard remains in the file
- CONFIRMED: `pnpm typecheck` exit 0
- CONFIRMED: `pnpm test` — 181/181 passed
