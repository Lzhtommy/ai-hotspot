## Deferred: pre-existing voyage rate-limit test failures

Discovered during: Plan 06-06 Task 2 verification (pnpm test --run)

**Failures (3):**
- src/lib/llm/client.test.ts > voyage.embed — spaces sequential calls by ~VOYAGE_INTERVAL_MS (3 RPM → 20s)
- src/lib/llm/client.test.ts > voyage.embed — 429 triggers a retry that honors Retry-After
- src/lib/llm/client.test.ts > voyage.embed — exhausted 429 retries throw VoyageRateLimitError

**Status:** Pre-existing on branch gsd/phase-06-admin-operational-hardening before Plan 06-06 edits. Confirmed via `git stash && pnpm test --run` (same 3 failures without any 06-06 changes).

**Scope boundary:** Out of scope for Plan 06-06 (OPS-01 Sentry integration). Deferred to future quick task or Phase 6 closure pass. Related files are all in src/lib/llm/ (Phase 3 LLM pipeline), not the files modified by this plan.
