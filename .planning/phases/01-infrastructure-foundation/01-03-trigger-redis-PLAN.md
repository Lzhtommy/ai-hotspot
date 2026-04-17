---
phase: 01-infrastructure-foundation
plan: 03
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - package.json
  - trigger.config.ts
  - src/trigger/health-probe.ts
  - src/trigger/index.ts
  - src/lib/redis/client.ts
  - .gitignore
autonomous: false
requirements: [INFRA-04, INFRA-05]
tags: [trigger-dev, redis, upstash, workers, background-jobs]
user_setup:
  - service: trigger-dev
    why: "v4 worker platform for Phase 2 hourly ingestion; Phase 1 lands minimal health-probe task for Success Criterion #3"
    env_vars:
      - name: TRIGGER_SECRET_KEY
        source: "Trigger.dev dashboard → Project → API Keys → Secret key (per environment: dev, staging, prod). Value prefixed tr_dev_ / tr_prod_."
      - name: TRIGGER_ACCESS_TOKEN
        source: "Trigger.dev dashboard → Profile → Personal Access Tokens. CI-only; not used at runtime. Paste into GitHub Actions secrets in Plan 05."
      - name: TRIGGER_PROJECT_REF
        source: "Trigger.dev dashboard → Project Settings → Project ref (format: proj_XXXXXX)"
    dashboard_config:
      - task: "Create Trigger.dev project in the cloud (US region is fine — workers call Neon over HTTPS)"
        location: "https://cloud.trigger.dev/orgs/new"
      - task: "Set DATABASE_URL, ANTHROPIC_API_KEY, VOYAGE_API_KEY, RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY as Trigger.dev Cloud env vars (dev environment only in Phase 1; prod values land in Plan 05)"
        location: "Trigger.dev dashboard → Project → Environment Variables"
      - task: "Run `pnpm dlx trigger.dev@latest login` locally (one-time) to authenticate the CLI"
        location: "Terminal"
  - service: upstash
    why: "HTTP-based Redis for feed caching + rate limiting (Phase 4+); Phase 1 verifies connectivity only"
    env_vars:
      - name: UPSTASH_REDIS_REST_URL
        source: "Upstash Console → Redis database → REST API → UPSTASH_REDIS_REST_URL"
      - name: UPSTASH_REDIS_REST_TOKEN
        source: "Upstash Console → Redis database → REST API → UPSTASH_REDIS_REST_TOKEN"
    dashboard_config:
      - task: "Create an Upstash Redis DB in a region close to Vercel's default (e.g., us-east-1 or ap-southeast-1)"
        location: "https://console.upstash.com/redis"

must_haves:
  truths:
    - "Running `pnpm dlx trigger.dev@latest dev` locally with `TRIGGER_SECRET_KEY` set starts the local worker and registers the `health-probe` task"
    - "The `health-probe` task can be triggered from the Trigger.dev dashboard and returns `{ ok: true, timestamp: ... }` without timeout (Phase 1 Success Criterion #3)"
    - "Importing `redis` from `src/lib/redis/client.ts` in a Node.js script and calling `redis.ping()` returns `'PONG'`"
    - "`trigger.config.ts` at repo root declares `dirs: ['./src/trigger']` (D-13)"
    - "`@trigger.dev/sdk` v4 is in package.json (NOT v3, NOT `@trigger.dev/sdk/v3` import path)"
  artifacts:
    - path: "trigger.config.ts"
      provides: "Trigger.dev v4 project config"
      contains: "dirs: ['./src/trigger']"
    - path: "src/trigger/health-probe.ts"
      provides: "Minimal task satisfying INFRA-05 success criterion #3"
      exports: ["healthProbe"]
    - path: "src/trigger/index.ts"
      provides: "Re-export barrel for all tasks (so type-only imports in API routes resolve)"
      contains: "export"
    - path: "src/lib/redis/client.ts"
      provides: "Upstash Redis singleton consumed by `/api/health` in Plan 04 + Phase 4 feed cache"
      exports: ["redis"]
  key_links:
    - from: "src/lib/redis/client.ts"
      to: "process.env.UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN"
      via: "new Redis({ url, token })"
      pattern: "new Redis\\(\\{"
    - from: "trigger.config.ts"
      to: "src/trigger/*.ts"
      via: "dirs option"
      pattern: "dirs:.*src/trigger"
    - from: "src/trigger/health-probe.ts"
      to: "Trigger.dev Cloud"
      via: "pnpm dlx trigger.dev deploy (manual Phase 1; CI-automated in Plan 05)"
      pattern: "task\\(\\{"
