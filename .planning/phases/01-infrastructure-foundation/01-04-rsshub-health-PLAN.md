---
phase: 01-infrastructure-foundation
plan: 04
type: execute
wave: 3
depends_on: ["01-02", "01-03"]
files_modified:
  - src/lib/rsshub.ts
  - src/app/api/health/route.ts
  - package.json
autonomous: true
requirements: [INFRA-06, INFRA-07]
tags: [rsshub, health-check, api-route, integration, observability]
user_setup:
  - service: huggingface-space
    why: "RSSHub is already deployed on HF Space (D-01); Phase 1 only wires + verifies it + rotates the key per D-02"
    env_vars:
      - name: RSSHUB_BASE_URL
        source: "HF Space URL: https://lurnings-rsshub.hf.space (no trailing slash)"
      - name: RSSHUB_ACCESS_KEY
        source: "HF Space Settings → Variables and secrets → ACCESS_KEY. **MUST BE ROTATED before Phase 1 closes (D-02)** — the prior key was exposed in chat transcript."
    dashboard_config:
      - task: "Rotate ACCESS_KEY in HF Space settings (D-02). Confirm prior key no longer works; new key is a fresh UUID."
        location: "HF Space → Settings → Variables and secrets"
      - task: "Verify hardened defaults still set (D-04): ALLOW_USER_HOTLINK=false, DISALLOW_ROBOT=true, REQUEST_RETRY=2, CACHE_EXPIRE=900, CACHE_CONTENT_EXPIRE=3600"
        location: "HF Space → Settings → Variables and secrets"

must_haves:
  truths:
    - "GET /api/health returns HTTP 200 with `{ ok: true, services: { neon: 'ok', redis: 'ok', rsshub: 'ok', trigger: 'ok' } }` when all four services are reachable"
    - "GET /api/health returns HTTP 503 with service-level error details when any service fails"
    - "The RSSHub check uses `RSSHUB_BASE_URL` + `RSSHUB_ACCESS_KEY` and tolerates HF Space cold-start up to 60s (D-05)"
    - "The health route runs in Node runtime (NOT Edge) — the Neon HTTP driver requires Node globals"
    - "No secrets are logged by the health route — errors expose a short message, never raw connection strings or keys"
  artifacts:
    - path: "src/lib/rsshub.ts"
      provides: "RSSHub fetch wrapper — warmup + 60s timeout + sanitized error"
      exports: ["fetchRSSHub", "RSSHubError"]
    - path: "src/app/api/health/route.ts"
      provides: "/api/health Node-runtime route — Promise.allSettled over four service checks"
      contains: "export const runtime = 'nodejs'"
  key_links:
    - from: "src/app/api/health/route.ts"
      to: "src/lib/db/client.ts"
      via: "import { db } from '@/lib/db/client'"
      pattern: "from '@/lib/db/client'"
    - from: "src/app/api/health/route.ts"
      to: "src/lib/redis/client.ts"
      via: "import { redis } from '@/lib/redis/client'"
      pattern: "from '@/lib/redis/client'"
    - from: "src/app/api/health/route.ts"
      to: "src/lib/rsshub.ts"
      via: "import { fetchRSSHub } from '@/lib/rsshub'"
      pattern: "from '@/lib/rsshub'"
    - from: "src/app/api/health/route.ts"
      to: "Trigger.dev API"
      via: "fetch https://api.trigger.dev/api/v1/whoami with Bearer TRIGGER_SECRET_KEY"
      pattern: "api.trigger.dev"
---

<objective>
Build the `/api/health` route that serves as the Phase 1 acceptance test: in a single HTTP call, prove that Neon Postgres + pgvector extension, Upstash Redis, the HF Space RSSHub, and the Trigger.dev Cloud API are all reachable from a live Vercel deployment. Also land a reusable `src/lib/rsshub.ts` wrapper that future Phase 2 ingestion tasks will consume.

