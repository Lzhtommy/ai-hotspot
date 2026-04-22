---
phase: quick-260422-rax
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/client.ts
autonomous: true
requirements:
  - QUICK-260422-RAX-01
must_haves:
  truths:
    - "Neon serverless Pool uses the `ws` package as its WebSocket constructor in every Node runtime (Trigger.dev prod, Trigger.dev dev, Next.js RSC Node runtime, tsx scripts, vitest)."
    - "Trigger.dev prod task `ingest-hourly` can execute `select id, rss_url from sources where is_active = $1` successfully end-to-end."
    - "No Edge runtime regression — file is not imported by any Edge route (verified in problem_context)."
  artifacts:
    - path: "src/lib/db/client.ts"
      provides: "Drizzle client with unconditional ws binding for Neon serverless"
      contains: "neonConfig.webSocketConstructor = ws"
  key_links:
    - from: "src/lib/db/client.ts"
      to: "@neondatabase/serverless Pool"
      via: "neonConfig.webSocketConstructor = ws (module top-level, unconditional)"
      pattern: "neonConfig\\.webSocketConstructor\\s*=\\s*ws"
---

<objective>
Fix the Trigger.dev prod `ingest-hourly` failure caused by Node 22's native `globalThis.WebSocket` short-circuiting the `ws` shim binding in `src/lib/db/client.ts`. Neon serverless requires the `ws` package's WebSocket implementation (its binary-framing handshake depends on `ws`-specific options that Node's native Undici WebSocket does not expose), so the conditional must be removed and `neonConfig.webSocketConstructor = ws` set unconditionally in all Node runtimes.

Purpose: Restore hourly ingestion in production. All 3 retries of run_cmo9xy3ja06r30nnc1ercc3vi died in ~1.6s on a well-formed SELECT because Neon's WebSocket handshake never succeeded.

Output: One-line diff to `src/lib/db/client.ts` removing the `if (typeof WebSocket === 'undefined')` guard, redeployed to Trigger.dev prod.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/lib/db/client.ts
@src/trigger/ingest-hourly.ts
@trigger.config.ts
@package.json

<interfaces>
Current `src/lib/db/client.ts` (the defect — lines 6-10 are the bug):

```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// WebSocket shim for Node runtimes (Trigger.dev workers, scripts, vitest).
// Harmless in edge — globalThis.WebSocket is preferred when present.
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export { schema };
```

Runtime facts:
- `package.json` engines.node = ">=20.9"
- Trigger.dev managed runtime uses Node 22+, which exposes `globalThis.WebSocket` (Undici)
- Node 22's native WebSocket does NOT support the options Neon serverless requires for its binary-framing handshake
- `@neondatabase/serverless@^1.0.2` + `ws@^8.20.0` both present in dependencies
- Neon's own docs prescribe unconditional `neonConfig.webSocketConstructor = ws` in Node

No Edge routes consume this file (problem_context verified). Safe to bind `ws` unconditionally.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Node-version-sensitive conditional and unconditionally bind ws in Neon serverless config</name>
  <files>src/lib/db/client.ts</files>
  <action>
Replace the body of `src/lib/db/client.ts` so the ws binding is unconditional:

```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Neon serverless requires the `ws` package's WebSocket in Node runtimes.
// Node 22+ exposes a native globalThis.WebSocket (Undici), but it lacks the
// options Neon's binary-framing handshake needs — handshake fails in ~1.6s
// before any query runs. Bind unconditionally. No Edge routes import this
// file, so there is no edge runtime to regress.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export { schema };
```

Exact changes vs. current file:
1. Delete the two comment lines at 6-7 ("WebSocket shim for Node runtimes..." / "Harmless in edge...").
2. Delete the `if (typeof WebSocket === 'undefined') {` guard (line 8) and its closing `}` (line 10).
3. Replace with the new 5-line explanatory comment shown above and a single unconditional `neonConfig.webSocketConstructor = ws;` statement.
4. Do NOT change imports, the Pool construction, the drizzle call, or the exports.

This is a minimal, surgical fix. Do NOT:
- Add new tests (restoring an existing code path — no new behavior).
- Refactor the file further (no export changes, no rename, no module split).
- Modify `trigger.config.ts`, `src/trigger/ingest-hourly.ts`, or any consumer.
- Touch `ws` or `@neondatabase/serverless` versions.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test -- src/lib/db 2>/dev/null || pnpm test</automated>
  </verify>
  <done>
- `src/lib/db/client.ts` contains exactly one unconditional `neonConfig.webSocketConstructor = ws;` at module top-level.
- The `if (typeof WebSocket === 'undefined')` guard is gone.
- `pnpm typecheck` exits 0.
- `pnpm test` exits 0 (existing vitest suite continues to pass — vitest.setup.ts's DATABASE_URL placeholder means `import '@/lib/db/client'` still evaluates without throwing).
- Grep check: `grep -n "typeof WebSocket" src/lib/db/client.ts` returns nothing.
- Grep check: `grep -n "neonConfig.webSocketConstructor" src/lib/db/client.ts` returns exactly one line.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Deploy to Trigger.dev prod and validate ingest-hourly succeeds</name>
  <what-built>
One-line fix to `src/lib/db/client.ts` that unconditionally binds `ws` as Neon's WebSocket constructor. This removes the Node 22 code path where `globalThis.WebSocket` (Undici) was silently preferred and failed Neon's handshake.
  </what-built>
  <how-to-verify>
After Task 1 is committed to `master` (or the fix branch is merged), verify prod in this order:

1. Deploy to Trigger.dev prod (either of these two paths — pick ONE):
   - **CI path (preferred if GitHub → Trigger.dev deploy is wired):** Merge the fix PR to `master`. Wait for the Trigger.dev CI deploy to finish (watch the Trigger.dev dashboard `ai-hotspot` project Deployments tab for a new prod deployment matching the merge commit SHA).
   - **Manual path:** From repo root run `pnpm trigger:deploy` (which invokes `pnpm dlx trigger.dev@latest deploy` per package.json:33). Requires `TRIGGER_ACCESS_TOKEN` in env and `TRIGGER_PROJECT_REF` resolvable for prod.

2. Open the Trigger.dev dashboard → project `ai-hotspot` → Tasks → `ingest-hourly` → "Test" (or "Run now").

3. Trigger a manual prod run of `ingest-hourly` with any payload (scheduled cron payload shape, or leave default).

4. Expected:
   - Run completes with status **COMPLETED** (not FAILED).
   - Duration is dominated by downstream `fetch-source` children (seconds to low minutes), NOT a sub-2s abort.
   - The run output JSON contains `sourceCount`, `successes`, `failures`, `newItemsTotal` fields (shape from `src/trigger/ingest-hourly.ts:47-53`).
   - Task logs show the `select id, rss_url from sources where is_active = $1` query succeeding (no Drizzle wrapper error).

5. Failure signals to flag:
   - Run still fails in under 2 seconds → fix did not deploy, or prod bundle is cached. Force a fresh deploy.
   - `Failed query: select id, rss_url from sources` still appears → the old bundle is still live; verify deploy commit SHA.
   - A different error (e.g. `DATABASE_URL` missing, RSSHub 503) → NOT a regression from this fix; note it and proceed — that's pre-existing Phase 2 scope (see STATE.md blockers).

Note on Phase 2 SC#2 blocker (STATE.md): RSSHub at `lurnings-rsshub.hf.space` returns 503 on all canary routes. A successful `ingest-hourly` run in this scenario will show `failures > 0` / `newItemsTotal == 0` at the child-fetch-source layer — that is NOT a regression from this fix. The fix is validated by the parent task reaching the child batch (query succeeded), regardless of RSSHub's health.
  </how-to-verify>
  <resume-signal>
Type "approved" once the prod `ingest-hourly` run completes without the Drizzle/Neon WebSocket error — or describe any new failure mode observed.
  </resume-signal>
</task>

</tasks>

<verification>
Phase-level checks:
- `src/lib/db/client.ts` diff is exactly the removal of the conditional + one new explanatory comment — no collateral edits.
- `pnpm typecheck` green.
- `pnpm test` green.
- Trigger.dev prod `ingest-hourly` manual run reaches the fan-out stage (no sub-2s Neon handshake death).
</verification>

<success_criteria>
- [ ] `src/lib/db/client.ts` has no `typeof WebSocket` guard.
- [ ] `neonConfig.webSocketConstructor = ws;` is set unconditionally at module top-level.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] A post-deploy manual run of `ingest-hourly` in Trigger.dev prod completes without the `Failed query: select id, rss_url from sources where is_active = $1` wrapper error.
</success_criteria>

<output>
After completion, create `.planning/quick/260422-rax-fix-trigger-dev-ingest-hourly-fails-due-/260422-rax-SUMMARY.md` capturing:
- The one-line root cause (Node 22 native WebSocket short-circuited ws binding).
- The fix (unconditional `neonConfig.webSocketConstructor = ws`).
- Prod verification outcome (run ID of the successful post-fix `ingest-hourly` run).
- Any follow-ups (e.g., RSSHub 503 still blocks Phase 2 SC#2 — unrelated to this fix).
</output>
