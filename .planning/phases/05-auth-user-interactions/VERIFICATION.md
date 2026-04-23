---
phase: 05-auth-user-interactions
verified: 2026-04-23T15:30:00Z
status: human_needed
score: 5/5 success-criteria verified
overrides_applied: 0
deferred:
  - truth: "Live GitHub OAuth round-trip on a Vercel preview URL via AUTH_REDIRECT_PROXY_URL (ROADMAP SC1)"
    addressed_in: "Phase 5 UAT (manual)"
    evidence: "Deferred in 05-VALIDATION.md §Manual-Only Verifications; cannot be simulated in CI without real GitHub + Vercel DNS. Runbook at docs/auth-providers.md §6 covers smoke test."
  - truth: "Magic-link deliverability from a mainland-China-accessible mailbox (ROADMAP SC2)"
    addressed_in: "Phase 5 UAT (manual)"
    evidence: "Deferred in 05-VALIDATION.md §Manual-Only Verifications; Resend domain verification is out-of-band."
  - truth: "Session persists across real browser close/reopen (ROADMAP SC2)"
    addressed_in: "Phase 5 UAT (manual)"
    evidence: "Deferred in 05-VALIDATION.md §Manual-Only Verifications."
  - truth: "Google OAuth sign-in from a non-CN network (AUTH-04)"
    addressed_in: "Phase 5 UAT (manual)"
    evidence: "Deferred in 05-VALIDATION.md §Manual-Only Verifications."
  - truth: "Playwright E2E specs (auth-github, auth-magic-link, anon-login-favorite, ban-enforcement) executing green against a live dev server + seeded DB"
    addressed_in: "Phase 5 UAT (manual / CI wiring)"
    evidence: "Specs exist in tests/e2e/ and Vitest suite passes; Playwright run requires a local dev server + seeded Neon branch which is a manual pre-merge step."
human_verification:
  - test: "Deploy a PR branch, open the Vercel preview URL, click 登录 → 使用 GitHub 登录, authorize; confirm redirect chain hops through production via AUTH_REDIRECT_PROXY_URL, lands back on preview URL signed in."
    expected: "UserChip renders GitHub avatar + name; preview + production session cookie both verify against shared AUTH_SECRET."
    why_human: "Requires real GitHub OAuth app + Vercel preview deployment; cannot be scripted in CI (GitHub blocks scripted logins)."
  - test: "Trigger magic link from a QQ / 163 mailbox, click the emailed link, return to the site."
    expected: "链接已发送 success state shown; email arrives within 10 minutes; clicking link authenticates the user; session persists after browser close/reopen."
    why_human: "Resend deliverability to Chinese MX hosts cannot be asserted from CI; requires a real mailbox + DNS-verified Resend sending domain."
  - test: "From a non-CN network, click 使用 Google 登录; authorize; confirm full round-trip."
    expected: "UserChip renders Google avatar + name; session persists."
    why_human: "Google is GFW-blocked in mainland CN; cannot be asserted from a CN-only CI runner."
  - test: "Run `pnpm playwright test tests/e2e/auth-github.spec.ts tests/e2e/auth-magic-link.spec.ts tests/e2e/anon-login-favorite.spec.ts tests/e2e/ban-enforcement.spec.ts` against a running dev server + seeded Neon branch."
    expected: "All four specs pass green."
    why_human: "Requires live dev server + seeded DB; not part of the default Vitest `pnpm vitest run` loop."
  - test: "Confirm Resend sending domain shows green SPF / DKIM / DMARC in the Resend dashboard."
    expected: "All three records verified."
    why_human: "DNS-level state verified out-of-band on the Resend dashboard."
---

# Phase 5: Auth + User Interactions — Verification Report

**Phase Goal (ROADMAP):** Users can create accounts via GitHub OAuth or email magic link, stay logged in across sessions, and favorite or vote on items; anonymous users are prompted to sign in when they attempt an interaction.

