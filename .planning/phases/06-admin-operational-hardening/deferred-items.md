## Deferred: pre-existing voyage rate-limit test failures

Discovered during: Plan 06-06 Task 2 verification (pnpm test --run)

**Failures (3):**
- src/lib/llm/client.test.ts > voyage.embed — spaces sequential calls by ~VOYAGE_INTERVAL_MS (3 RPM → 20s)
- src/lib/llm/client.test.ts > voyage.embed — 429 triggers a retry that honors Retry-After
- src/lib/llm/client.test.ts > voyage.embed — exhausted 429 retries throw VoyageRateLimitError

**Status:** Pre-existing on branch gsd/phase-06-admin-operational-hardening before Plan 06-06 edits. Confirmed via `git stash && pnpm test --run` (same 3 failures without any 06-06 changes).

**Scope boundary:** Out of scope for Plan 06-06 (OPS-01 Sentry integration). Deferred to future quick task or Phase 6 closure pass. Related files are all in src/lib/llm/ (Phase 3 LLM pipeline), not the files modified by this plan.

---

## Deferred: Plan 06-06 live Sentry verification (Task 3)

Discovered during: Plan 06-06 Task 3 checkpoint (live Sentry dashboard verification)

**Status:** Code for OPS-01 is complete on commits `e713c7e` + `36372d1`. Live end-to-end verification (deliberate error from Next.js admin route + Trigger.dev worker reach the Sentry dashboard with PII scrubbed) is DEFERRED pending user provisioning of `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel + Trigger.dev + (for local) `.env.local`.

**Tracking:** `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` (status `partial`, 2 pending tests).

**Scope boundary:** Not a blocker for Plan 06-06 metadata close (code-complete) or for Phase 6 execution continuation (Wave 2+ plans do not depend on Sentry being live). Must be resolved before Phase 6 production sign-off / `VERIFICATION.md` green status.

---

## Deferred: `/sitemap.xml` prerender failure at build-time without live DATABASE_URL

Discovered during: Plan 06-04 Task 2 verification (`pnpm run build`).

**Failure:**
- `app/sitemap.xml/route.ts` runs a `SELECT id, published_at, processed_at FROM items WHERE status='published' ORDER BY published_at DESC LIMIT 5000` during `next build` (Generating static pages), which fails when no real Neon database is reachable (CI / fresh worktree).

**Status:** Pre-existing on branch at commit `f816ef7` BEFORE any 06-04 edits. Confirmed by running `pnpm run build` at `f816ef7` (baseline) — fails with the identical error, proving the regression is not caused by Plan 06-04. Plan 06-07 landed the sitemap route; it should either force `dynamic='force-dynamic'` + `runtime='nodejs'` OR gate the DB query behind an env check (return an empty sitemap when DATABASE_URL is absent at build time).

**Scope boundary:** Out of scope for Plan 06-04 (ADMIN-09 LLM cost dashboard). Plan 06-04's own route (`/admin/costs`) is `force-dynamic` with `revalidate=0` and does not prerender. TypeScript (`pnpm exec tsc --noEmit`) passes and unit tests pass — the failure is isolated to `/sitemap.xml`'s build-time prerender, which is a 06-07 concern. Deferred to a quick task or Phase 6 closure pass.
