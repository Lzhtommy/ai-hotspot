---
phase: 06-admin-operational-hardening
plan: "07"
subsystem: ops/seo+analytics
tags: [ops, seo, sitemap, robots, analytics, vercel]
requires:
  - src/lib/db/client.ts
  - src/lib/db/schema.ts (items table)
provides:
  - public /sitemap.xml metadata route (OPS-04)
  - public /robots.txt metadata route (OPS-04)
  - getPublishedItemUrls() published-item URL reader (Wave 1 schema-independent)
  - first-party Vercel Analytics beacon wired into root layout (OPS-05)
affects:
  - src/app/layout.tsx (body tree: +<Analytics />)
tech-stack:
  added:
    - "@vercel/analytics@2.0.1"
  patterns:
    - "Next.js 15 metadata routes (sitemap.ts, robots.ts) returning MetadataRoute.Sitemap / MetadataRoute.Robots"
    - "ISR revalidate=3600 on sitemap (matches hourly ingestion cadence)"
    - "Injected-deps pattern for Drizzle repos (getPublishedItemUrls(opts, { db }))"
key-files:
  created:
    - src/lib/feed/sitemap-repo.ts
    - src/app/sitemap.ts
    - src/app/robots.ts
    - tests/unit/sitemap-repo.test.ts
    - tests/e2e/sitemap-and-analytics.spec.ts
  modified:
    - src/app/layout.tsx (import + render <Analytics />)
    - package.json, pnpm-lock.yaml (@vercel/analytics)
decisions:
  - "WARNING-8 honoured — sitemap-repo does NOT join sources.deleted_at; Plan 06-07 Wave 1 (depends_on: []) stays mergeable before Plan 06-01's 0005 migration lands. Ingestion poller (Plan 06-02) enforces deleted_at skip on NEW items; historical published items remain valid for SEO."
  - "Live E2E run deferred to phase-close UAT per Plan 05-10 / 06-06 precedent — dev server required; code-complete on branch is the merge gate."
metrics:
  duration: 4min
  completed: 2026-04-24
  tasks: 2
  files: 5
---

# Phase 06 Plan 07: Public Sitemap + Robots + Vercel Analytics Summary

One-liner: Publish a 5k-cap `/sitemap.xml` + `/robots.txt` for SEO crawlers and wire first-party Vercel Analytics (cookie-less, GFW-safe) into the root layout, replacing Google Analytics per D-17.

## What Shipped

- **`src/lib/feed/sitemap-repo.ts`** — `getPublishedItemUrls({ limit = 5000 })` queries `items` filtered by `status='published'`, ordered by `publishedAt DESC`. Returns `{ id: string, publishedAt: Date, processedAt: Date | null }[]`. No join on `sources.deleted_at` (WARNING-8).
- **`src/app/sitemap.ts`** — Next.js 15 metadata route. Emits two static entries (`/`, `/all`) + one `<url>` per published item with `lastmod = processedAt ?? publishedAt`, `changeFrequency='weekly'`, `priority=0.7`. Static entries ride `priority=1.0` / `0.8`. `revalidate = 3600` caches the XML payload at the CDN for one hour (T-6-72 mitigation).
- **`src/app/robots.ts`** — Next.js 15 metadata route. `userAgent: '*'`, `allow: ['/', '/all', '/items/']`, `disallow: ['/admin', '/api', '/favorites', '/admin/access-denied']`. Points crawlers at `<siteUrl>/sitemap.xml`.
- **`src/app/layout.tsx`** — imports `Analytics` from `@vercel/analytics/next`, renders it inside `<body>` after `<NuqsAdapter>`. First-party to Vercel's edge network — no cookie banner required (T-6-75), no Google beacon leaked (T-6-73).
- **`tests/unit/sitemap-repo.test.ts`** — 6 cases covering id stringification, default `limit=5000`, explicit limit override, WHERE/ORDER BY presence, and a no-join guard (chainable mock throws on `leftJoin`/`innerJoin` so Wave 1 schema independence is enforced at test-level).
- **`tests/e2e/sitemap-and-analytics.spec.ts`** — 4 specs: (1) `/sitemap.xml` is valid `<urlset>` XML and no `<loc>` payload contains `/admin|/api/|/favorites`; (2) `/robots.txt` references sitemap + disallows `/admin|/api|/favorites`; (3) home page emits zero `googletagmanager|google-analytics|gtag` requests; (4) mount smoke — no `analytics`-tagged `pageerror` fires.

## Commits

| Commit | Type | Message |
|--------|------|---------|
| bcb4cf3 | test | test(06-07): add failing tests for sitemap-repo getPublishedItemUrls |
| 228c421 | feat | feat(06-07): add sitemap-repo + sitemap.ts + robots.ts (OPS-04) |
| 8e43988 | feat | feat(06-07): add @vercel/analytics and wire into root layout (OPS-05) |

## TDD Gate Compliance

Task 1 followed RED → GREEN:
- **RED (bcb4cf3):** Module `@/lib/feed/sitemap-repo` did not exist; vitest resolver surfaced the failure (`Failed to resolve import`). No implementation code present.
- **GREEN (228c421):** Implementation added; all 6 unit cases pass. No `refactor` commit — minimal implementation matched test contract on first pass.

