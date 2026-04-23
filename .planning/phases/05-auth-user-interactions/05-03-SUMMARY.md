---
phase: 05-auth-user-interactions
plan: 03
subsystem: auth
tags: [auth.js, providers, github-oauth, google-oidc, resend-magic-link, next-image-allowlist]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 authConfig singleton with empty providers array + DrizzleAdapter + database session + events.linkAccount avatar mirror
  - phase: 05-auth-user-interactions
    provides: Plan 05-00 test stubs provider-github.test.ts, provider-google.test.ts, provider-resend.test.ts, env-remote-patterns.test.ts
provides:
  - authConfig.providers populated in D-06 order (GitHub → Resend → Google)
  - src/lib/auth/magic-link-email.ts — sendChineseMagicLink(params, deps?) Chinese-body email sender POSTing to Resend HTTP API (subject 'AI Hotspot 登录链接', 10-min-TTL copy per UI-SPEC §Email body)
  - MagicLinkError class for non-OK Resend responses (status preserved)
  - GitHub profile() mapping { id, name|login, email, avatar_url } → { id: string, name, email, image } (D-04)
  - Google OIDC profile() mapping { sub, name, email, picture } → { id, name, email, image } (D-04)
  - Resend provider wired with sendVerificationRequest = sendChineseMagicLink
  - next.config.ts images.remotePatterns = [avatars.githubusercontent.com, lh3.googleusercontent.com] — threat T-5-12 mitigation
affects: [05-04, 05-05, 05-06, 05-08, 05-09, 05-10]

tech-stack:
  added: []
  patterns:
    - "Injectable deps.fetch in src/lib/auth/magic-link-email.ts — mirrors src/lib/feed/get-feed.ts style so unit tests assert request shape without the network"
    - "Provider options.profile access pattern — Auth.js v5 @auth/core places the user-supplied profile() override at provider.options.profile while the built-in OAuth default lives at provider.profile. Tests introduce a getProfileFn helper that prefers the override; documented inline for downstream plans that assert provider internals"
    - "Explicit remotePatterns allowlist (no wildcards) — matches RESEARCH §Pitfall 7 and the T-5-12 SSRF threat disposition"

key-files:
  created:
    - src/lib/auth/magic-link-email.ts
  modified:
    - src/lib/auth/config.ts
    - next.config.ts
    - tests/unit/provider-github.test.ts
    - tests/unit/provider-google.test.ts
    - tests/unit/provider-resend.test.ts
    - tests/unit/auth-config.test.ts

key-decisions:
  - "Provider override lives at options.profile, not top-level — discovered when Google profile() assertion failed despite the provider being registered. @auth/core Google factory is OIDC (no default profile); GitHub is OAuth2 (has a default profile at the top level). User-supplied profile() from Provider({ profile }) lands inside options. Tests were updated to use a helper that prefers the override, with inline documentation so future plans don't re-learn this."
  - "Updated Plan 05-02's auth-config.test.ts providers.length assertion from 0 → 3. Plan 02 shipped length===0 as an explicit scope-boundary marker (its SUMMARY §Scope Boundary calls this out); with Plan 03 landed the scope shifts and the assertion tracks. Per-provider shape + profile() assertions live in the per-provider test files, so we did not lose granularity."
  - "Built both text and HTML email bodies. UI-SPEC §Email body marks text as deliverability-primary and HTML as optional-but-recommended; shipping both now avoids a follow-up edit in Plan 05-05 (modal) when deliverability testing surfaces HTML-only preview issues."
  - "Injectable deps.fetch rather than vi.spyOn(globalThis, 'fetch'). Keeps the test hermetic and makes the call-site dependency explicit. Consistent with src/lib/feed/get-feed.ts and the existing Plan 2/3 adapter pattern."

requirements-completed: [AUTH-02, AUTH-03, AUTH-04]

duration: 5 min
completed: 2026-04-23
---

# Phase 5 Plan 03: Provider Wiring (GitHub + Resend + Google) Summary