**Verified:** 2026-04-23
**Status:** human_needed (automated gates green; live OAuth + Resend deliverability require UAT)
**Re-verification:** No — initial verification

---

## 1. Success-Criteria Verdicts (ROADMAP.md)

| # | Success Criterion | Verdict | Evidence |
|---|-------------------|---------|----------|
| 1 | GitHub OAuth works on production + preview URLs without callback errors | PASS (pending UAT) | `src/lib/auth/config.ts:42-55` registers GitHub provider; `src/lib/auth/config.ts:36` wires `redirectProxyUrl = AUTH_REDIRECT_PROXY_URL`; `tests/unit/provider-github.test.ts` green; `tests/e2e/auth-github.spec.ts` asserts seeded-session UI contract; `docs/auth-providers.md §1, §4, §6` documents OAuth app setup + Vercel scope matrix + preview smoke test. Live round-trip → UAT. |
| 2 | Magic link works from China-accessible mailbox; session persists across browser close/reopen | PASS (pending UAT) | `src/lib/auth/config.ts:56-61` registers Resend provider with `sendChineseMagicLink`; `src/lib/auth/magic-link-email.ts` renders Chinese subject/body copy; `src/components/feed/login-prompt-modal.tsx:120-249` renders 邮箱 input + 发送登录链接 + 链接已发送 success state; session strategy `database` ensures persistence via DB row, not JWT. Deliverability → UAT. |
| 3 | Anonymous user clicking favorite or like sees sign-in modal (not error) | PASS | `src/components/feed/feed-card-actions.tsx:142-163` — `if (!isAuthenticated) openLoginModal(); return;`. `src/app/(reader)/layout.tsx:30` mounts `<LoginPromptModal />` once. `tests/unit/feed-card-actions.test.tsx` green. |
| 4 | Authenticated user can favorite → appears on `/favorites` reverse-chrono; unfavorite removes | PASS | `src/server/actions/favorites.ts:29-43` — `favoriteItem` / `unfavoriteItem` via pure core `favorites-core.ts`; `revalidatePath('/favorites')` invalidates the page cache. `src/app/(reader)/favorites/page.tsx:54-78` — JOIN items + `orderBy(desc(favorites.createdAt))` + `items.status='published'` filter; `force-dynamic` so no CDN cache. `tests/integration/server-action-favorite.test.ts` + `tests/integration/favorites-page.test.tsx` green. |
| 5 | Authenticated user can like / dislike; UI reflects immediately; honest-copy "personalization forthcoming" surfaced | PASS | `src/components/feed/feed-card-actions.tsx:121-124` — `useOptimisticCompat` (React 19 useOptimistic with React 18 fallback for test env); `:39` — `const PERSONALIZATION_COPY = '个性化推荐即将上线';` rendered at `:266-275`. `src/server/actions/votes.ts` + `src/lib/user-actions/votes-core.ts` implement D-12 exclusive toggle. `tests/unit/vote-honest-copy.test.tsx` + `tests/unit/vote-value-contract.test.ts` + `tests/integration/server-action-vote.test.ts` green. |

**Roadmap Success Criteria Score:** 5/5 automated portions green; 2 of 5 have UAT components explicitly deferred to manual testing.

---