---

<objective>
Wire up both parallel worker-side dependencies: Trigger.dev v4 (with a minimal `health-probe` task proving the worker is reachable — ROADMAP Success Criterion #3) and Upstash Redis (singleton client — consumed by `/api/health` in Plan 04). This plan runs in wave 2 alongside Plan 02; it has no schema dependencies so it can execute in parallel with Drizzle setup.

Purpose: INFRA-04 (Upstash Redis reachable) + INFRA-05 (Trigger.dev v4 linked). Phase 2 will build the real hourly ingestion on top of this foundation.
Output: A deployable Trigger.dev project linked to the repo + a Redis client module + a manually-runnable `health-probe` task.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@.planning/STATE.md

<interfaces>
<!-- Consumed by Plan 04 (/api/health imports both `redis` and the `healthProbe` type) -->

From `src/lib/redis/client.ts` (this plan creates):
```typescript
import { Redis } from '@upstash/redis';
export const redis: Redis; // new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
```

From `src/trigger/health-probe.ts` (this plan creates):
```typescript
import { task } from '@trigger.dev/sdk';
export const healthProbe = task({ id: 'health-probe', run: async () => ({ ok: true, timestamp: string }) });
```

From `src/trigger/index.ts` (barrel):
```typescript
export * from './health-probe';
```

Env var pins (D-06, D-07 — already in .env.example from Plan 01):
- `TRIGGER_SECRET_KEY` (runtime — Vercel + .env.local)
- `TRIGGER_ACCESS_TOKEN` (CI deploy only — GH Actions secrets in Plan 05)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (runtime — Vercel + .env.local)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install @trigger.dev/sdk v4 + scaffold trigger.config.ts + health-probe task</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 5 (Trigger.dev v4 Setup — full verbatim config), §Anti-Patterns (do NOT import from `@trigger.dev/sdk/v3`; do NOT use `@trigger.dev/nextjs`), §Common Pitfalls §Pitfall 3 (SECRET_KEY vs ACCESS_TOKEN)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-13 tasks under src/trigger/)
    - package.json (confirm pnpm is wired)
    - .env.example (variable names already declared in Plan 01)
  </read_first>
  <files>package.json, trigger.config.ts, src/trigger/health-probe.ts, src/trigger/index.ts, .gitignore</files>
  <action>
    1. Install deps: `pnpm add @trigger.dev/sdk@^4` and `pnpm add -D @trigger.dev/build@^4 trigger.dev@^4`. Pin to `^4` (NOT 3) per D-13 and STATE.md.
    2. Run `pnpm dlx trigger.dev@latest init` — this is supposed to scaffold `trigger.config.ts` and `src/trigger/` automatically. Accept defaults. If the init command requires interactive input and cannot run cleanly, skip it and proceed to step 3 (create files manually).
    3. Ensure `trigger.config.ts` at repo root has the EXACT shape below (per RESEARCH.md §Pattern 5). Replace `<your-project-ref>` with the value from `TRIGGER_PROJECT_REF` env var if the init step already prefilled it; otherwise leave the literal string `process.env.TRIGGER_PROJECT_REF!` so the user can set it later without editing code:
       ```typescript
       import { defineConfig } from '@trigger.dev/sdk/build';

       export default defineConfig({
         project: process.env.TRIGGER_PROJECT_REF!,
         dirs: ['./src/trigger'],
         runtime: 'node',
         logLevel: 'log',
         retries: {
           enabledInDev: false,
           default: {
             maxAttempts: 3,
             minTimeoutInMs: 1000,
             maxTimeoutInMs: 10000,
             factor: 2,
             randomize: true,
           },
         },
       });
       ```
       **CRITICAL:** The import MUST be `from '@trigger.dev/sdk/build'` (NOT `@trigger.dev/sdk/v3/build` or any v3 path). See RESEARCH.md Anti-Pattern.
    4. Create `src/trigger/health-probe.ts` with this EXACT content (per RESEARCH.md §Pattern 5):
       ```typescript
       import { task } from '@trigger.dev/sdk';

       export const healthProbe = task({
         id: 'health-probe',
         run: async () => {
           return { ok: true, timestamp: new Date().toISOString() };
         },
       });
       ```
    5. Create `src/trigger/index.ts` as a barrel:
       ```typescript
       // Barrel export — add new task exports here as phases grow.
       export * from './health-probe';
       ```
    6. Add to `.gitignore` (append — do not replace existing entries):
       ```
       # Trigger.dev
       .trigger/
       ```
    7. Add to `package.json` scripts:
       ```json
       "trigger:dev": "trigger.dev dev",
       "trigger:deploy": "trigger.dev deploy"
       ```
    8. Run `pnpm typecheck` — must exit 0.
  </action>
  <verify>
    <automated>test -f trigger.config.ts && test -f src/trigger/health-probe.ts && test -f src/trigger/index.ts && grep -q "dirs: \['./src/trigger'\]" trigger.config.ts && grep -q "from '@trigger.dev/sdk/build'" trigger.config.ts && grep -q "from '@trigger.dev/sdk'" src/trigger/health-probe.ts && ! grep -q "@trigger.dev/sdk/v3" trigger.config.ts src/trigger/health-probe.ts && grep -q "\"@trigger.dev/sdk\": \"\\^4" package.json && grep -q "\".trigger/\"" .gitignore || grep -q ".trigger/" .gitignore && pnpm typecheck</automated>
  </verify>
  <done>
    - `@trigger.dev/sdk@^4`, `@trigger.dev/build@^4`, `trigger.dev@^4` installed (NOT 3.x)
    - `trigger.config.ts` imports from `@trigger.dev/sdk/build`, declares `dirs: ['./src/trigger']`
    - `src/trigger/health-probe.ts` exports a `task({ id: 'health-probe', ... })` from `@trigger.dev/sdk`
    - `src/trigger/index.ts` barrels all tasks
    - No `@trigger.dev/sdk/v3` imports anywhere
    - `.trigger/` in `.gitignore`
    - `pnpm typecheck` exits 0
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Deploy health-probe to Trigger.dev Cloud + manually trigger (ROADMAP Success Criterion #3)</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 5 (CLI flow: login → init → dev → deploy; triggering from dashboard)
    - .planning/phases/01-infrastructure-foundation/01-VALIDATION.md §Manual-Only Verifications row "Trigger.dev dashboard manual task trigger"
    - trigger.config.ts, src/trigger/health-probe.ts
  </read_first>
  <what-built>
    - `trigger.config.ts` with `@trigger.dev/sdk/build` defineConfig
    - `src/trigger/health-probe.ts` with `task({ id: 'health-probe' })`
    - `src/trigger/index.ts` barrel
    - pnpm scripts `trigger:dev`, `trigger:deploy`
  </what-built>
  <how-to-verify>
    **Preconditions:**
    - User has run `pnpm dlx trigger.dev@latest login` once and is authenticated
    - `TRIGGER_SECRET_KEY` (for the dev environment) and `TRIGGER_PROJECT_REF` are set in local `.env.local`
    - Upstash + Trigger.dev dashboards both have the variables listed in frontmatter `user_setup`

    **Step 1 — Deploy the task to Trigger.dev Cloud:**
    ```bash
    # Deploy to dev environment (production deploy lands in Plan 05 CI)
    pnpm trigger:deploy --env dev
    ```
    Expected: deploy output reports `✔ Deployed health-probe` (or equivalent) and the Trigger.dev dashboard shows `health-probe` under Tasks in the dev environment.

    **Step 2 — Trigger the task manually from the Trigger.dev dashboard:**
    1. Open https://cloud.trigger.dev → your project → Dev environment → Tasks.
    2. Click `health-probe` → `Test` (or `Run`) → accept empty JSON payload `{}` → click Run.
    3. Wait for the run to transition from QUEUED → EXECUTING → COMPLETED.
    4. Inspect the run output: should show `{ ok: true, timestamp: "2026-04-17T..." }`.
    5. Run duration should be under 5 seconds (no timeout).

    **Step 3 — If deploy or trigger fails:**
    - 401 on deploy: `TRIGGER_ACCESS_TOKEN` wrong or missing. Run `pnpm dlx trigger.dev@latest login` again.
    - 404 on trigger: `dirs` in `trigger.config.ts` does not resolve to `src/trigger/*.ts` — check the path.
    - Run stuck in QUEUED > 30s: dev environment may not have an active worker. Run `pnpm trigger:dev` locally to tunnel a dev worker and re-trigger.

    **Acceptance:** Dashboard shows one COMPLETED run with `{ ok: true }` output. Take a screenshot or paste the run URL into the plan SUMMARY.

    This task IS Phase 1 Success Criterion #3 ("A Trigger.dev task can be triggered manually and succeeds without timeout errors"). Do NOT mark Plan 03 complete until this run shows green.
  </how-to-verify>
  <resume-signal>Type "approved" after pasting the Trigger.dev run URL or screenshot into the Plan 03 SUMMARY; or describe the failure mode so we can re-plan.</resume-signal>
  <files>(no file writes — deployment + manual dashboard trigger)</files>
  <action>See &lt;how-to-verify&gt; above — execute deploy + manual trigger steps, paste evidence into the plan SUMMARY.</action>
  <verify>
    <automated>MISSING — checkpoint task is human-gated; automated verification happens in Plan 04 /api/health (trigger: "ok" branch) and Plan 05 CI trigger-deploy job</automated>
  </verify>
  <done>Trigger.dev dashboard shows `health-probe` task deployed and one COMPLETED run with `{ ok: true, timestamp: ... }` output. Run URL pasted into Plan 03 SUMMARY.</done>
</task>

<task type="auto">
  <name>Task 3: Install @upstash/redis + create src/lib/redis/client.ts</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 6 (Upstash Redis Client — verbatim file content)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-15 Redis.ping() in /api/health)
    - .env.example (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN names locked)
  </read_first>
  <files>package.json, src/lib/redis/client.ts</files>
  <action>
    1. Install the client: `pnpm add @upstash/redis@^1`.
    2. Create `src/lib/redis/client.ts` with this EXACT content (per RESEARCH.md §Pattern 6):
       ```typescript
       import { Redis } from '@upstash/redis';

       /**
        * Upstash Redis client singleton.
        *
        * HTTP-based — safe for Vercel serverless and Edge (no persistent TCP pool).
        * Consumed by:
        *   - /api/health (Plan 04) — ping check
        *   - Phase 4 feed cache (5-min TTL)
        *   - Phase 4 rate limiting (Upstash Ratelimit SDK)
        *
        * Env vars (D-07): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
        */
       export const redis = new Redis({
         url: process.env.UPSTASH_REDIS_REST_URL!,
         token: process.env.UPSTASH_REDIS_REST_TOKEN!,
       });
       ```
    3. Verify the environment has both env vars set in `.env.local`. Then prove connectivity with a one-off script:
       ```bash
       node --experimental-vm-modules -e "
         require('dotenv').config({ path: '.env.local' });
         const { Redis } = require('@upstash/redis');
         const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
         redis.ping().then(r => { console.log('ping:', r); process.exit(r === 'PONG' ? 0 : 1); }).catch(e => { console.error(e); process.exit(1); });
       "
       ```
       Must print `ping: PONG` and exit 0. If the developer hasn't provisioned an Upstash DB yet, STOP and surface the user_setup step.
    4. Run `pnpm typecheck && pnpm lint` — must exit 0.
  </action>
  <verify>
    <automated>test -f src/lib/redis/client.ts && grep -q "import { Redis } from '@upstash/redis'" src/lib/redis/client.ts && grep -q "new Redis({" src/lib/redis/client.ts && grep -q "UPSTASH_REDIS_REST_URL" src/lib/redis/client.ts && grep -q "UPSTASH_REDIS_REST_TOKEN" src/lib/redis/client.ts && grep -q "\"@upstash/redis\":" package.json && pnpm typecheck && pnpm lint</automated>
  </verify>
  <done>
    - `@upstash/redis@^1` in package.json
    - `src/lib/redis/client.ts` exports `redis` singleton using Upstash REST URL+TOKEN
    - Live `redis.ping()` against the user's Upstash DB returned `PONG` (verified via the one-off script)
    - `pnpm typecheck` + `pnpm lint` exit 0
    - Phase 1 Success Criterion #5 (Upstash Redis ping returns OK) is partially satisfied — fully verified in Plan 04 via `/api/health`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Vercel runtime → Trigger.dev API | TLS; `TRIGGER_SECRET_KEY` in bearer auth; key rotates per environment |