**Registers the three Auth.js providers — GitHub (primary OAuth), Resend (magic-link), Google (secondary OIDC) — inside the authConfig from Plan 02; ships the Chinese magic-link email body per UI-SPEC §Email body; and allowlists the two OAuth avatar CDN hosts in next.config for next/image rendering. After this plan, a developer with env vars populated can complete OAuth round-trips locally and receive magic-link emails.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-23T06:04:58Z
- **Completed:** 2026-04-23T06:09:53Z
- **Tasks:** 3 (all auto; first two TDD; no checkpoints)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `src/lib/auth/magic-link-email.ts` exports `sendChineseMagicLink(params, deps?)` + `MagicLinkError`. The function POSTs to `https://api.resend.com/emails` with `Authorization: Bearer {provider.apiKey}`, sends subject `'AI Hotspot 登录链接'` and a Chinese text+HTML body containing the magic URL and the literal `'链接 10 分钟内有效'` copy. Non-OK Resend responses throw `MagicLinkError(message, status)`.
- `src/lib/auth/config.ts` — providers array populated in D-06 order (GitHub → Resend → Google). GitHub profile() returns `{ id: String(profile.id), name: profile.name ?? profile.login, email, image: profile.avatar_url }`. Google profile() returns `{ id: profile.sub, name, email, image: profile.picture }`. Resend wired with `sendVerificationRequest: sendChineseMagicLink`. Plan 02's `events.linkAccount` callback already mirrors `image → users.avatar_url` so OAuth sign-ups auto-populate the Phase 4 avatar column per D-04.
- `next.config.ts` — `images.remotePatterns` added with the two OAuth avatar CDN hosts; `serverExternalPackages` preserved verbatim. Threat T-5-12 (SSRF via next/image fetch) mitigated by an explicit two-host allowlist — no wildcards.
- Test stubs from Plan 05-00 flipped green: `provider-github.test.ts` (3 tests), `provider-google.test.ts` (2 tests), `provider-resend.test.ts` (5 tests), `env-remote-patterns.test.ts` (2 tests). Plan 05-02 regression tests (`auth-config.test.ts`, `session-payload.test.ts`, `ban-enforcement.test.ts`) still pass — 18/18 across the combined 05-02 + 05-03 surface.
- `pnpm typecheck` shows zero new errors in the Plan 05-03 surface (`src/lib/auth/**`, `next.config.ts`, the four plan-owned test files).

## Task Commits

1. **Task 1 (TDD): Create magic-link-email.ts with Chinese body** — `0da9c6f` (feat)
2. **Task 2 (TDD): Wire GitHub + Resend + Google providers in authConfig** — `89161d3` (feat)
3. **Task 3: Update next.config.ts remotePatterns for OAuth avatars** — `ac9f12a` (feat)

_Plan metadata commit follows (docs: complete plan)._

## Files Created/Modified

**Created (1):**
- `src/lib/auth/magic-link-email.ts` — 108 lines; exports `sendChineseMagicLink`, `MagicLinkError`, `SendMagicLinkParams`, `SendMagicLinkDeps`

**Modified (6):**
- `src/lib/auth/config.ts` — +36 lines (providers array populated + three provider imports + sendChineseMagicLink import); D-06 order + D-04 profile() mappings
- `next.config.ts` — +14 lines; `images.remotePatterns` added
- `tests/unit/provider-github.test.ts` — full test body: id=='github' assertion + profile() mapping + name-fallback-to-login
- `tests/unit/provider-google.test.ts` — full test body: id=='google' assertion + profile() mapping (sub→id, picture→image)
- `tests/unit/provider-resend.test.ts` — expanded: POST URL + Authorization header, Chinese subject + 10-min-TTL body, MagicLinkError on non-OK status, + Task 2 provider-presence assertion
- `tests/unit/auth-config.test.ts` — `providers.length` assertion updated from `0 → 3` to track the scope shift post-Plan-03 (documented inline)

## Decisions Made