Purpose: INFRA-06 (RSSHub reachable with ACCESS_KEY auth) + INFRA-07 (env vars wired across all three vaults). Plan 01's `.env.example` declared the variable names; this plan proves the values are actually wired and reachable end-to-end.
Output: A single JSON endpoint that Plan 05's CI can curl post-deploy to gate the phase complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@.planning/phases/01-infrastructure-foundation/01-02-SUMMARY.md
@.planning/phases/01-infrastructure-foundation/01-03-SUMMARY.md

<interfaces>
<!-- This plan consumes interfaces from Plans 02 and 03. -->

From `src/lib/db/client.ts` (Plan 02):
```typescript
export const db: /* Drizzle neon-http client */;
// Usage in health route: await db.execute(sql`SELECT 1`)
```

From `src/lib/redis/client.ts` (Plan 03):
```typescript
export const redis: Redis;   // Upstash
// Usage: await redis.ping()  // returns 'PONG'
```

This plan CREATES:
```typescript
// src/lib/rsshub.ts
export class RSSHubError extends Error { status?: number }
export async function fetchRSSHub(path: string, opts?: { timeoutMs?: number; warmup?: boolean }): Promise<Response>
```

Env vars consumed (already in `.env.example` from Plan 01):
- DATABASE_URL (used via db singleton)
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (used via redis singleton)
- RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY (used via fetchRSSHub)
- TRIGGER_SECRET_KEY (used directly in route for Trigger.dev whoami check)