| GitHub Actions → Trigger.dev | TLS; `TRIGGER_ACCESS_TOKEN` (different credential) for CLI deploy in Plan 05 |
| Vercel runtime → Upstash Redis REST | TLS; `UPSTASH_REDIS_REST_TOKEN` bearer; HTTP (no TCP) |
| Trigger.dev worker → Neon | TLS; `DATABASE_URL` set in Trigger.dev Cloud env, never in repo |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-01 | Information Disclosure | `TRIGGER_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN` | mitigate | Runtime-only env; never `NEXT_PUBLIC_`-prefixed; server-side imports only; `.env.local` in `.gitignore`; pre-commit UUID hook from Plan 01 catches accidental paste |
| T-1-02 | Information Disclosure | `TRIGGER_SECRET_KEY` vs `TRIGGER_ACCESS_TOKEN` mixup | mitigate | Plan 01 `.env.example` has both documented separately with clear purpose comments; Plan 05 puts ACCESS_TOKEN only in GitHub Actions secrets; SECRET_KEY never leaves runtime vault |
| T-1-05 | Denial of Service | Unbounded Redis calls in `/api/health` (Plan 04) | accept (low) | `redis.ping()` is constant-time and rate-limited by Upstash; no user input flows into this call in Phase 1 |
| T-1-12 | Elevation of Privilege | Trigger.dev task running with full DATABASE_URL | accept | Tasks only read/write tables they own; enforced by code review (Phase 2). Phase 1 `health-probe` has no DB access |
</threat_model>

