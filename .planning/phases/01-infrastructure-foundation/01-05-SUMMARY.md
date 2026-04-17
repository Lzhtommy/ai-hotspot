---
phase: 01-infrastructure-foundation
plan: 05
subsystem: ci-cd
tags: [ci, github-actions, vercel, neon-branching, migrations, pnpm]

requires:
  - phase: 01-infrastructure-foundation
    provides: "package.json scripts (typecheck, lint, build, db:check, db:migrate, trigger:deploy) from Plans 01/02/03; drizzle/*.sql migrations from Plan 02; /api/health from Plan 04; pnpm-lock.yaml committed for --frozen-lockfile; .nvmrc pinned to Node 20"
provides:
  - ".github/workflows/ci.yml — PR + main pipeline: install, typecheck, lint, build, db:check, Neon branch create, drizzle-kit migrate; separate trigger-deploy job on main merges"
  - ".github/workflows/cleanup-neon-branch.yml — pull_request:closed deletes per-PR Neon branch via neondatabase/delete-branch-action@v3"
  - "vercel.json — framework: nextjs, pnpm install --frozen-lockfile + pnpm build; no embedded migrate (Actions owns that per D-18)"
affects: [phase-verification, 02-ingestion, 05-auth, 06-ops-hardening]

tech-stack:
  added:
    - "GitHub Actions: actions/checkout@v4, pnpm/action-setup@v4 (v10.32.1), actions/setup-node@v4"
    - "GitHub Actions: neondatabase/create-branch-action@v6, neondatabase/delete-branch-action@v3"
  patterns:
    - "Branch-per-PR database isolation (D-11): ephemeral Neon branch named pr-${{ github.event.number }} created on PR open, migrated, deleted on close. Matches Neon's native pattern; zero cost at free tier; malicious PR migrations never reach main."
    - "Actions owns migrations, Vercel owns builds (D-18): vercel.json deliberately does NOT embed db:migrate in buildCommand. Preserves single-owner responsibility and avoids requiring NEON_API_KEY in Vercel build env. Preview race (Pitfall 1) is a documented deferred hardening item."
    - "Dual default branch support (main + master): current repo is on master, but planning assumes main; workflow predicates match both so the pipeline survives a rename without YAML edits."
    - "Schema drift gate before migrate: pnpm db:check runs BEFORE pnpm db:migrate. Fails loudly if someone committed db:push output without matching SQL migrations. drizzle-kit push never runs in CI (anti-pattern per RESEARCH.md)."
    - "Deploy-only Trigger.dev access: TRIGGER_ACCESS_TOKEN only appears in the trigger-deploy job; runtime TRIGGER_SECRET_KEY is Vercel's concern and never enters Actions (T-1-06 mitigation)."
    - "concurrency: cancel-in-progress per github.ref + timeout-minutes per job: caps runaway costs and prevents overlapping migrations against the same PR branch."

key-files:
  created:
    - ".github/workflows/ci.yml — 104 lines, 2 jobs (ci, trigger-deploy), Neon branch per PR"
    - ".github/workflows/cleanup-neon-branch.yml — 21 lines, PR-close cleanup via delete-branch-action@v3"
    - "vercel.json — 11 lines, framework hints + pnpm commands"
    - ".planning/phases/01-infrastructure-foundation/01-05-SUMMARY.md — this file"
  modified: []

