# Retrospective: AI Hotspot

Living retrospective. One section per milestone. Cross-milestone trends at the end.

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-24
**Phases:** 6 | **Plans:** 42 | **Tasks:** ~95 | **Commits:** 294 | **Timeline:** 7 days

### What Was Built

A complete Chinese-language AI news aggregator — hourly Trigger.dev polling of self-hosted RSSHub, Claude Haiku 4.5 enrichment (translation + Chinese summary + 0-100 hotness + 推荐理由 + tags) with prompt caching, Voyage 1024-dim embeddings + pgvector HNSW cluster assignment within ±24h windows, paper+amber Next.js 15 feed UI with ISR, Auth.js v5 with GitHub/Resend/Google providers, optimistic favorite+vote server actions, admin backend with 3-layer gate, Sentry + Langfuse observability, sitemap + Vercel Analytics. 178 unit tests + Playwright E2E + live verification harnesses per phase.

### What Worked

- **Live verification harnesses per phase.** `pnpm verify:ingest`, `verify:llm`, `verify:admin-ops` hit real Neon + real Anthropic + real Voyage APIs and asserted the ROADMAP success criteria programmatically. Caught real bugs that unit tests missed (neon-http transaction limitation in Phase 3 Plan 05, found during `verify:llm` live run, fixed in commit 5be492b).
- **Deps-injected pure cores + thin task/action adapters.** Pattern emerged in Phase 2 (`fetch-source-core.ts` + Trigger.dev task wrapper) and propagated to Phase 3 (`process-item-core.ts`), Phase 5 (`favorites-core.ts` + `votes-core.ts` + `auth-guard.ts`), Phase 6 (`sources-repo.ts`, `users-repo.ts`, `dead-letter-repo.ts`). Made testing mechanical — mock deps, assert Object.keys shape — and left the Trigger.dev/Server-Action adapter trivially thin.
- **Schema migrations as hand-authored SQL once Drizzle DSL fell short.** HNSW index (03-01), Auth.js UUID FK tables (05-01), self-referencing banned_by FK (06-01) all went through `scripts/apply-NNNN-*.ts` bypassing non-TTY `drizzle-kit push` + DSL limitations. This precedent is now the project pattern.
- **Explicit decision to defer live-env UAT.** Rather than block phase closure on user OAuth app creation / Vercel provisioning / Sentry DSN, verification standardized on `status: human_needed` with YAML `human_verification:` block. Phases close on code-completeness; user unblocks live UAT asynchronously. Precedent: Plan 01-05, 05-10, 06-06.
- **Paper+amber D-02 override documented in CONTEXT.md.** When design drifted from the original dark/green anchor, the decision was recorded in 04-CONTEXT.md D-02 and explicitly acknowledged as superseding REQUIREMENTS.md FEED-06 wording. Later verification accepted this via `overrides_applied: 1` in Phase 4 VERIFICATION.md — no ambiguity at milestone close.
- **Prompt caching mechanically verified.** System prompt floored at 4096 tokens to satisfy Haiku 4.5 cache minimum; `pipeline_runs.cache_read_input_tokens > 0` asserted live in `verify:llm`. No guessing whether caching is active.

### What Was Inefficient

- **Nyquist VALIDATION.md produced unevenly.** Phases 01, 03, 05 have VALIDATION.md; phases 02, 04, 06 do not. Phase 05's VALIDATION.md is `status: draft` / `nyquist_compliant: false`. The workflow has `workflow.nyquist_validation: true`, but the step wasn't uniformly enforced across phases. Test coverage itself is adequate per VERIFICATION.md, but the documentation gap meant milestone audit had to flag partial compliance.
- **Drizzle snapshot regeneration drift.** Migrations 0004_auth and 0005_admin_ops were hand-authored SQL (per above). The `drizzle/meta/` snapshots were never regenerated to match; `drizzle-kit generate` would now misdiff against 0003's schema. Caught at milestone audit, not during phase execution.
- **CR-01 fix landed post-verification; VERIFICATION.md not updated.** Phase 6 VERIFICATION.md (dated 2026-04-23) flagged CR-01 `retryAllCore` bug as blocker. Commit 56e82cf fixed it same day, but VERIFICATION.md status stayed `gaps_found`. Integration checker caught the discrepancy at milestone audit. Lesson: re-run `/gsd-verify-phase` after a code-review-driven fix.
- **REQUIREMENTS.md traceability table stale at milestone close.** 10 items marked "Pending" but VERIFICATION.md showed satisfied (FEED-10, ADMIN-02..09, OPS-03). No automated propagation from phase completion → requirements checkbox. Manually flipped at archive time; v1.0-REQUIREMENTS.md archive reflects verified reality.
- **Phase 6 code review surfaced 6 warnings (WR-01..06).** None blocked closure but all were avoidable — Sentry nested-key scrub, edit-form unchecked-checkbox bug, soft-delete UNIQUE collision, CSRF on GET sentry-test, ban audit trail, redirect `?next=` drop. Pattern: reviewer flags code-review items right before closure, some don't make the current milestone and become tech debt. Consider running `/gsd-code-review` per plan, not per phase, so findings surface earlier.
- **SUMMARY frontmatter `requirements_completed` field not populated.** Only 1 of 42 SUMMARY.md files has it. This forced milestone audit to fall back to 2-source cross-reference (VERIFICATION + REQUIREMENTS) instead of 3-source. Lesson: either drop the field or enforce it.