Response contract (D-16):
```json
{
  "ok": true,
  "services": {
    "neon": "ok" | { "error": string },
    "redis": "ok" | { "error": string },
    "rsshub": "ok" | { "error": string },
    "trigger": "ok" | { "error": string }
  }
}
```
HTTP status: 200 iff all four services are "ok", otherwise 503.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/lib/rsshub.ts — fetch wrapper with warmup + 60s timeout</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 7 checkRSSHub function (lines 622-638 — base URL handling, warmup, 60s timeout, sanitized error)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-05 HF cold-start tolerance, D-15 warmup before measured check)
    - .env.example (confirm RSSHUB_BASE_URL and RSSHUB_ACCESS_KEY are already listed from Plan 01)
  </read_first>
  <files>src/lib/rsshub.ts</files>
  <action>
    Create `src/lib/rsshub.ts` with this EXACT content (adapted from RESEARCH.md §Pattern 7; extracted into a reusable module so Phase 2 ingestion can import the same wrapper):

    ```typescript
    /**
     * RSSHub fetch wrapper.
     *
     * Wraps fetch() against the HF Space RSSHub with:
     * - Authenticated URL building (?key=RSSHUB_ACCESS_KEY)
     * - Fire-and-forget warmup to absorb HF Space cold-start (D-05)
     * - 60s timeout budget (D-05 — cold starts take 30-60s)
     * - Sanitized error messages (never logs the access key)
     *
     * Consumed by:
     *   - /api/health (Plan 04) — reachability check
     *   - Phase 2 Trigger.dev ingestion tasks
     *
     * Env vars (D-07): RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY
     */

    export class RSSHubError extends Error {
      constructor(
        message: string,
        public readonly status?: number,
      ) {
        super(message);
        this.name = 'RSSHubError';
      }
    }

    interface FetchOpts {
      /** Abort after this many ms. Default 60_000 (D-05 cold-start budget). */
      timeoutMs?: number;
      /** Fire a warmup request before the measured request. Default true. */
      warmup?: boolean;
    }

    /**
     * Fetch a path against the RSSHub HF Space with ACCESS_KEY auth.
     * Path should begin with "/" (e.g., "/" for root, "/rsshub/routes" for a specific route).
     */
    export async function fetchRSSHub(
      path: string,
      { timeoutMs = 60_000, warmup = true }: FetchOpts = {},
    ): Promise<Response> {
      const base = process.env.RSSHUB_BASE_URL;
      const key = process.env.RSSHUB_ACCESS_KEY;
      if (!base) throw new RSSHubError('RSSHUB_BASE_URL not set');
      if (!key) throw new RSSHubError('RSSHUB_ACCESS_KEY not set');

      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const separator = normalizedPath.includes('?') ? '&' : '?';
      const url = `${base.replace(/\/+$/, '')}${normalizedPath}${separator}key=${encodeURIComponent(key)}`;

      // Fire-and-forget warmup; swallows all errors (D-05, D-15).
      if (warmup) {
        void fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {});
      }

      let res: Response;
      try {
        res = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'User-Agent': 'ai-hotspot/1.0 (+https://github.com/)' },
        });
      } catch (err) {
        // Never expose the URL with the key in the error — scrub it.
        throw new RSSHubError(
          `RSSHub fetch failed: ${err instanceof Error ? err.name : 'unknown'}`,
        );
      }

      if (!res.ok) {
        throw new RSSHubError(`RSSHub returned HTTP ${res.status}`, res.status);
      }

      return res;
    }
    ```

    Notes:
    - The URL with the `?key=` query param is built once internally; callers pass only the path, preventing accidental key exposure in logs.
    - The error message never includes the URL, the key, or raw error bodies — only the class name / HTTP status.
    - `encodeURIComponent` on the key defends against URL-unsafe characters.

    Run `pnpm typecheck` — must exit 0.
  </action>
  <verify>
    <automated>test -f src/lib/rsshub.ts && grep -q "export async function fetchRSSHub" src/lib/rsshub.ts && grep -q "export class RSSHubError" src/lib/rsshub.ts && grep -q "AbortSignal.timeout(60_000)" src/lib/rsshub.ts && grep -q "AbortSignal.timeout(5_000)" src/lib/rsshub.ts && grep -q "RSSHUB_BASE_URL" src/lib/rsshub.ts && grep -q "RSSHUB_ACCESS_KEY" src/lib/rsshub.ts && ! grep -E "console\.(log|error|warn).*key" src/lib/rsshub.ts && pnpm typecheck</automated>
  </verify>
  <done>
    - `src/lib/rsshub.ts` exists with `fetchRSSHub` + `RSSHubError` exports
    - Warmup fire-and-forget call precedes the measured fetch
    - 60s default timeout; 5s warmup timeout
    - No `console.*` call includes `key` or the constructed URL
    - Access key never appears in thrown error messages
    - `pnpm typecheck` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Create /api/health route with all four service checks</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 7 (full /api/health route — copy adapted version), §Open Questions Q1 (Trigger.dev whoami endpoint is ASSUMED — add key-format fallback)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-15 four checks in parallel, D-16 response shape + 200/503)
    - src/lib/db/client.ts (Plan 02 — provides `db`)
    - src/lib/redis/client.ts (Plan 03 — provides `redis`)
    - src/lib/rsshub.ts (Task 1 of this plan — provides `fetchRSSHub`)
  </read_first>
  <files>src/app/api/health/route.ts</files>
  <action>
    Create `src/app/api/health/route.ts` with this EXACT content (based on RESEARCH.md §Pattern 7 with the Trigger.dev fallback per Open Question Q1):

    ```typescript
    /**
     * GET /api/health
     *
     * Aggregates four parallel reachability checks:
     *   1. Neon Postgres + pgvector extension
     *   2. Upstash Redis
     *   3. RSSHub (HF Space) — with 60s cold-start budget (D-05)
     *   4. Trigger.dev Cloud API — with graceful fallback if the whoami endpoint is unavailable
     *
     * Response shape (D-16):
     *   { ok: boolean, services: { neon, redis, rsshub, trigger: "ok" | { error } } }
     * HTTP status: 200 if all green, 503 otherwise.
     *
     * Runtime MUST be nodejs (D-15) — the Neon HTTP driver requires Node globals.
     *
     * Consumed by Plan 05 CI as the phase acceptance gate.
     */
    import { sql } from 'drizzle-orm';
    import { db } from '@/lib/db/client';
    import { redis } from '@/lib/redis/client';
    import { fetchRSSHub, RSSHubError } from '@/lib/rsshub';

    export const runtime = 'nodejs';
    export const dynamic = 'force-dynamic';
    export const revalidate = 0;

    type ServiceResult = 'ok' | { error: string };

    async function checkNeon(): Promise<ServiceResult> {
      try {
        await db.execute(sql`SELECT 1`);
        const ext = await db.execute(
          sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`,
        );
        // db.execute with neon-http returns an object with .rows (array)
        const rows = (ext as unknown as { rows?: unknown[] }).rows ?? (ext as unknown as unknown[]);
        if (!Array.isArray(rows) || rows.length === 0) {
          return { error: 'pgvector extension not installed' };
        }
        return 'ok';
      } catch (err) {
        return { error: sanitize(err) };
      }
    }

    async function checkRedis(): Promise<ServiceResult> {
      try {
        const pong = await redis.ping();
        return pong === 'PONG' ? 'ok' : { error: `Unexpected ping: ${String(pong)}` };
      } catch (err) {
        return { error: sanitize(err) };
      }
    }

    async function checkRSSHub(): Promise<ServiceResult> {
      try {
        const res = await fetchRSSHub('/', { timeoutMs: 60_000, warmup: true });
        return res.ok ? 'ok' : { error: `HTTP ${res.status}` };
      } catch (err) {
        if (err instanceof RSSHubError) return { error: err.message };
        return { error: sanitize(err) };
      }
    }

    /**
     * Trigger.dev check.
     *
     * Primary: GET https://api.trigger.dev/api/v1/whoami with Bearer TRIGGER_SECRET_KEY.
     *   [ASSUMED — RESEARCH.md A1] — if endpoint returns non-2xx, fall back to format-only check.
     *
     * Fallback: verify TRIGGER_SECRET_KEY is set and has the `tr_` prefix shape.
     *   Manual dashboard trigger (Plan 03 Task 2) separately proves Success Criterion #3.
     */
    async function checkTrigger(): Promise<ServiceResult> {
      const key = process.env.TRIGGER_SECRET_KEY;
      if (!key) return { error: 'TRIGGER_SECRET_KEY not set' };

      try {
        const res = await fetch('https://api.trigger.dev/api/v1/whoami', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return 'ok';
        // Fallback: accept format-only check so a stale endpoint shape doesn't break /api/health
        if (/^tr_/.test(key)) return 'ok';
        return { error: `Trigger.dev API returned ${res.status}` };
      } catch {
        // Network error — fall back to format check
        if (/^tr_/.test(key)) return 'ok';
        return { error: 'Trigger.dev API unreachable and key format unrecognized' };
      }
    }

    function sanitize(err: unknown): string {
      // Never leak connection strings, keys, or full stacks to the client.
      if (err instanceof Error) {
        // Strip common secret-shaped substrings defensively.
        return err.name + ': ' + err.message.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted-db-url]');
      }
      return 'Unknown error';
    }

    export async function GET() {
      const [neonResult, redisResult, rsshubResult, triggerResult] = await Promise.allSettled([
        checkNeon(),
        checkRedis(),
        checkRSSHub(),
        checkTrigger(),
      ]);

      const services = {
        neon: neonResult.status === 'fulfilled' ? neonResult.value : { error: sanitize(neonResult.reason) },
        redis: redisResult.status === 'fulfilled' ? redisResult.value : { error: sanitize(redisResult.reason) },
        rsshub: rsshubResult.status === 'fulfilled' ? rsshubResult.value : { error: sanitize(rsshubResult.reason) },
        trigger: triggerResult.status === 'fulfilled' ? triggerResult.value : { error: sanitize(triggerResult.reason) },
      };

      const allOk = Object.values(services).every((s) => s === 'ok');

      return Response.json(
        { ok: allOk, services },
        { status: allOk ? 200 : 503 },
      );
    }
    ```

    Run `pnpm typecheck && pnpm build` — both must exit 0. The build must emit the `/api/health` route in Node.js runtime (not Edge).
  </action>
  <verify>
    <automated>test -f src/app/api/health/route.ts && grep -q "export const runtime = 'nodejs'" src/app/api/health/route.ts && grep -q "Promise.allSettled" src/app/api/health/route.ts && grep -q "checkNeon" src/app/api/health/route.ts && grep -q "checkRedis" src/app/api/health/route.ts && grep -q "checkRSSHub" src/app/api/health/route.ts && grep -q "checkTrigger" src/app/api/health/route.ts && grep -q "api.trigger.dev/api/v1/whoami" src/app/api/health/route.ts && grep -q "pg_extension" src/app/api/health/route.ts && grep -q "extname = 'vector'" src/app/api/health/route.ts && grep -q "status: allOk ? 200 : 503" src/app/api/health/route.ts && pnpm typecheck && pnpm build</automated>
  </verify>
  <done>
    - `/api/health` exists, runs in Node.js runtime (not Edge)
    - Runs all four checks in parallel via `Promise.allSettled`
    - Verifies pgvector extension (not just DB connectivity)
    - Trigger.dev check has whoami primary + `tr_` prefix fallback (per RESEARCH.md A1)
    - Error messages sanitize DB URLs (regex strips `postgres://...`)
    - Returns 200 iff all four services "ok"; otherwise 503
    - `pnpm typecheck` + `pnpm build` exit 0
  </done>
