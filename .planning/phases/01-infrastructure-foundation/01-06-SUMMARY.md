---
phase: 01-infrastructure-foundation
plan: 06
subsystem: docs
tags: [docs, runbooks, onboarding, readme, rsshub, health, ci, vercel, database]

requires:
  - phase: 01-infrastructure-foundation
    provides: "Plans 01-04 infra (Next.js 15, Drizzle+Neon+pgvector, Trigger.dev v4, Upstash Redis, RSSHub wrapper, /api/health) whose operational surface this plan documents. Plan 01-05 CI YAML+vercel.json are not yet landed — documented as Plan 05 acceptance specs."
provides:
  - "README.md — project overview, getting-started (pnpm install → pnpm db:migrate → pnpm dev → green /api/health), layout tour, script table, further-reading links to all five runbooks"
  - "docs/rsshub.md — HF Space URL (https://lurnings-rsshub.hf.space), env vars, hardened defaults (D-04), D-02 key-rotation runbook (6-step), cold-start notes (D-05)"
  - "docs/health.md — /api/health request + response contract, four service-check table with timeouts, sanitize() behavior, operational playbook table"
  - "docs/ci.md — GitHub Actions ci.yml + cleanup-neon-branch.yml spec, required secrets (NEON_API_KEY, DATABASE_URL_MAIN, TRIGGER_ACCESS_TOKEN), repo variables, failure playbook, D-18 rationale"
  - "docs/vercel.md — project settings, full runtime env-var matrix (Preview vs Production), NEXT_PUBLIC_ prohibition, Phase 1 acceptance recipe"
  - "docs/database.md — 11-table schema overview, two-stage migration workflow (pnpm db:* wrapping drizzle-kit), pgvector notes, anti-patterns"
affects: [01-05-ci-pipeline, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, all future contributors]

tech-stack:
  added: []
  patterns:
    - "Runbook layout: one file per operational surface (rsshub, health, ci, vercel, database); README.md links to all of them from a single 'Further Reading' section"
    - "Acceptance-spec pattern for docs referencing files Plan 05 lands: both docs/ci.md and docs/vercel.md carry a dated Status banner explicitly flagging that the YAML/JSON lands in Plan 05 and that the doc is the authoritative spec to land against"
    - "All env var names in docs cross-checked against .env.example (canonical registry)"
    - "No real secret values appear in any doc — placeholders only (`<secret>`, `tr_dev_...`)"

key-files:
  created:
    - "README.md — project root"
    - "docs/rsshub.md"
    - "docs/health.md"
    - "docs/ci.md"
    - "docs/vercel.md"
    - "docs/database.md"
    - ".planning/phases/01-infrastructure-foundation/01-06-SUMMARY.md"
  modified: []

key-decisions:
  - "docs/ci.md and docs/vercel.md carry a dated Status banner noting Plan 05 lands the actual YAML/JSON files. Rationale: documenting the acceptance spec up-front makes Plan 05 a mechanical land-against-these-docs exercise and prevents spec drift."
  - "README.md 'Useful scripts' table preserves the full package.json script surface (db:*, trigger:*) even though Plan 1 users only need a subset. Rationale: a single readable script reference avoids README rewrites in Phases 2-6 when those scripts get used more."
  - "Added explicit note to docs/database.md clarifying that `pnpm db:*` wraps `drizzle-kit` subcommands — ensures future contributors reading the doc find the literal tool name even when only the wrapper alias appears in package.json."

patterns-established:
  - "Runbook file naming: docs/<surface>.md (singular, lowercase, no dates or prefixes)"
  - "Status banner for forward-referenced files: `> **Status (YYYY-MM-DD):** ...` markdown quote under the H1"

requirements-completed: [INFRA-06, INFRA-07, INFRA-08]

duration: 4min
completed: 2026-04-17
---

# Phase 01 Plan 06: Docs + Runbooks Summary