## 2. Observable Truths (derived from Plan must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Auth.js v5 singleton exports `handlers`, `auth`, `signIn`, `signOut` | VERIFIED | `src/lib/auth/index.ts:17` — `export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);`; `src/lib/auth/session.ts:20-32` — `getSession`, `requireSession` helpers. |
| 2 | Drizzle adapter wired to users + accounts + sessions + verification_tokens | VERIFIED | `src/lib/auth/config.ts:27-32` — `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, verificationTokensTable })`. Schema in `src/lib/db/schema.ts:216-252`. |
| 3 | Three providers registered: GitHub, Resend, Google (in that order per D-06) | VERIFIED | `src/lib/auth/config.ts:41-75` — providers array ordering matches D-06. |
| 4 | Database session strategy (revocable) | VERIFIED | `src/lib/auth/config.ts:33` — `session: { strategy: 'database' }`. |
| 5 | Two-layer ban enforcement | VERIFIED | Layer 1 — `src/lib/auth/config.ts:88-90` session callback returns null when `u.isBanned`. Layer 2 — `src/lib/user-actions/auth-guard.ts:46-65` re-reads `users.is_banned` per action. `tests/integration/ban-enforcement.test.ts` covers Layer 1; `tests/integration/server-action-auth-guard.test.ts` covers Layer 2. |
| 6 | Session payload exposes `{id, email, name, image, role}` and excludes `is_banned` | VERIFIED | `src/lib/auth/config.ts:79-100` session callback. `tests/unit/session-payload.test.ts` green. |
| 7 | Migration 0004 creates accounts/sessions/verification_tokens + adds emailVerified + image on users | VERIFIED | `drizzle/0004_auth.sql:10-43` — ALTER TABLE users ADD + 3 CREATE TABLE IF NOT EXISTS with UUID FKs to users(id). Schema types in `src/lib/db/schema.ts:134-135, 216-252`. `tests/unit/schema-auth.test.ts` + `tests/unit/schema-users-extension.test.ts` green. |
| 8 | UserChip renders anonymous / authenticated+image / authenticated+monogram (3 states) + sign-out popover | VERIFIED | `src/components/layout/user-chip.tsx:61-79` anonymous branch; `:85-238` authenticated branch with image-vs-monogram fork at `:111-142`; click-outside + Escape close; `role="menu"` + `role="menuitem"` + `signOutAction()` wired. `tests/unit/user-chip.test.tsx` + `tests/unit/user-chip-signout.test.tsx` green. Icon union extended with `log-out` + `user` (`src/components/layout/icon.tsx:36`). |
| 9 | LoginPromptModal renders GitHub + Email-form + Google in D-06 locked order with 检查邮箱 success state | VERIFIED | `src/components/feed/login-prompt-modal.tsx:302-425` — locked top-to-bottom order; `EmailMagicLinkForm` at `:120-249` includes success state (`:143-184`) + error state (`:233-247`); `signInGithubAction` / `signInResendAction` / `signInGoogleAction` wired. `tests/unit/login-prompt-modal.test.tsx` + `tests/unit/login-prompt-modal-magic-link.test.tsx` green. |
| 10 | FeedCardActions wraps clicks in useOptimistic + useTransition; rolls back on failure | VERIFIED | `src/components/feed/feed-card-actions.tsx:121-124` `useOptimisticCompat`; `:148-157` optimistic apply → server-action → rollback on catch. `tests/unit/feed-card-actions.test.tsx` green. |
| 11 | VOTE-03 honest copy present + contains 个性化 + 即将 | VERIFIED | `src/components/feed/feed-card-actions.tsx:39` `const PERSONALIZATION_COPY = '个性化推荐即将上线';` rendered at `:266-275`. `tests/unit/vote-honest-copy.test.tsx` green. |
| 12 | /favorites auth-gated: anonymous → redirect('/'); authenticated → user-scoped query, reverse-chrono, status='published' | VERIFIED | `src/app/(reader)/favorites/page.tsx:40-47` — `if (!session?.user?.id) redirect('/')`; `:54-78` user-scoped query with `innerJoin(items)` + `where(and(eq(favorites.userId, userId), eq(items.status, 'published')))` + `orderBy(desc(favorites.createdAt))`. `force-dynamic` at `:34`. `tests/integration/favorites-page.test.tsx` green. |
| 13 | Server actions for favorite / unfavorite / vote apply Layer-2 ban guard | VERIFIED | `src/server/actions/favorites.ts:29-43` + `src/server/actions/votes.ts:32-39` both call `requireLiveUserCore(session)` before DB mutation. `tests/integration/server-action-favorite.test.ts` + `tests/integration/server-action-vote.test.ts` + `tests/integration/server-action-auth-guard.test.ts` green. |
| 14 | Anonymous read preserved on feed pages (AUTH-06) | VERIFIED | `src/app/(reader)/page.tsx`, `src/app/(reader)/all/page.tsx`, `src/app/(reader)/items/[id]/page.tsx` contain NO `redirect()` or `requireSession()` call; reader layout calls `auth()` only to thread session into UserChip. Confirmed by grep — no auth gates on feed pages. |
| 15 | next.config remotePatterns allowlists GitHub + Google avatar hosts | VERIFIED | `next.config.ts:23-25` — `avatars.githubusercontent.com` + `lh3.googleusercontent.com`. `tests/unit/env-remote-patterns.test.ts` green. |
| 16 | Env vars complete: AUTH_*, GITHUB_*, GOOGLE_*, RESEND_API_KEY, RESEND_FROM, AUTH_REDIRECT_PROXY_URL | VERIFIED | `.env.example:34-56` contains all 9 Phase 5 vars including new `RESEND_FROM` and `AUTH_REDIRECT_PROXY_URL`. |
| 17 | Auth runbook documents GitHub / Google / Resend / Vercel scopes / admin bootstrap / ban runbook | VERIFIED | `docs/auth-providers.md` 199 lines, sections §1–§8 cover: (1) GitHub OAuth app, (2) Google OAuth, (3) Resend, (4) Vercel env scope matrix, (5) admin promotion SQL, (6) preview smoke test, (7) ban enforcement SQL, (8) final deployment checklist. |
| 18 | Playwright E2E specs present for auth-github, auth-magic-link, anon-login-favorite, ban-enforcement | VERIFIED (exists; live run deferred) | `tests/e2e/auth-github.spec.ts` (71 L), `tests/e2e/auth-magic-link.spec.ts` (52 L), `tests/e2e/anon-login-favorite.spec.ts` (86 L), `tests/e2e/ban-enforcement.spec.ts` (63 L). Substantive bodies, not stubs. |