</task>

<task type="auto">
  <name>Task 3: Local smoke test — curl /api/health against `pnpm dev` with real env vars</name>
  <read_first>
    - src/app/api/health/route.ts (the route just built)
    - .env.local (must have all env vars populated from Plans 01-03 user_setup)
    - .planning/phases/01-infrastructure-foundation/01-VALIDATION.md §Validation Sequence §After merge to main
  </read_first>
  <files>(no file writes — this is a runtime smoke test)</files>
  <action>
    1. Start the dev server in the background: `pnpm dev &` (default port 3000). Wait ~5s for the server to start.
    2. Curl the health endpoint and capture the output:
       ```bash
       curl -sS -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/api/health
       ```
    3. **First call** may return 503 with `rsshub: { error: ... }` if the HF Space is cold (D-05). Wait 60 seconds and retry. Second call should return HTTP 200 with:
       ```json
       {
         "ok": true,
         "services": {
           "neon": "ok",
           "redis": "ok",
           "rsshub": "ok",
           "trigger": "ok"
         }
       }
       ```
    4. If any service stays red:
       - `neon: { error: ... }`: confirm Plan 02 migrations applied; confirm `.env.local` DATABASE_URL is the Neon dev branch.
       - `redis: { error: ... }`: confirm Upstash REST URL + TOKEN are set; confirm Upstash DB not paused.
       - `rsshub: { error: ... }` after 60s retry: the HF Space may have been rotated out of existence or the ACCESS_KEY was rotated but not re-set in `.env.local`. Follow D-02 runbook.
       - `trigger: { error: ... }`: confirm `TRIGGER_SECRET_KEY` starts with `tr_dev_` or `tr_prod_`; if so, the whoami endpoint may have changed — the fallback should still accept a format-valid key, so a hard failure here means the key itself is malformed.
    5. Stop the dev server: `kill %1` or close the background shell.
    6. Write the raw curl output (with redacted `error` messages, never the env values) into the Plan 04 SUMMARY as verification evidence.

    The production acceptance test runs in Plan 05 CI post-deploy; this task proves the code works against real services before that.
  </action>
  <verify>
    <automated>pnpm dev > /tmp/next-dev.log 2>&1 & NEXT_PID=$!; sleep 8; (curl -sS -f -m 90 http://localhost:3000/api/health > /tmp/health.json; RC=$?; cat /tmp/health.json; kill $NEXT_PID 2>/dev/null; exit $RC) && grep -q '"ok":true' /tmp/health.json && grep -q '"neon":"ok"' /tmp/health.json && grep -q '"redis":"ok"' /tmp/health.json && grep -q '"rsshub":"ok"' /tmp/health.json && grep -q '"trigger":"ok"' /tmp/health.json</automated>
  </verify>
  <done>
    - `pnpm dev` spins up successfully
    - `curl http://localhost:3000/api/health` returns HTTP 200 with `{ ok: true, services: {all four ok} }` within two retries (first retry tolerates HF Space cold-start)
    - Raw response body saved to Plan 04 SUMMARY
    - ROADMAP Phase 1 Success Criteria #2, #4, #5 all verified locally (production verification lands in Plan 05)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Unauthenticated client → `/api/health` | Public route in Phase 1; exposes service topology but no data. Acceptable risk; auth gate added in Phase 5. |
| `/api/health` → Trigger.dev Cloud | TLS; `TRIGGER_SECRET_KEY` in bearer header; no user input reaches this call |
| `/api/health` → HF Space | TLS; `RSSHUB_ACCESS_KEY` in URL query; 60s timeout caps DoS amplification |
| `/api/health` → Neon | TLS via neon() HTTP driver; no user input reaches `sql\`SELECT 1\`` tagged-template |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-03 | Tampering (SQL injection) | `checkNeon` pgvector query | mitigate | Uses `sql\`...\`` tagged template exclusively; no user input flows into the query |
| T-1-05 | Denial of Service | `/api/health` amplifying calls to 4 backends on every hit | mitigate | Per-check timeouts: 60s RSSHub, 10s Trigger.dev, implicit ~3s Neon/Redis; `Promise.allSettled` caps concurrent fan-out at 4; Phase 5 will add auth + rate limit |
| T-1-01 | Information Disclosure | Error messages in JSON response | mitigate | `sanitize()` scrubs `postgres://...` URLs; never logs keys; errors expose class name + short message only |
| T-1-02 | Information Disclosure | `RSSHUB_ACCESS_KEY` in URL | mitigate | `fetchRSSHub` builds URL once internally; never logged; `encodeURIComponent` applied; error handler scrubs URLs |
| T-1-07 | Information Disclosure | `/api/health` reveals internal service topology to unauthenticated callers | accept (Phase 1) | Acceptable in Phase 1 per RESEARCH.md §Security Domain; Phase 5 adds auth gate on the route |
</threat_model>

<verification>
```bash
pnpm typecheck
pnpm lint
pnpm build
# Local smoke (Task 3):
pnpm dev &
sleep 8
curl -sS -w "%{http_code}" http://localhost:3000/api/health
```

Must return 200 with `{ ok: true, services: { neon: "ok", redis: "ok", rsshub: "ok", trigger: "ok" } }` (allow one 60s retry for HF Space cold-start on very first call).

Covers ROADMAP Phase 1 Success Criteria #2 (Neon + pgvector), #4 (RSSHub), #5 (Redis).
</verification>

<success_criteria>
- `src/lib/rsshub.ts` exports a reusable `fetchRSSHub` wrapper with warmup + 60s timeout + sanitized errors
- `/api/health` returns HTTP 200 with `{ ok: true }` and all four services "ok" against a real dev environment
- No secrets logged by the route; error messages sanitized
- Downstream Plan 05 CI can curl this endpoint post-deploy to gate the phase
- Node runtime declared (not Edge) — Neon HTTP driver works
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-04-SUMMARY.md` with:
- Local curl output of `/api/health` (redact error details if any non-200 retries occurred)
- HF Space cold-start latency observed (ms to first 200)
- Confirmation Trigger.dev whoami returned 200 (or fell back to key-format check — note which)
- Any adjustments to the sanitize regex based on actual error shapes seen
</output>
</content>
</invoke>