key-decisions:
  - "pnpm version pinned to 10.32.1 in workflow (matches package.json packageManager field), overriding the plan's reference to v9. Keeps lockfile format + install behavior identical between CI and local dev."
  - "Added DATABASE_URL_BUILD secret with a throwaway local fallback to the build step. next build introspects Drizzle config; without any DATABASE_URL at build time, drizzle-kit loaders can explode. This value is never used for queries — only to satisfy the config loader. DATABASE_URL_MAIN (for real migrations) stays a separate secret."
  - "Both main and master branch names match the push predicate. Repo currently uses master; downstream rename to main requires zero workflow edits."
  - "Left buildCommand = 'pnpm build' (no embedded db:migrate) per D-18. Documented the Pitfall 1 escape hatch (add 'pnpm db:migrate && pnpm build') as deferred hardening, to be adopted only if preview deploys start racing Actions migrations in Phase 2+."
  - "Task 4 (live PR + Vercel preview + /api/health 200) is DEFERRED to phase-level HUMAN-UAT, not blocking this plan. Per the execute-phase prompt's user_setup_status: the user has not yet linked GitHub remote, pushed the branch, added Actions secrets, or installed the Vercel GitHub App. The plan's job is to produce the correct YAML/JSON artifacts; the live verification happens during /gsd-verify-work after the user completes dashboard setup. This matches ROADMAP Phase 1 Success Criterion #1 scheduling."

patterns-established:
  - "CI file layout: main pipeline in ci.yml; per-trigger auxiliary workflows (cleanup) split into their own YAML. Avoids one 300-line multi-trigger file."
  - "Secret naming: SCREAMING_SNAKE, service-prefixed (NEON_*, TRIGGER_*, DATABASE_URL_*). Variable vs secret split follows 'secret = credential with auth power, variable = identifier'."

requirements-completed: [INFRA-07, INFRA-08]

duration: 3min
completed: 2026-04-17
---

# Phase 1 Plan 05: CI Pipeline Summary

**GitHub Actions CI with Neon branch-per-PR + drizzle migrate + trigger.dev deploy, plus Vercel pnpm/Next.js hints — Phase 1's automation layer is wired and validated locally, live PR verification deferred to phase-level UAT.**

## Performance

- **Duration:** ~3 min (autonomous; artifact-only tasks 1–3)
- **Started:** 2026-04-17T08:11:31Z
- **Completed:** 2026-04-17T08:14:00Z
- **Tasks:** 3 complete (Task 4 deferred per user_setup_status)
- **Files created:** 3 (.github/workflows/ci.yml, .github/workflows/cleanup-neon-branch.yml, vercel.json)
- **Files modified:** 0

## Accomplishments

- `.github/workflows/ci.yml` landed with two jobs: `ci` (every PR + main push) runs install → typecheck → lint → build → db:check → (PR-only) Neon branch create → (PR-only) db:migrate against PR branch → (main-only) db:migrate against DATABASE_URL_MAIN. `trigger-deploy` (main-only, needs: ci) runs `pnpm trigger:deploy --env prod` with TRIGGER_ACCESS_TOKEN.
- `.github/workflows/cleanup-neon-branch.yml` handles the PR-close lifecycle in isolation (pull_request:types:[closed] → neondatabase/delete-branch-action@v3). Idempotent if the branch is already gone.
- `vercel.json` declares `framework: nextjs`, `installCommand: pnpm install --frozen-lockfile`, `buildCommand: pnpm build`, `autoJobCancelation: true`. No db:migrate baked into build (D-18).
- Both workflow files validated green by `@action-validator/cli` (exit 0 each). Schema + YAML both parseable; no action ref typos.
- Local `pnpm typecheck && pnpm lint && pnpm build` all exit 0 (no regressions from the new repo-level files).
- `concurrency: cancel-in-progress` on ci.yml + `timeout-minutes` on every job cap runaway costs per T-1-07 (DoS mitigation).

## Task Commits

Each task was committed atomically:

1. **Task 1: CI workflow (install/typecheck/lint/build/migrate + trigger-deploy)** — `8d9d462` (feat)
2. **Task 2: Cleanup Neon PR branch workflow** — `ec7cb44` (feat)
3. **Task 3: vercel.json framework + pnpm hints** — `fb72cc4` (feat)
4. **Task 4: Live PR/preview verification** — **DEFERRED to phase-level HUMAN-UAT** (see User Setup Required below; no commit)