- **Provider override lives at `options.profile`, not at the provider object top level.** Auth.js v5 @auth/core puts the user-supplied `profile()` from `Provider({ profile })` inside `options`. GitHub (OAuth2) additionally exposes a built-in default at the top level; Google (OIDC) does not. The per-provider tests introduced a `getProfileFn(p)` helper (`p?.options?.profile ?? p?.profile`) so the override is always preferred, documented inline so downstream plans that assert provider internals (05-05 LoginPromptModal provider buttons; 05-10 hardening) don't re-learn this. Committed to test files rather than production code because it is a test-only concern — production code never introspects the provider objects; @auth/core wires everything internally.
- **Ship HTML email body alongside plain text.** UI-SPEC §Email body marks text as deliverability-primary and HTML as "optional but recommended." Shipping both now saves an edit pass when Plan 05-05 integrates the sign-in modal's success state with live deliverability testing. HTML uses inline styles only (email clients strip `<style>`), and the accent color matches `--accent-500` (#D4911C).
- **Injectable `deps.fetch` instead of `vi.spyOn(globalThis, 'fetch')`.** Hermetic test, explicit call-site dependency, no global mutation to clean up. Matches the adapter pattern used throughout Phase 2/3 (`src/lib/feed/get-feed.ts`, `src/lib/rsshub.ts`). Production call-sites omit `deps` and the default `globalThis.fetch` is used.
- **Updated Plan 02's `auth-config.test.ts` `providers.length` assertion from 0 to 3.** Plan 02's SUMMARY §Scope Boundary explicitly flagged the `length===0` line as the scope-boundary marker between Plans 02 and 03. Changing it from 0 to 3 is the natural transition; per-provider assertions live in the per-provider test files so we do not lose coverage granularity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 02's `auth-config.test.ts` `providers.length === 0` assertion**
- **Found during:** Task 2 verification (`pnpm vitest run ... tests/unit/auth-config.test.ts`)
- **Issue:** Plan 02 intentionally shipped `expect(cfg.authConfig.providers!.length).toBe(0)` as the scope-boundary marker between Plans 02 and 03 (Plan 02 SUMMARY §Scope Boundary confirms this). Once Plan 03 populates the providers array, the assertion has to track the new reality or it blocks every downstream plan.
- **Fix:** Changed the assertion from `0` → `3` with an inline comment documenting the Plan-02→Plan-03 transition and pointing at the per-provider test files for the shape coverage.
- **Files modified:** `tests/unit/auth-config.test.ts`
- **Commit:** `89161d3` (grouped with Task 2 provider wiring; the test-update is a direct prerequisite for the plan's verification to go green)

**2. [Rule 1 - Bug] Google OIDC provider has no top-level `profile` — test had to read `options.profile`**
- **Found during:** Task 2 first verification (`provider-google.test.ts` profile() assertion failed: `expected undefined to be defined`)
- **Issue:** The initial per-provider tests attempted `provider.profile(...)` directly, assuming all provider factories expose their profile fn at the top level. @auth/core's Google factory is OIDC — it has no default `profile`; the user-supplied override from `Google({ profile() {...} })` lives inside `options`. GitHub works either way (it has a default profile at the top level), so the GitHub test had passed and masked the issue.
- **Fix:** Added a shared `getProfileFn(p) => p?.options?.profile ?? p?.profile` helper in both per-provider test files, with an inline code comment explaining the rule. Production `src/lib/auth/config.ts` was not touched — the provider wiring is correct; this was a test-introspection bug.
- **Files modified:** `tests/unit/provider-github.test.ts`, `tests/unit/provider-google.test.ts`
- **Commit:** `89161d3` (grouped with Task 2)

### Scope Boundary

- Out-of-scope findings during execution (noted but not fixed):
  - `git status` at the start of the session showed three untracked paths (`.claude/`, `src/server/`, `tests/integration/server-action-favorite-adapter.test.ts`) left behind by the parallel 05-06 worktree. Not touched — those belong to the 05-06 wave's cleanup path.
  - Pre-existing Wave 0 red typecheck errors in `tests/unit/feed-card-actions.test.tsx`, `tests/unit/user-chip.test.tsx`, `tests/unit/vote-honest-copy.test.tsx` are owned by Plans 05-04/05-05/05-07 — documented in Plan 05-01 SUMMARY and not in this plan's scope.
  - vitest warns `deps.inline` is deprecated in favour of `server.deps.inline`. Comment in `vitest.config.ts` already notes this and the workaround required. Not this plan's concern.

**Total deviations:** 2 auto-fixed (1 blocking test-assertion update; 1 test-introspection bug). No architectural changes.

## Issues Encountered

- **@auth/core provider introspection surface is undocumented.** Tests that assert the shape of provider objects (id, type, profile) must know where each field lives. Top-level vs `.options` placement differs between OAuth2 (GitHub) and OIDC (Google) providers. The `getProfileFn` helper documents this inline; if future plans grow more provider-introspection tests, consider lifting the helper into `tests/helpers/provider.ts`.
- **No production impact from the Google override location** — @auth/core wires `options.profile` correctly at sign-in time. The issue was purely test visibility.

## User Setup Required

Real provider credentials are only needed for local OAuth round-trips and real magic-link delivery. The plan ships without them; tests run green without any env vars set (`sendChineseMagicLink` is unit-tested with a mock fetch). For dev sign-in flow:

- **GitHub OAuth App:** `github.com/settings/developers` → New OAuth App → callback URL `http://localhost:3000/api/auth/callback/github` (dev) + `https://{production-domain}/api/auth/callback/github` (prod). Copy Client ID + secret into `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
- **Google OAuth Client:** `console.cloud.google.com` → APIs & Services → Credentials → OAuth 2.0 Client ID. Add authorized redirect URI `http://localhost:3000/api/auth/callback/google` (dev) + prod. Copy into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Resend:** `resend.com/api-keys` → Create. For dev use `onboarding@resend.dev` (RESEND_FROM). For prod verify sending domain (SPF + DKIM) at `resend.com/domains`.
- All nine env var names are already in `.env.example` (Plan 02 Task 3).

## Next Plan Readiness

- **Plan 05-05 (Wave 4: login modal wiring) is unblocked.** The three providers are now signed into `authConfig.providers`; the modal can call `signIn('github')`, `signIn('resend', { email, redirect: false })`, `signIn('google')` directly using the `signIn` function re-exported from `@/lib/auth`.
- **Plan 05-04 (UserChip authenticated branch) is unblocked.** OAuth avatars rendered via `<Image src={session.user.image} />` now pass `next/image`'s hostname check; the authenticated branch can safely reach for `avatars.githubusercontent.com` and `lh3.googleusercontent.com`. Monogram-fallback path for magic-link users (no image) is still required — covered by D-18.
- **Plan 05-10 (hardening) — env-remote-patterns.test.ts is now fully green.** The Wave 0 stub's first assertion (remotePatterns) was intentionally left red by Plan 02; it is now green. The second assertion (env-example coverage) was already green from Plan 02 Task 3. Plan 05-10 may still add additional assertions (e.g. guarding against adding wildcards to remotePatterns) but the baseline file no longer needs edits to go green.
- **Vitest inline list (`next-auth` + `@auth/core`) remains necessary.** Plan 02 set this up; Plan 03 relies on it transitively for every provider import. Do not remove from `vitest.config.ts`.
- **Test-introspection helper candidate:** if Plan 05-10 adds more provider-shape assertions, consider factoring `getProfileFn` into `tests/helpers/provider.ts`. For now the two duplicated copies in `provider-github.test.ts` / `provider-google.test.ts` are self-documenting and cheap.

## Threat Surface Scan

All security-relevant surface introduced by this plan is already captured in the plan's `<threat_model>`:

- T-5-02 (OAuth spoofing) — mitigated by Auth.js v5 default state+PKCE on GitHub + Google providers (no override).
- T-5-04 (Elevation via GitHub profile spoofing) — mitigated: profile() does NOT set role; the role column stays at its DB default `'user'`.
- T-5-05 (Magic-link token replay) — mitigated: verification_tokens composite PK (Plan 01) + Auth.js single-use adapter semantics + 10-min TTL (default; copy mentions it).
- T-5-07 (XSS via user-set name/image) — mitigated: React escapes name on render; next/image only accepts URLs matching remotePatterns.
- T-5-12 (SSRF via next/image server-side fetch) — mitigated: this plan's explicit two-host remotePatterns allowlist, no wildcard.

No new surface to flag.

## Self-Check: PASSED

- [x] `src/lib/auth/magic-link-email.ts` exists with `export async function sendChineseMagicLink` + `export class MagicLinkError` (grep confirmed)
- [x] `grep -q "AI Hotspot 登录链接" src/lib/auth/magic-link-email.ts` → present
- [x] `grep -q "链接 10 分钟内有效" src/lib/auth/magic-link-email.ts` → present
- [x] `grep -c "GitHub(" src/lib/auth/config.ts` → 1
- [x] `grep -c "Resend(" src/lib/auth/config.ts` → 1
- [x] `grep -c "Google(" src/lib/auth/config.ts` → 1
- [x] `sendChineseMagicLink` imported in config.ts (`grep -c 'sendChineseMagicLink' src/lib/auth/config.ts` → 2 — import + sendVerificationRequest reference)
- [x] `grep -q "avatars.githubusercontent.com" next.config.ts` → present
- [x] `grep -q "lh3.googleusercontent.com" next.config.ts` → present
- [x] `grep -q "serverExternalPackages: \['ws'" next.config.ts` → preserved
- [x] Commits `0da9c6f`, `89161d3`, `ac9f12a` exist in `git log --oneline -5`
- [x] `pnpm vitest run tests/unit/provider-github.test.ts tests/unit/provider-google.test.ts tests/unit/provider-resend.test.ts tests/unit/env-remote-patterns.test.ts` → 12/12 green
- [x] Plan 02 regression: `pnpm vitest run tests/unit/auth-config.test.ts tests/unit/session-payload.test.ts tests/integration/ban-enforcement.test.ts` → 6/6 still green (18/18 combined)
- [x] `pnpm typecheck` produces no new errors in `src/lib/auth/**`, `next.config.ts`, or plan-owned test files

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