<verification>
```bash
pnpm typecheck
pnpm lint
pnpm build
# Live checks (require user env vars):
node --experimental-vm-modules -e "require('dotenv').config({path:'.env.local'}); const {Redis}=require('@upstash/redis'); const r=new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN}); r.ping().then(x=>{console.log(x);process.exit(x==='PONG'?0:1)})"
# Trigger.dev: manual run via dashboard (Task 2 checkpoint)
```

ROADMAP Phase 1 Success Criterion #3 (Trigger.dev manual trigger) is acceptance-tested in Task 2. Success Criterion #5 (Upstash ping) preview-tested in Task 3; production-tested via Plan 04's `/api/health`.
</verification>

<success_criteria>
- Trigger.dev v4 SDK (^4) installed; v3 import paths banned
- `trigger.config.ts` + `src/trigger/health-probe.ts` + `src/trigger/index.ts` all exist with correct imports
- `health-probe` task deployed to Trigger.dev Cloud and executed successfully from the dashboard (manual checkpoint)
- Upstash Redis client singleton in `src/lib/redis/client.ts` with live `ping() === 'PONG'` proven
- Plan 04 can now import `{ redis }` and `{ healthProbe }` type-only for `/api/health`
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-03-SUMMARY.md` with:
- Installed versions: @trigger.dev/sdk, @trigger.dev/build, @upstash/redis
- TRIGGER_PROJECT_REF value used (safe to commit — not a secret)
- Link to the Trigger.dev manual run (dashboard URL — proof of Success Criterion #3)
- Confirmation Upstash ping returned PONG
- Any env-variable surprises (e.g., if `TRIGGER_PROJECT_REF` had to be inlined instead of env-sourced)
</output>
</content>
</invoke>