**Score:** 18/18 automated truths verified.

---

## 3. Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth/config.ts` | Auth.js v5 config w/ adapter, 3 providers, session callback | VERIFIED | 119 lines; provider ordering + ban callback + signIn/linkAccount events all present |
| `src/lib/auth/index.ts` | NextAuth singleton exports | VERIFIED | 19 lines, exports `handlers, auth, signIn, signOut, GET, POST` |
| `src/lib/auth/session.ts` | `getSession` + `requireSession` helpers | VERIFIED | 32 lines |
| `src/lib/auth/magic-link-email.ts` | Chinese magic-link email renderer | VERIFIED | Exists; used by `config.ts:61` |
| `src/lib/user-actions/auth-guard.ts` | Layer-2 ban guard (`requireLiveUserCore`) | VERIFIED | 65 lines, throws `AuthError` with discriminant |
| `src/lib/user-actions/favorites-core.ts` | Pure core for favorite/unfavorite | VERIFIED | Exists + tested |
| `src/lib/user-actions/votes-core.ts` | Pure core with D-12 exclusive toggle | VERIFIED | Exists + tested |
| `src/lib/user-actions/get-interactions.ts` | Fetch user interaction map for feed rendering | VERIFIED | Exists; consumed by favorites page + feed RSCs |
| `src/server/actions/auth.ts` | signInGithubAction / signInGoogleAction / signInResendAction / signOutAction | VERIFIED | 45 lines; discriminated-union Resend result |
| `src/server/actions/favorites.ts` | favoriteItem / unfavoriteItem server actions | VERIFIED | 44 lines; Layer-2 guard + `revalidatePath('/favorites')` |
| `src/server/actions/votes.ts` | voteItem server action | VERIFIED | 40 lines; Layer-2 guard + no revalidate (intentional) |
| `src/app/api/auth/[...nextauth]/route.ts` | GET + POST re-export | VERIFIED | 14 lines; `runtime='nodejs'` set |
| `src/components/feed/login-prompt-modal.tsx` | Real providers + magic-link form + success state | VERIFIED | 429 lines |
| `src/components/feed/feed-card-actions.tsx` | Optimistic action bar + VOTE-03 copy | VERIFIED | 280 lines |
| `src/components/layout/user-chip.tsx` | 3-state render + sign-out popover | VERIFIED | 239 lines |
| `src/app/(reader)/favorites/page.tsx` | Auth-gated RSC with reverse-chrono query | VERIFIED | 139 lines |
| `src/app/(reader)/favorites/favorites-empty.tsx` | Authenticated empty-state | VERIFIED | Exists |
| `drizzle/0004_auth.sql` | Migration adding accounts/sessions/verification_tokens + users columns | VERIFIED | 43 lines |
| `docs/auth-providers.md` | Operational runbook (≥8 sections) | VERIFIED | 199 lines, §1–§8 all present |
| `.env.example` (auth vars) | 9 Phase 5 auth vars | VERIFIED | L34–56 |
| `next.config.ts` (remotePatterns) | github + google avatar hosts | VERIFIED | L23–25 |