Task 2 is not TDD-gated (E2E-only spec for network-level assertions that cannot run without a live dev server); the spec lives in the plan as a merged artifact for phase-close UAT.

## Decisions Made

- **WARNING-8 honoured.** `sitemap-repo.ts` does NOT import `sources` or filter on `deleted_at`. Plan 06-07 declares `depends_on: []` and is allowed to merge before Plan 06-01's `0005_admin_ops.sql` lands. The ingestion poller (Plan 06-02) stops producing new items from soft-deleted sources; historical `published` items from a since-deleted source remain valid SEO targets. Documented inline in the repo as a comment block so a future reader does not "helpfully" add the join back.
- **BigInt() constructor instead of `3n` literal.** `tsconfig.json` targets ES2017 which bans the `3n` literal form. `BigInt(3)` matches the real Drizzle row shape (bigserial) and compiles under ES2017.
- **E2E deferred to UAT.** Playwright requires a live dev server; per Plan 05-10 and 06-06 precedent, live-server smoke tests are decoupled from code-complete and batched into the phase-close UAT. Build + unit tests + typecheck are the merge gate.
- **No SpeedInsights in v1.** Plan suggested `<SpeedInsights />` as optional; skipped to keep bundle lean — single `<Analytics />` component is sufficient for page-view tracking required by OPS-05. Can be added later via a single line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `3n` BigInt literals failed `tsc --noEmit` under ES2017 target**
- **Found during:** Task 1, after writing the RED test.
- **Issue:** `tests/unit/sitemap-repo.test.ts(67,9): error TS2737: BigInt literals are not available when targeting lower than ES2020.` — I used the shorthand `3n`/`2n`/`1n` but tsconfig targets ES2017.
- **Fix:** Replaced `3n`/`2n`/`1n` with `BigInt(3)`/`BigInt(2)`/`BigInt(1)` constructor calls. Added inline comment explaining the ES2017 constraint.
- **Files modified:** tests/unit/sitemap-repo.test.ts
- **Commit:** Folded into 228c421 (the GREEN commit)

No out-of-scope deviations. No Rule 4 checkpoints.

## Verification Results

- `pnpm test --run tests/unit/sitemap-repo.test.ts` → **6 passed / 0 failed**
- `pnpm exec tsc --noEmit` → **exit 0**
- `pnpm run build` → **succeeds**; route table shows `/sitemap.xml` static with 1h revalidate and `/robots.txt` static. No new pages broke existing routes.
- `grep -q "eq(items.status, 'published')" src/lib/feed/sitemap-repo.ts` → **ok**
- `grep -q "sources.deletedAt" src/lib/feed/sitemap-repo.ts` → **absent (WARNING-8 ok)**
- `grep -q "@vercel/analytics" package.json` → **ok** (`@vercel/analytics@2.0.1`)
- `grep -q "<Analytics />" src/app/layout.tsx` → **ok**
- `grep -q "/sitemap.xml" src/app/robots.ts` → **ok**

**Deferred to phase-close UAT:**
- Live E2E run of `tests/e2e/sitemap-and-analytics.spec.ts` (requires `pnpm dev`).
- Manual curl of `/sitemap.xml` and `/robots.txt` against a deployed URL.

## Threat Model Coverage

| Threat ID | Disposition | Mitigated By |
|-----------|-------------|--------------|
| T-6-70 (info disclosure — sitemap exposes unpublished URLs) | mitigate | `getPublishedItemUrls` filters `status='published'`; unit test proves filter. |
| T-6-71 (info disclosure — sitemap exposes /admin URLs) | mitigate | Sitemap emits only `/`, `/all`, `/items/<id>` — no admin URL is ever generated. `robots.txt` Disallow: /admin adds defence-in-depth. |
| T-6-72 (DoS — crawler floods sitemap endpoint) | mitigate | `revalidate=3600` caches at CDN; at most one DB query per hour under any crawler load. |
| T-6-73 (data exfiltration — analytics third-party leak) | mitigate | `<Analytics />` is first-party to Vercel's edge; E2E spec asserts zero `googletagmanager|google-analytics|gtag` requests. |
| T-6-74 (tampering — sitemap URL spoof via siteUrl env) | accept | `siteUrl` derives from `NEXT_PUBLIC_SITE_URL`; misconfig lists wrong URLs but enables no attack. |
| T-6-75 (privacy — cookie banner compliance) | accept | Vercel Analytics ships cookie-less by default; no GDPR banner needed. |

No new threat surface introduced beyond what the plan's `<threat_model>` anticipated.

## Known Stubs

None. The sitemap will be empty in environments with no published items (e.g., a fresh DB), but that is expected behaviour, not a stub. Static entries (`/`, `/all`) always render.

## Self-Check: PASSED

- FOUND: src/lib/feed/sitemap-repo.ts
- FOUND: src/app/sitemap.ts
- FOUND: src/app/robots.ts
- FOUND: tests/unit/sitemap-repo.test.ts
- FOUND: tests/e2e/sitemap-and-analytics.spec.ts
- FOUND: commit bcb4cf3 (RED)
- FOUND: commit 228c421 (GREEN — Task 1)
- FOUND: commit 8e43988 (Task 2)
- `@vercel/analytics@2.0.1` present in package.json dependencies.
- `<Analytics />` present in src/app/layout.tsx.
