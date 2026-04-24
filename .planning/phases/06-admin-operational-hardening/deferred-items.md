## Deferred: pre-existing voyage rate-limit test failures

Discovered during: Plan 06-06 Task 2 verification (pnpm test --run)

**Failures (3):**
- src/lib/llm/client.test.ts > voyage.embed — spaces sequential calls by ~VOYAGE_INTERVAL_MS (3 RPM → 20s)
- src/lib/llm/client.test.ts > voyage.embed — 429 triggers a retry that honors Retry-After
- src/lib/llm/client.test.ts > voyage.embed — exhausted 429 retries throw VoyageRateLimitError

**Status:** Pre-existing on branch gsd/phase-06-admin-operational-hardening before Plan 06-06 edits. Confirmed via `git stash && pnpm test --run` (same 3 failures without any 06-06 changes).

**Scope boundary:** Out of scope for Plan 06-06 (OPS-01 Sentry integration). Deferred to future quick task or Phase 6 closure pass. Related files are all in src/lib/llm/ (Phase 3 LLM pipeline), not the files modified by this plan.

**Re-confirmed during Plan 06-02:** 5 test files fail on full `pnpm test --run` — all transitive imports of `@/lib/llm/client.ts`:
- src/trigger/process-pending.test.ts
- src/lib/llm/enrich.test.ts
- src/lib/llm/process-item-core.test.ts
- src/lib/llm/embed.test.ts
- src/lib/llm/client.test.ts (the 3 voyage cases above)

Root cause: `@/lib/llm/client.ts` instantiates `new Anthropic(...)` at module scope; in a `jsdom` test environment the SDK's browser-safety guard trips because `window` is defined. Fix is either `dangerouslyAllowBrowser: true`, lazy-init inside a getter, or a per-file environment pragma. Out of scope for Plan 06-02 (admin sources). Plan 06-02's new tests (18) all pass.

---

## Deferred: Plan 06-06 live Sentry verification (Task 3)

Discovered during: Plan 06-06 Task 3 checkpoint (live Sentry dashboard verification)

**Status:** Code for OPS-01 is complete on commits `e713c7e` + `36372d1`. Live end-to-end verification (deliberate error from Next.js admin route + Trigger.dev worker reach the Sentry dashboard with PII scrubbed) is DEFERRED pending user provisioning of `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel + Trigger.dev + (for local) `.env.local`.

**Tracking:** `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` (status `partial`, 2 pending tests).

**Scope boundary:** Not a blocker for Plan 06-06 metadata close (code-complete) or for Phase 6 execution continuation (Wave 2+ plans do not depend on Sentry being live). Must be resolved before Phase 6 production sign-off / `VERIFICATION.md` green status.