---

## 4. Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `reader/layout.tsx` | `auth()` session | `await auth()` → `<ReaderShell session>` → `<Sidebar>` → `<UserChip>` | WIRED (prop-drill per CLAUDE.md §11; no `useSession`) |
| `LoginPromptModal` | `signInGithubAction` / `signInResendAction` / `signInGoogleAction` | `<form onSubmit>` handler calls server action | WIRED |
| `UserChip` | `signOutAction` | `<form onSubmit>` menu item | WIRED |
| `FeedCardActions` | `favoriteItem` / `unfavoriteItem` / `voteItem` | `startTransition(async () => await favoriteItem(...))` | WIRED |
| `favorites server actions` | `requireLiveUserCore` | imported in `src/server/actions/favorites.ts:23`, `votes.ts:25` | WIRED |
| `config.ts session callback` | `users.is_banned` | `if (u.isBanned) return null` | WIRED (Layer 1) |
| `favorites/page.tsx` | redirect on unauthenticated | `if (!session?.user?.id) redirect('/')` | WIRED |
| `reader/layout.tsx` | `<LoginPromptModal />` single mount | imported + rendered once at layout root | WIRED |
| `FeedCardActions` anon branch | `open-login-modal` CustomEvent | `document.dispatchEvent(new CustomEvent('open-login-modal'))` | WIRED; LoginPromptModal listens at `document.addEventListener('open-login-modal', ...)` |
| `DrizzleAdapter` | schema tables | `{ usersTable, accountsTable, sessionsTable, verificationTokensTable }` all imported from `@/lib/db/schema` | WIRED |

---

## 5. Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `favorites/page.tsx` | `feedItems` | Drizzle `db.select()...from(favorites).innerJoin(items)...orderBy(desc(favorites.createdAt))` | YES — real SQL query against Neon | FLOWING |
| `UserChip` | `session.user` | Prop from `reader/layout.tsx` → `await auth()` → Auth.js DB session | YES — real session or null | FLOWING |
| `FeedCardActions` | `optimistic` | `initial` prop from RSC parent via `getUserInteractions(userId, [itemIds])` | YES — real interaction map in feed pages | FLOWING |
| `LoginPromptModal` success state | `state` | `signInResendAction(formData)` → `signIn('resend')` → Resend API | YES (pending live key) — returns discriminated union | FLOWING (behavior contract verified by test; deliverability → UAT) |
| `config.ts session callback` | `user.isBanned` | DB row via database session strategy | YES — Auth.js reads DB on each refresh | FLOWING |

---