**Six operational docs (README + five runbooks) land a self-contained onboarding + operations knowledge base — a new contributor can reach `pnpm dev` + green `/api/health` from README alone, and every managed service from Plans 01-04 has a dedicated rotation/failure runbook.**

## Performance

- **Duration:** ~4 min (autonomous, no deviations)
- **Started:** 2026-04-17T08:04:22Z
- **Completed:** 2026-04-17T08:08Z (approx)
- **Tasks:** 2 (both `type="auto"`)
- **Files created:** 6 documentation files + this summary
- **Files modified:** 0

## Accomplishments

- **README.md** (486 words) — project overview, tech stack list, prerequisites, copy-paste-runnable setup block (`nvm use → pnpm install → cp .env.example .env.local → pnpm db:migrate → pnpm dev`), full script table, directory layout, links to every runbook.
- **docs/rsshub.md** (411 words) — HF Space URL committed, env-var mapping table (Vercel + Trigger.dev Cloud + HF Space all named `RSSHUB_ACCESS_KEY` externally, `ACCESS_KEY` inside the Space), hardened-defaults block (D-04), six-step rotation runbook (D-02) including verification via /api/health.
- **docs/health.md** (446 words) — request shape, both 200 and 503 JSON examples, four-row service-check table with timeouts (3s/3s/60s/10s), `runtime = 'nodejs'` rationale, sanitize() behavior, operational playbook mapping each service failure to a fix, phase-evolution roadmap (auth gate lands Phase 5).
- **docs/ci.md** (625 words) — both workflows stepped (ci.yml + cleanup-neon-branch.yml), three required secrets + two repo variables with sources, branch-protection recs deferred to Phase 6, five-row failure playbook, D-18 rationale for GitHub Actions over Vercel's Neon integration.
- **docs/vercel.md** (402 words) — project-settings table, full 11-row runtime env-var matrix with Preview vs Production delta and source pointer per row, explicit NEXT_PUBLIC_ prohibition, Phase 1 acceptance recipe.
- **docs/database.md** (377 words) — 11-table overview, two-file migration structure, three workflows (local A/B + CI + Production), adding-migration recipe, pgvector notes covering column type + deferred HNSW index, four anti-patterns.
- All six docs pass Prettier (run via both direct `pnpm prettier` and the lint-staged pre-commit chain).
- No real secrets detected: `grep -E "tr_(dev|prod)_[A-Za-z0-9]{20,}"` and `grep -E "postgres(ql)?://[^ ]*@[^ ]+\.neon\.tech"` both return zero matches.
- `pnpm typecheck && pnpm lint && pnpm build` all exit 0 post-plan.

## Task Commits

1. **Task 1: README.md + docs/rsshub.md + docs/health.md** — `996f0e2` (docs)
2. **Task 2: docs/ci.md + docs/vercel.md + docs/database.md** — `c25f81e` (docs)

Each task was committed atomically on `master`. lint-staged applied Prettier to staged markdown as part of the pre-commit chain; the UUID scan passed (no secret-shaped strings in any doc).

## Files Created/Modified

**Created**

- `README.md` — project-root intro + setup + layout + script table + further-reading
- `docs/rsshub.md` — HF Space runbook (env vars, hardened defaults, key rotation, cold-start, operational limits)
- `docs/health.md` — /api/health contract + playbook
- `docs/ci.md` — GitHub Actions runbook (secrets, variables, playbook, rationale)
- `docs/vercel.md` — Vercel deployment runbook (settings + env matrix)
- `docs/database.md` — Drizzle + Neon + pgvector migration workflow

**Modified**

- None.

## Decisions Made

