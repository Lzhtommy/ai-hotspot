---
phase: 1
slug: infrastructure-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true   # Wave 1 of Phase 1 execution IS Wave 0 for the project; covered by Plans 01-02, 01-04, 01-05
created: 2026-04-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none in v1 — Phase 1 lands types + `drizzle-kit check` + CI pipeline; unit test framework arrives in a later phase |
| **Config file** | `tsconfig.json`, `.github/workflows/ci.yml`, `drizzle.config.ts` |
| **Quick run command** | `pnpm typecheck` |
| **Full suite command** | `pnpm typecheck && pnpm lint && pnpm build && pnpm drizzle-kit check` |
| **Estimated runtime** | ~60 seconds locally; ~3 min in CI |

---

## Sampling Rate

- **After every task commit:** Run `pnpm typecheck` (or `pnpm lint` if task is config/eslint).
- **After every plan wave:** Run `pnpm typecheck && pnpm lint && pnpm build`.
- **Schema-modifying tasks:** Run `pnpm drizzle-kit check` to verify migration graph integrity before commit.
- **Before `/gsd-verify-work`:** Full suite green + `/api/health` returns 200 against a live preview URL.
- **Max feedback latency:** 90 seconds (typecheck + lint locally).

---

## Per-Task Verification Map

Filled by planner during PLAN.md authoring. One row per task; `Automated Command` must be grep-verifiable, type-verifiable, build-verifiable, or a curl against `/api/health`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | INFRA-01 | T-1-01 | Next.js 15 scaffold; no secrets committed | type+build | `pnpm typecheck && pnpm lint && pnpm build && grep -q '"next": "\^15' package.json` | ⬜ package.json, pnpm-lock.yaml, tsconfig.json, .nvmrc, src/app/layout.tsx | ⬜ |
| 01-01-T2 | 01 | 1 | INFRA-01 | T-1-01, T-1-01b | Pre-commit UUID grep blocks secrets | grep+integration | `test -x .husky/pre-commit && grep -q '\[0-9a-fA-F\]{8}' .husky/pre-commit && grep -q 'lint-staged' package.json` | ⬜ .husky/pre-commit, .prettierrc | ⬜ |
| 01-01-T3 | 01 | 1 | INFRA-07 | T-1-01 | .env.example has all 20 var names, no values | grep | `grep -c '^[A-Z_]*=$' .env.example \| awk '$1 >= 18'` | ⬜ .env.example | ⬜ |
| 01-02-T1 | 02 | 2 | INFRA-03 | T-1-03 | Drizzle type-safe query builder; all 11 tables defined | type+grep | `grep -q "vector('embedding', { dimensions: 1024 })" src/lib/db/schema.ts && pnpm typecheck` | ⬜ drizzle.config.ts, src/lib/db/schema.ts, src/lib/db/client.ts | ⬜ |
| 01-02-T2 | 02 | 2 | INFRA-02, INFRA-03 | T-1-04 | 0000 pgvector before 0001 schema; drift check passes | drizzle-kit check | `pnpm db:check && grep -c "CREATE TABLE" drizzle/0001_initial_schema.sql \| awk '$1 == 11'` | ⬜ drizzle/0000_enable_pgvector.sql, drizzle/0001_initial_schema.sql | ⬜ |
| 01-02-T3 | 02 | 2 | INFRA-02, INFRA-03 | T-1-04 | Migrations applied to live Neon dev branch; 11 tables + pgvector exist | integration | inline node script querying pg_extension + pg_tables (see PLAN.md Task 3 verify) | N/A (live DB state) | ⬜ |
| 01-03-T1 | 03 | 2 | INFRA-05 | T-1-02 | Trigger.dev v4 SDK; no v3 imports; SECRET_KEY/ACCESS_TOKEN separated | type+grep | `grep -q "from '@trigger.dev/sdk/build'" trigger.config.ts && ! grep -q "@trigger.dev/sdk/v3" trigger.config.ts src/trigger/*.ts && pnpm typecheck` | ⬜ trigger.config.ts, src/trigger/health-probe.ts, src/trigger/index.ts | ⬜ |
| 01-03-T2 | 03 | 2 | INFRA-05 | T-1-12 | Manual dashboard trigger returns `{ ok: true }` (ROADMAP SC #3) | manual | Trigger.dev Cloud dashboard run URL pasted into SUMMARY | N/A (dashboard) | ⬜ |
| 01-03-T3 | 03 | 2 | INFRA-04 | T-1-05 | Upstash Redis ping returns PONG via HTTP client | integration | `node -e "..."` dotenv + redis.ping() script in PLAN.md Task 3 verify | ⬜ src/lib/redis/client.ts | ⬜ |
| 01-04-T1 | 04 | 3 | INFRA-06 | T-1-02 | fetchRSSHub wrapper; no key in logs; 60s timeout | grep+type | `grep -q "AbortSignal.timeout(60_000)" src/lib/rsshub.ts && ! grep -E "console\.(log\|error).*key" src/lib/rsshub.ts && pnpm typecheck` | ⬜ src/lib/rsshub.ts | ⬜ |
| 01-04-T2 | 04 | 3 | INFRA-06, INFRA-07 | T-1-03, T-1-05, T-1-01 | /api/health Node runtime; Promise.allSettled; sanitized errors | grep+build | `grep -q "runtime = 'nodejs'" src/app/api/health/route.ts && grep -q "Promise.allSettled" src/app/api/health/route.ts && grep -q "status: allOk ? 200 : 503" src/app/api/health/route.ts && pnpm build` | ⬜ src/app/api/health/route.ts | ⬜ |
| 01-04-T3 | 04 | 3 | INFRA-02, INFRA-04, INFRA-06 | T-1-05 | Local curl returns 200 with all services "ok" | curl+integration | `curl -sS -f -m 90 http://localhost:3000/api/health \| grep -q '"ok":true'` (full script in PLAN.md Task 3 verify) | N/A (runtime) | ⬜ |
| 01-05-T1 | 05 | 3 | INFRA-07, INFRA-08 | T-1-06, T-1-04 | CI runs typecheck + lint + build + db:check + Neon branch + migrate | workflow-exists | `grep -q "neondatabase/create-branch-action@v6" .github/workflows/ci.yml && grep -q "pnpm db:migrate" .github/workflows/ci.yml && grep -q "pnpm db:check" .github/workflows/ci.yml` | ⬜ .github/workflows/ci.yml | ⬜ |
| 01-05-T2 | 05 | 3 | INFRA-08 | T-1-06 | Branch cleanup on PR close; idempotent | grep | `grep -q "neondatabase/delete-branch-action@v3" .github/workflows/cleanup-neon-branch.yml && grep -q "types: \[closed\]" .github/workflows/cleanup-neon-branch.yml` | ⬜ .github/workflows/cleanup-neon-branch.yml | ⬜ |
| 01-05-T3 | 05 | 3 | INFRA-07, INFRA-08 | — | vercel.json valid JSON; pnpm + Next.js hints | json-parse | `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && grep -q '"framework": "nextjs"' vercel.json` | ⬜ vercel.json | ⬜ |
| 01-05-T4 | 05 | 3 | INFRA-08 + ROADMAP SC #1 | T-1-06 | PR CI green; preview /api/health returns 200; Neon branch lifecycle | manual | GitHub Actions run URL + preview curl output pasted into SUMMARY | N/A (remote) | ⬜ |
| 01-06-T1 | 06 | 3 | INFRA-06, INFRA-07 | T-1-01, T-1-08 | README + docs/rsshub.md + docs/health.md; no real secrets | grep | `grep -q "pnpm install" README.md && grep -q "lurnings-rsshub.hf.space" docs/rsshub.md && grep -q "/api/health" docs/health.md && ! grep -E "tr_(dev\|prod)_[A-Za-z0-9]{20,}" docs/ README.md` | ⬜ README.md, docs/rsshub.md, docs/health.md | ⬜ |
| 01-06-T2 | 06 | 3 | INFRA-07, INFRA-08 | T-1-01 | docs/ci.md + docs/vercel.md + docs/database.md; env var names match .env.example | grep | `grep -q "NEON_API_KEY" docs/ci.md && grep -q "TRIGGER_SECRET_KEY" docs/vercel.md && grep -q "drizzle-kit migrate" docs/database.md` | ⬜ docs/ci.md, docs/vercel.md, docs/database.md | ⬜ |

---

## Wave 0 Requirements

Phase 1 IS the Wave 0 for the entire project — there is no prior test infrastructure to extend. The bootstrap items below all live in Wave 1 of the phase's execution plan:

- [ ] `package.json` with `typecheck`, `lint`, `build`, `drizzle-kit` scripts — enables `pnpm typecheck` et al.
- [ ] `tsconfig.json` with `strict: true` — makes typecheck meaningful.
- [ ] `.github/workflows/ci.yml` — CI pipeline that runs the full suite on every PR.
- [ ] `drizzle.config.ts` + initial migration — `drizzle-kit check` only works once a baseline migration exists.
- [ ] `/api/health` route — last-mile acceptance signal; curled by verifier against preview URL.

*Unit-test framework (vitest/jest) is intentionally deferred to a later phase — Phase 1's acceptance is type-level + integration-level via health check, not unit-level.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel GitHub app deploys preview | INFRA-07 | Requires Vercel dashboard linkage, not scriptable from CI | Open PR → confirm Vercel comment with preview URL appears within 3 min |
| Trigger.dev dashboard manual task trigger | INFRA-05 (Success Criterion #3) | Dashboard action, not CI-runnable | Log into Trigger.dev Cloud → Project → Test task → click Run → confirm non-timeout completion |
| Neon branch auto-deletes on PR close | INFRA-02 | Observability is via Neon dashboard, async | Close a preview PR → wait 5 min → confirm branch list in Neon no longer shows the PR branch |
| HF Space ACCESS_KEY rotation | D-02 | Exposed key must be rotated out-of-band | User rotates in HF Space UI → re-sets in Vercel + Trigger.dev env vaults → redeploys → `/api/health` still green |
| RSSHub hardened defaults set on HF Space | D-04 | HF Space env panel, not CI-controlled | Confirm `ALLOW_USER_HOTLINK=false`, `DISALLOW_ROBOT=true`, `REQUEST_RETRY=2`, `CACHE_EXPIRE=900`, `CACHE_CONTENT_EXPIRE=3600` in HF Space settings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (typecheck / lint / build / drizzle-kit check / grep / curl health) OR appear in Manual-Only Verifications with rationale
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (tsconfig, scripts, CI yml, drizzle.config, health route)
- [ ] No watch-mode flags (`--watch`, `-w`) in any plan command
- [ ] Feedback latency < 90s locally, < 3min CI
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the Per-Task Verification Map

**Approval:** approved (planner filled per-task verification map 2026-04-17; nyquist_compliant set true)