## 6. Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 5 unit+integration tests pass | `pnpm vitest run tests/unit tests/integration` | 67/67 pass | PASS |
| `log-out` + `user` icons in `IconName` union | `grep -n "'log-out'\\|'user'" src/components/layout/icon.tsx` | both present (L36+) | PASS |
| `PERSONALIZATION_COPY` constant has "个性化" AND "即将" | `grep "PERSONALIZATION_COPY" src/components/feed/feed-card-actions.tsx` | L39: `'个性化推荐即将上线'` | PASS |
| `users.image` + `users.emailVerified` columns in schema | `grep emailVerified src/lib/db/schema.ts` | L134–135 present | PASS |
| Migration 0004 has `CREATE TABLE accounts/sessions/verification_tokens` + `ALTER TABLE users` | `cat drizzle/0004_auth.sql` | All 4 DDLs present | PASS |
| 3 providers in config | `grep "GitHub(\\|Resend(\\|Google(" src/lib/auth/config.ts` | all three (L42, 56, 62) | PASS |
| force-dynamic set on /favorites | `grep "dynamic = 'force-dynamic'" src/app/(reader)/favorites/page.tsx` | L34 present | PASS |
| redirect to / on anonymous /favorites | `grep "redirect('/')" src/app/(reader)/favorites/page.tsx` | L46 present | PASS |

---

## 7. Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AUTH-01 | Auth.js v5 configured with Drizzle adapter | SATISFIED | `src/lib/auth/config.ts:27` |
| AUTH-02 | GitHub OAuth works end-to-end on production + preview | SATISFIED (pending UAT) | `config.ts:42`, `docs/auth-providers.md §1+§4+§6` |
| AUTH-03 | Email magic link via Resend | SATISFIED (pending deliverability UAT) | `config.ts:56`, `magic-link-email.ts` |
| AUTH-04 | Google OAuth as secondary | SATISFIED (pending non-CN UAT) | `config.ts:62`, Google button is `variant="secondary"` in modal |
| AUTH-05 | AUTH_REDIRECT_PROXY_URL for preview OAuth | SATISFIED | `config.ts:36`, `.env.example:43`, `docs/auth-providers.md §4` |
| AUTH-06 | Anonymous read; no login wall | SATISFIED | No auth gate on `page.tsx`/`all/page.tsx`/`items/[id]/page.tsx` — grep-verified |
| AUTH-07 | Sessions persist across browser refresh | SATISFIED | Database session strategy; Auth.js re-reads DB row per request |
| AUTH-08 | Sign out works from any page | SATISFIED | UserChip popover renders on every (reader) page via sidebar |
| FAV-01 | Authenticated user can favorite; UI reflects immediately | SATISFIED | `favoriteItem` + `useOptimistic` |
| FAV-02 | Authenticated user can unfavorite | SATISFIED | `unfavoriteItem` |
| FAV-03 | /favorites reverse-chrono | SATISFIED | `favorites/page.tsx:78` `orderBy(desc(favorites.createdAt))` |
| VOTE-01 | Authenticated user can like | SATISFIED | `voteItem(itemId, 1)` |
| VOTE-02 | Authenticated user can dislike | SATISFIED | `voteItem(itemId, -1)` |
| VOTE-03 | Honest copy indicating personalization forthcoming | SATISFIED | `PERSONALIZATION_COPY = '个性化推荐即将上线'` |
| VOTE-04 | Favorite/like/dislike requires login; anon → modal | SATISFIED | `feed-card-actions.tsx:142-163` |

All 15 AUTH/FAV/VOTE requirements SATISFIED in code.

**Documentation inconsistency noted (not blocking):** `.planning/REQUIREMENTS.md:223` traceability table marks AUTH-06 as "Pending"; code is complete and the checklist at L80 marks it `[x]`. The table row should be updated to "Complete" in a small follow-up doc edit.

---

## 8. Anti-Patterns Found