**Plan metadata:** to be added on final docs commit alongside this SUMMARY.

## Files Created/Modified

**Created**

- `.github/workflows/ci.yml` — 104 lines. Two jobs. Uses `neondatabase/create-branch-action@v6` with `project_id: vars.NEON_PROJECT_ID`, `branch_name: pr-${{ github.event.number }}`, `parent: main`, `api_key: secrets.NEON_API_KEY`, `username: vars.NEON_DB_USERNAME || 'neondb_owner'`. Migration step reads `DATABASE_URL` from `steps.neon-branch.outputs.db_url`.
- `.github/workflows/cleanup-neon-branch.yml` — 21 lines. Single job, `neondatabase/delete-branch-action@v3`, same NEON_PROJECT_ID + NEON_API_KEY inputs.
- `vercel.json` — 11 lines. `$schema` + framework/install/build/dev commands + github app options (silent: false, autoJobCancelation: true).

**Modified**

- None.

## Decisions Made

- **pnpm 10.32.1 pin.** Plan specified `version: 9` in `pnpm/action-setup@v4`. `package.json` → `packageManager: pnpm@10.32.1` (from Plan 01). If the workflow pinned to v9, `pnpm install --frozen-lockfile` could reject the v10 lockfile format. Used exact v10.32.1 in both jobs. No deviation flag needed — the plan's YAML was a copy-paste artifact from RESEARCH.md predating Plan 01's pin.
- **DATABASE_URL_BUILD fallback in the build step.** `next build` runs drizzle-kit introspection (transitive via drizzle.config.ts being imported somewhere in the build path). Without any `DATABASE_URL` at build time, the config loader can throw. Added an optional `DATABASE_URL_BUILD` secret with a throwaway local fallback: `postgres://build:build@localhost:5432/build`. This value is **never queried** — it only satisfies the config loader. The real per-PR URL is set on the migrate step only, keeping blast radius tight. User may leave DATABASE_URL_BUILD unset; the fallback works.
- **Both `main` and `master` match push predicates.** Current repo is on `master`. Assuming a future rename to `main`, the workflow accepts either so the switch is zero-effort.
- **`buildCommand: pnpm build` stays clean (no embedded db:migrate).** Per D-18 and the plan's explicit guidance, migrations are Actions' responsibility. Adding db:migrate to Vercel build would require NEON_API_KEY in Vercel env (security surface expansion) and could double-migrate on the PR branch if Actions runs concurrently. The Pitfall 1 escape hatch (buildCommand = `pnpm db:migrate && pnpm build`) is documented as a deferred hardening option and can be adopted in Phase 2+ if preview-deploy racing surfaces.
- **Task 4 deferred.** Per the execute-phase prompt's `<user_setup_status>` block, the user has not yet completed GitHub remote + Vercel + secrets setup. The plan's job is to produce correct artifacts now; live PR verification moves to phase-level HUMAN-UAT during `/gsd-verify-work`. This is explicitly authorized in the prompt and aligns with ROADMAP Phase 1 Success Criterion #1.

## Deviations from Plan

None from the plan's intent. Two minor artifact adjustments vs. the plan's verbatim YAML:

1. **pnpm version pinned to 10.32.1** instead of the plan's `version: 9`. Rationale: matches the `packageManager` field set in Plan 01; v9 would fail frozen-lockfile install against a v10 lockfile. Not a Rule 1/2/3 fix, not a scope change — just a live-data reconciliation against Plan 01's choice. Noted in Decisions.
2. **Added `master` alongside `main` in push predicates.** Rationale: repo is currently on master; dual-match is a zero-risk generalization. Does not change the plan's semantics.

Neither qualifies as a deviation under Rules 1–4 — they are concrete choices inside the plan's `<action>` block marked "Notes on the design" as planner discretion.

## Issues Encountered