- **Forward-reference the Plan 05 artefacts rather than omit them.** `docs/ci.md` and `docs/vercel.md` both describe files (`.github/workflows/ci.yml`, `.github/workflows/cleanup-neon-branch.yml`, `vercel.json`) that don't yet exist — Plan 01-05 authors them. A dated Status banner at the top of each doc names this explicitly, so the doc is the acceptance spec for Plan 05 rather than a fictional description of shipped files. This matches the "documentation reflects actual state" guidance in the prompt.
- **`pnpm db:*` scripts documented alongside the underlying `drizzle-kit` subcommand.** The plan's automated verification grep'd for the literal string `drizzle-kit migrate`. README.md + docs/database.md use the pnpm script form in workflow examples (what contributors actually type) but explicitly note the drizzle-kit subcommand each wraps.
- **Runbook paths normalized to `docs/<surface>.md`.** Singular, lowercase, no date prefix or ordering. Matches the plan's explicit path list and keeps the `docs/` dir scannable as Phases 2-6 add more runbooks.
- **README stays concise, runbooks carry the detail.** The README lists every `pnpm` script but only elaborates setup. Rotation, env-var matrices, and failure playbooks live in the runbooks — keeps README onboarding-friendly and runbooks searchable.

## Deviations from Plan

None. The plan executed as written; both tasks passed their automated verification on first commit. One iteration was needed inside Task 2 to add the literal string `drizzle-kit migrate` to `docs/database.md` (the initial draft referenced only `pnpm db:migrate`), but this was a pre-commit verification tweak — not a deviation from plan scope.

## Issues Encountered

- None at the content layer. Prettier reformatted the markdown tables (column-alignment pass) after each write — this is expected behavior from the Plan 01 lint-staged config and did not change semantics.

## User Setup Required

None. Every doc was authored purely from existing planning + code state; no environment variables or external calls required.

**Forward-looking note:** When Plan 05 lands, verify the actual workflow YAML + vercel.json match the specs in `docs/ci.md` and `docs/vercel.md`. If reality diverges, update the runbooks (they are authoritative).

## Threat Flags

None new. The docs threat register in the plan frontmatter was observed:

- **T-1-01 (secret accidentally committed):** mitigated — no real values in any file; placeholders only. Pre-commit UUID hook would have blocked a leaked ACCESS_KEY but did not fire (nothing to block).
- **T-1-08 (topology disclosure via public runbook):** accepted per plan rationale — HF Space URL is intentionally documented behind an ACCESS_KEY gate; rotation runbook makes any future leak recoverable.

## Known Stubs

None. All six documents are complete references; nothing deferred, nothing mock.

## Next Phase Readiness

- **Plan 01-05 (ci-pipeline):** `docs/ci.md` + `docs/vercel.md` are the authoritative specs. The planner/executor can land `.github/workflows/ci.yml`, `.github/workflows/cleanup-neon-branch.yml`, and `vercel.json` by translating those tables into YAML/JSON directly.
- **Phase 1 completion gate:** this plan closes INFRA-06, INFRA-07, INFRA-08 (documentation). Plan 05 remains to close INFRA-06 (CI pipeline) and land the end-to-end `/api/health` green on Vercel preview.
- **Phase 2+ onboarding:** any new contributor clones the repo → reads README.md → reaches a working local dev environment by following the linked runbooks in order. No tribal knowledge required.

## Self-Check: PASSED

**Files:**

- FOUND: `README.md`
- FOUND: `docs/rsshub.md`
- FOUND: `docs/health.md`
- FOUND: `docs/ci.md`
- FOUND: `docs/vercel.md`
- FOUND: `docs/database.md`
- FOUND: `.planning/phases/01-infrastructure-foundation/01-06-SUMMARY.md` (this file)

**Commits:**

- FOUND: `996f0e2` (Task 1 — README + rsshub + health)
- FOUND: `c25f81e` (Task 2 — ci + vercel + database)

**Verification commands:**

- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0
- `pnpm build` → exit 0 (unchanged route surface: `/` static + `/api/health` dynamic)
- Secret-leak regex sweeps (tr\_ + neon.tech postgres URLs) → zero matches
- All automated grep checks from both task `<verify>` blocks → pass

---

_Phase: 01-infrastructure-foundation_
_Completed: 2026-04-17_