No blocking anti-patterns.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md:223` | AUTH-06 traceability row says "Pending" while code satisfies the requirement (and the checklist at L80 marks `[x]`) | Info | Documentation-only; no functional impact. Flip to "Complete" when convenient. |
| `src/components/feed/feed-card-actions.tsx:78-94` | Runtime-flexible `useOptimisticCompat` that conditionally chooses between React 19 `useOptimistic` and a React-18 useState fallback | Info | Intentional, documented; required because Vitest uses React 18.3 while Next 15 ships React 19 canary. Hooks-order invariant preserved via module-level constant. Known trade-off, not a stub. |

No TODO/FIXME/placeholder comments found in Phase 5 files. No empty handlers. No static-return server actions. All `=[]`/`={}` patterns are legitimate state initializers overwritten by real DB fetches or optimistic updates.

---

## 9. Test Suite Result

Full `pnpm vitest run`:
- **Test Files:** 39 passed, 5 failed (44 total)
- **Tests:** 220 passed, 3 failed (223 total)

**Phase 5 scope (`pnpm vitest run tests/unit tests/integration`):** 21 files, 67 tests, **all pass**.

**All 5 failing test files and all 3 failing tests are in the Phase 3 LLM domain, not Phase 5:**
- `src/trigger/process-pending.test.ts` — module-load failure
- `src/lib/llm/enrich.test.ts` — module-load failure
- `src/lib/llm/process-item-core.test.ts` — module-load failure
- `src/lib/llm/embed.test.ts` — module-load failure
- `src/lib/llm/client.test.ts` (3 tests) — Anthropic SDK `dangerouslyAllowBrowser` guard blocks construction under jsdom

Root cause: `@anthropic-ai/sdk` refuses to construct under jsdom (Vitest browser-like env) without the `dangerouslyAllowBrowser` flag. These failures predate Phase 5 (Phase 3 tests; not modified in Phase 5) and are **out of scope for this verification**. Recommend filing a follow-up to either mock the SDK in Phase-3 tests or pass the flag in the test-only client factory.

---

## 10. Gap / Deferred Summary

**Gaps (blocking):** none.

**Deferred items (addressed by UAT, not Phase 5 automated scope):**
1. Live GitHub OAuth round-trip on Vercel preview (ROADMAP SC1 — explicit UAT per 05-VALIDATION.md)
2. Magic-link deliverability from CN mailbox (ROADMAP SC2 — explicit UAT)
3. Real browser close/reopen session persistence (ROADMAP SC2 — explicit UAT)
4. Google OAuth from non-CN network (AUTH-04 — explicit UAT)
5. Playwright spec execution against a running dev server + seeded Neon branch (specs exist + are substantive; a live green run is the last verification step before merge)

All five items are documented in `05-VALIDATION.md §Manual-Only Verifications` and `docs/auth-providers.md §6 (Preview OAuth smoke test)` and `docs/auth-providers.md §8 (Final deployment checklist)`.

---

## Overall Phase Verdict

**PASS — pending documented UAT.**

All 18 automated observable truths are VERIFIED. All 15 AUTH/FAV/VOTE requirements are SATISFIED in code and covered by green unit + integration tests (67/67 Phase-5 tests pass). All 5 ROADMAP Success Criteria are met for the automated portion; SC1, SC2, and a portion of SC5 have UAT components that cannot be run in CI (live GitHub OAuth, Resend deliverability, real browser close/reopen) and are deferred to manual testing per `05-VALIDATION.md` and `docs/auth-providers.md §6`. No blocking gaps, no placeholder code, no broken wiring.

Recommendation: proceed to the `docs/auth-providers.md §8` pre-deployment checklist and the 5 UAT items above before marking Phase 5 "deployed". The one minor doc edit — flipping `REQUIREMENTS.md:223` AUTH-06 row from Pending→Complete — can happen in the same follow-up commit.

---

_Verified: 2026-04-23T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