- **None.** Both workflow files validated green with `@action-validator/cli` on first write; `vercel.json` parsed as valid JSON on first write; `pnpm typecheck && pnpm lint && pnpm build` all exit 0.

## User Setup Required

**The live PR → CI → Vercel preview → `/api/health` 200 verification (Task 4 of this plan; ROADMAP Phase 1 Success Criterion #1) is deferred to phase-level HUMAN-UAT pending the following user actions:**

### GitHub

1. **Link repo to GitHub remote and push `master` (or rename to `main` first, if preferred):**
   - If no remote yet: create the repo on GitHub, then `git remote add origin <url> && git push -u origin master`.
   - Rename to main (optional): `git branch -m master main && git push -u origin main && git push origin --delete master`.

2. **Add repository secrets** (Settings → Secrets and variables → Actions → Secrets → New repository secret):
   - `NEON_API_KEY` — Neon Console → Account → API keys → create key. Scope: branch management.
   - `TRIGGER_ACCESS_TOKEN` — Trigger.dev Dashboard → Profile → Personal Access Tokens → create deploy-only token.
   - `DATABASE_URL_MAIN` — Neon main-branch pooled connection string (from Neon Console → Connection Details → keep-alive connection). Only needed if you want CI to migrate production on merge; if you prefer manual `drizzle-kit migrate` from a terminal with the prod URL, delete the "Run Drizzle migrations on main Neon branch" step from `.github/workflows/ci.yml`.
   - `DATABASE_URL_BUILD` (optional) — any valid Postgres URL; value is never queried, only loaded by drizzle.config.ts during `next build`. Leave unset to use the workflow's local fallback.

3. **Add repository variable** (Settings → Secrets and variables → Actions → Variables → New repository variable):
   - `NEON_PROJECT_ID` — Neon Console → Project Settings → General → Project ID. **NOT a secret** (not sensitive; UUID identifier).
   - `NEON_DB_USERNAME` (optional) — defaults to `neondb_owner`. Set only if your Neon role differs.

### Vercel

1. **Install the Vercel GitHub App and import the repo** at https://vercel.com/new.
   - Framework preset: Next.js (auto-detected).
   - Root directory: repo root.
   - Build Command: auto-detected from `vercel.json` (`pnpm build`).
   - Install Command: auto-detected from `vercel.json` (`pnpm install --frozen-lockfile`).

2. **Set runtime environment variables** (Vercel Dashboard → Project → Settings → Environment Variables). Set for **both Production and Preview** environments:
   - `DATABASE_URL` — Production: Neon main-branch URL. Preview: a Neon long-lived dev branch URL (or the main URL if you accept preview writes to production; not recommended).
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — from Upstash console.
   - `TRIGGER_SECRET_KEY` — Preview: Trigger.dev dev env key. Production: Trigger.dev prod env key. (This is the **runtime** key, different from the `TRIGGER_ACCESS_TOKEN` CI uses.)
   - `RSSHUB_BASE_URL` — `https://lurnings-rsshub.hf.space`.
   - `RSSHUB_ACCESS_KEY` — **rotated** HF Space key (D-02: the prior key was exposed in planning chat; rotate before first deploy).
   - `ANTHROPIC_API_KEY` — placeholder acceptable for Phase 1; real value required by Phase 3.
   - `VOYAGE_API_KEY` — placeholder acceptable for Phase 1; real value required by Phase 3.

3. **Confirm project settings**: Framework = Next.js; Install Command = `pnpm install --frozen-lockfile`; Build Command = `pnpm build`; Node.js Version = 20.x (matches `.nvmrc`).

### Phase-level live UAT (done during `/gsd-verify-work`)

After the above, the phase verifier (human + Claude) will:

1. Push the Phase 1 branch and open a PR against `main`.
2. Observe CI workflow: install → typecheck → lint → build → db:check → create Neon branch `pr-<N>` → migrate PR branch → green. Total ~3–5 min.
3. Wait for Vercel GitHub App to post the preview URL on the PR (~2 min).
4. `curl -sS -w "\nHTTP_STATUS:%{http_code}\n" <preview-url>/api/health` — first call may 503 on HF Space cold start (D-05); retry after 60s; expected HTTP 200 with `{ ok: true, services: { neon, redis, rsshub, trigger: "ok" } }`.
5. Verify Neon Console shows `pr-<N>` branch with 11 tables + pgvector extension.
6. Close the PR without merging; within 5 min, cleanup-neon-branch workflow deletes the branch. Reopen PR to continue phase work.
7. Paste PR URL, CI run URL, preview URL, curl output, and Neon branch lifecycle evidence into the phase verification record.

That sequence IS ROADMAP Phase 1 Success Criterion #1; it is tracked as a phase-level HUMAN-UAT item, not a Plan 05 internal gate.

## Threat Flags

None new. The STRIDE register in the plan frontmatter covered every introduced surface:

- **T-1-06 (CI secret exfiltration)** — mitigated: `secrets.*` are encrypted-at-rest and auto-masked in logs; `pull_request_target` trigger NOT used (would expose secrets to fork PRs); `permissions:` restricted to `contents: read` + `pull-requests: write` + `id-token: write`.
- **T-1-04 (migration drift / malicious schema PR)** — mitigated: `pnpm db:check` runs BEFORE `pnpm db:migrate`; `drizzle-kit push` never runs in CI; per-PR Neon branch isolates any malicious migration from `main`; `main` branch migrations only fire on trusted `push` events.
- **T-1-01 (DATABASE_URL_MAIN in logs)** — mitigated: set via `env:` on the specific step only; GitHub masks `${{ secrets.* }}` automatically; no echo/print statements reference the URL.
- **T-1-07 (CI DoS / cost runaway)** — mitigated: `concurrency: cancel-in-progress`; `timeout-minutes: 15` (ci), `10` (trigger-deploy), `5` (cleanup).

No new threat surface introduced beyond the register.

## Known Stubs

None. Every workflow step references real actions, real scripts, and real secret/variable names. No TODOs, no placeholders in the committed YAML/JSON. The only "placeholder-adjacent" item is `DATABASE_URL_BUILD`'s throwaway fallback, which is a deliberate build-time config-loader appeasement, not a stub blocking functionality.

## Next Phase Readiness

- **Phase 1 verification (`/gsd-verify-work`) can proceed** once the user completes the GitHub + Vercel dashboard setup documented above. Artifacts are ready; nothing else blocks phase acceptance at the code layer.
- **Phase 2 (ingestion) inherits:** working `pnpm trigger:deploy --env prod` on main merges (INFRA-05 production path), schema drift protection on every PR, branch-per-PR isolation so Phase 2 schema churn can't corrupt main.
- **Deferred hardening options** documented above (Vercel `buildCommand` embedding migrate; promoting DATABASE_URL_BUILD from optional to required) can land in Phase 2+ if operational symptoms surface.

## Self-Check: PASSED

**Files:**

- FOUND: `.github/workflows/ci.yml`
- FOUND: `.github/workflows/cleanup-neon-branch.yml`
- FOUND: `vercel.json`

**Commits:**

- FOUND: `8d9d462` (Task 1 — ci.yml)
- FOUND: `ec7cb44` (Task 2 — cleanup-neon-branch.yml)
- FOUND: `fb72cc4` (Task 3 — vercel.json)

**Local verification:**

- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0
- `pnpm build` → exit 0 (Next 15, 5 static pages, `/api/health` dynamic)
- `@action-validator/cli ci.yml` → exit 0
- `@action-validator/cli cleanup-neon-branch.yml` → exit 0
- `node -e JSON.parse(vercel.json)` → valid

---

*Phase: 01-infrastructure-foundation*
*Completed: 2026-04-17*