### Patterns Established

- **Deps-injected pure cores:** `*-core.ts` + test-time mock injection for every side-effecting module. Project-wide.
- **Hand-authored migrations via `scripts/apply-NNNN-*.ts`:** when Drizzle DSL can't express the construct (HNSW, UUID FK, self-ref FK).
- **Live verification harnesses** (`scripts/verify-*.ts`): per-phase, asserts ROADMAP success criteria programmatically.
- **Three-layer defense-in-depth for admin gates:** edge cookie filter → RSC `requireAdmin()` → Server Action `assertAdmin()`.
- **Prop-threading session from RSC layout** (not `useSession()` hooks): Phase 5 pattern carried through Phase 6.
- **Trigger.dev task `maxDuration` + inline `queue: { concurrencyLimit }`:** budgets are per-task, not global, to isolate cost/retry blast radius.

### Key Lessons

1. **Live verification harnesses catch bugs unit tests miss.** The neon-http transaction limitation was invisible to unit tests (mocked `db.transaction`) but trivially reproducible by `verify:llm` against a real driver. Budget time for this on every phase with external-service integration.
2. **Schema DSL gaps should be a precedent, not a hack.** Once HNSW needed raw SQL, standardize on `scripts/apply-NNNN-*.ts` for all such migrations — don't re-debate each time. Document the pattern in `docs/database.md`.
3. **"Deferred to human UAT" is valid closure.** Don't block phase completion on OAuth app creation or Sentry DSN provisioning. Use `status: human_needed` with structured `human_verification:` YAML so items are tracked, not lost.
4. **Run `/gsd-code-review` per plan, not per phase.** Six warnings landing right at Phase 06 close is signal that earlier review would have absorbed them into the current plan instead of carrying them forward as debt.
5. **Keep REQUIREMENTS.md traceability in sync with VERIFICATION.md.** Consider a `/gsd-sync-requirements` step at phase close that flips checkboxes matching VERIFICATION.md evidence. Manually flipping 10 checkboxes at milestone audit is a symptom, not a feature.
6. **Context-ops design (.env.example as canonical registry).** 20 env vars declared once in `.env.example` propagated to Vercel + Trigger.dev + `.env.local` + CI secrets without drift. Single source of truth paid off.

### Cost Observations

- **Model mix:** GSD execution used balanced profile (sonnet for most agents). LLM-pipeline production mix: Haiku 4.5 for 100% of enrichment calls (translation, summary, score, 推荐理由, tags). Sonnet reserved for grey-zone cluster decisions (not yet wired — deferred to v1.1 if cluster quality drops at scale).
- **Sessions:** ~7 days of active work; ≥3 milestone-level sessions + multiple per-phase execute-phase sessions. No specific token-usage figures captured.
- **Prompt caching effectiveness:** verified live — `cache_read_input_tokens > 0` on first cached call. Estimated 60% input-token reduction per prompt-caching multiplier; actual effective reduction not measured (Langfuse dashboard provides live view).

### Measured Outcomes

- **Verification score:** 74/75 requirements satisfied (98.7%); 1 partial.
- **E2E flows:** 7/7 complete (ingest → enrich → feed → login → favorite → admin-ban → dead-letter retry).
- **Integration:** 5/7 fully wired; 2 operational warnings (FEED-10 env provisioning, migration snapshots).
- **Test coverage:** 178+ unit tests, 4 E2E specs, 3 live verification harnesses.

---

## Cross-Milestone Trends

### Efficiency Trend

| Milestone | Phases | Plans | Days | Plans/Day |
|-----------|--------|-------|------|-----------|
| v1.0 | 6 | 42 | 7 | 6.0 |

### Pattern Library

- Deps-injected pure cores (v1.0)
- Hand-authored migrations via `apply-NNNN-*.ts` (v1.0)
- Live verification harnesses per phase (v1.0)
- Three-layer admin defense-in-depth (v1.0)
- RSC session prop-threading over client hooks (v1.0)

### Recurring Debt Categories

- Nyquist VALIDATION.md uneven across phases (→ enforce at phase close)
- REQUIREMENTS.md traceability staleness at milestone close (→ sync at phase close)
- Code-review warnings deferred to next milestone (→ run review per plan)
- Live-environment UAT items deferred pending user action (→ expected; tracked in STATE.md)

---

_Last updated: 2026-04-24 after v1.0 milestone_
