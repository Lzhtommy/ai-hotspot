---
phase: 5
slug: auth-user-interactions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit + integration) + Playwright (E2E) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (Wave 0 installs if missing) |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run && pnpm playwright test` |
| **Estimated runtime** | ~60–90 seconds (vitest) + ~3–5 min (Playwright, E2E OAuth uses stubbed provider) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed` (or targeted test file)
- **After every plan wave:** Run `pnpm vitest run && pnpm playwright test` against a Neon branch DB
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~90 seconds (unit); ~5 min (full with Playwright)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-00-01 | 00 | 0 | — | — | Vitest + Playwright installed | infra | `pnpm vitest --version && pnpm playwright --version` | ❌ W0 | ⬜ pending |
| 5-01-01 | 01 | 1 | AUTH-01 | T-5-01 | Migration 0004 creates accounts/sessions/verification_tokens with UUID userId FK | unit | `pnpm vitest run tests/unit/schema-auth.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | AUTH-01 | — | `users.emailVerified` + `image` columns added; existing columns preserved | unit | `pnpm vitest run tests/unit/schema-users-extension.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | AUTH-01 | T-5-02 | Auth.js config exports handlers/auth/signIn/signOut with Drizzle adapter | unit | `pnpm vitest run tests/unit/auth-config.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | AUTH-07 | T-5-03 | `callbacks.session` returns null when users.is_banned = true (DB-strategy path) | integration | `pnpm vitest run tests/integration/ban-enforcement.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | AUTH-08 | — | session.user exposes {id, email, name, image, role}; NOT is_banned | unit | `pnpm vitest run tests/unit/session-payload.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | AUTH-02 | T-5-04 | GitHub OAuth provider registered with correct scopes; profile→users mapping mirrors image to avatar_url | unit | `pnpm vitest run tests/unit/provider-github.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | AUTH-03 | T-5-05 | Resend provider registered with Chinese email template + RESEND_FROM env | unit | `pnpm vitest run tests/unit/provider-resend.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | AUTH-04 | — | Google OAuth provider registered; profile→users mapping includes image + avatar_url mirror | unit | `pnpm vitest run tests/unit/provider-google.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 3 | AUTH-05 | T-5-06 | LoginPromptModal renders GitHub + Email + Google buttons in locked order; anon click dispatches open-login-modal | unit | `pnpm vitest run tests/unit/login-prompt-modal.test.tsx` | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 3 | AUTH-05 | — | Magic link submit shows inline "检查邮箱" success state; form calls signIn('resend') with redirect:false | unit | `pnpm vitest run tests/unit/login-prompt-modal-magic-link.test.tsx` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 3 | AUTH-06 | T-5-07 | UserChip anonymous branch unchanged; authenticated branch renders avatar/monogram + name + sign-out trigger | unit | `pnpm vitest run tests/unit/user-chip.test.tsx` | ❌ W0 | ⬜ pending |
| 5-05-02 | 05 | 3 | AUTH-06 | — | UserChip sign-out menu calls signOut() server action | unit | `pnpm vitest run tests/unit/user-chip-signout.test.tsx` | ❌ W0 | ⬜ pending |
| 5-06-01 | 06 | 3 | FAV-01, FAV-02 | T-5-08 | favorite server action toggles favorites row; rejects when is_banned | integration | `pnpm vitest run tests/integration/server-action-favorite.test.ts` | ❌ W0 | ⬜ pending |
| 5-06-02 | 06 | 3 | VOTE-01, VOTE-02 | T-5-09 | vote server action enforces exclusive toggle (+1/-1/delete); rejects when is_banned | integration | `pnpm vitest run tests/integration/server-action-vote.test.ts` | ❌ W0 | ⬜ pending |
| 5-06-03 | 06 | 3 | AUTH-07 | — | unauthenticated server-action calls return error (not throw); re-asserts !is_banned | integration | `pnpm vitest run tests/integration/server-action-auth-guard.test.ts` | ❌ W0 | ⬜ pending |
| 5-07-01 | 07 | 4 | FAV-02, VOTE-02 | — | FeedCardActions wraps clicks in useOptimistic + useTransition; rolls back on failure | unit | `pnpm vitest run tests/unit/feed-card-actions.test.tsx` | ❌ W0 | ⬜ pending |
| 5-07-02 | 07 | 4 | VOTE-03 | — | FeedCard surfaces Chinese honest copy containing "个性化" and "即将" near like/dislike | unit | `pnpm vitest run tests/unit/vote-honest-copy.test.tsx` | ❌ W0 | ⬜ pending |
| 5-07-03 | 07 | 4 | VOTE-04 | — | vote value clamped to {-1, +1}; server rejects other values | unit | `pnpm vitest run tests/unit/vote-value-contract.test.ts` | ❌ W0 | ⬜ pending |
| 5-08-01 | 08 | 4 | FAV-03 | T-5-10 | /favorites page redirects anonymous to / (or renders login CTA); authenticated query is user-scoped, reverse-chrono, filters status='published' | integration | `pnpm vitest run tests/integration/favorites-page.test.tsx` | ❌ W0 | ⬜ pending |
| 5-09-01 | 09 | 5 | AUTH-01, AUTH-02 | T-5-11 | E2E: GitHub OAuth sign-in completes on localhost preview-proxy simulation | e2e | `pnpm playwright test e2e/auth-github.spec.ts` | ❌ W0 | ⬜ pending |
| 5-09-02 | 09 | 5 | AUTH-03 | T-5-12 | E2E: magic-link flow issues token, redirect verifies, session persists across reload | e2e | `pnpm playwright test e2e/auth-magic-link.spec.ts` | ❌ W0 | ⬜ pending |
| 5-09-03 | 09 | 5 | AUTH-05, FAV-01 | — | E2E: anon click 收藏 → modal → GitHub sign-in → modal closes; second click persists favorite | e2e | `pnpm playwright test e2e/anon-login-favorite.spec.ts` | ❌ W0 | ⬜ pending |
| 5-09-04 | 09 | 5 | AUTH-07 | — | E2E: banning a user (SQL update) clears their session on next request | e2e | `pnpm playwright test e2e/ban-enforcement.spec.ts` | ❌ W0 | ⬜ pending |
| 5-10-01 | 10 | 5 | AUTH-08 | — | next.config remotePatterns allowlists github + googleusercontent; .env.example includes all AUTH_*/GITHUB_*/GOOGLE_*/RESEND_* vars | unit | `pnpm vitest run tests/unit/env-remote-patterns.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test` if not present
- [ ] `vitest.config.ts` — jsdom environment, path aliases matching `tsconfig.json`, setup file that loads `@testing-library/jest-dom`
- [ ] `playwright.config.ts` — baseURL `http://localhost:3000`, webServer that runs `pnpm dev`, CI retries = 2
- [ ] `tests/setup.ts` — shared testing-library setup + DB test helper
- [ ] `tests/helpers/db.ts` — helper that opens a Neon branch DB connection (CI) or in-memory pg-mem for unit tests
- [ ] `tests/helpers/auth.ts` — helper that constructs a fake authenticated session + user row
- [ ] Test stub files for every Task ID above (22 files) — red-state assertions so sampling shows real progress

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub OAuth on Vercel preview URL via AUTH_REDIRECT_PROXY_URL | AUTH-01 success-criterion #1 | Requires live GitHub OAuth app + Vercel preview deployment; cannot be simulated in CI without real DNS | Deploy a PR branch preview, click 登录 → GitHub, confirm redirect proxies through production and lands on preview with session |
| Magic link deliverability from mainland-China-accessible mailbox | AUTH-03 success-criterion #2 | Resend deliverability to Chinese MX (QQ/163/Outlook) cannot be asserted from CI | Trigger magic-link from QQ/163 account; confirm email arrives + link signs in |
| Session persists across browser close/reopen | AUTH-03 success-criterion #2 | Requires real browser close/reopen; Playwright storage persistence is not identical | After sign-in, fully close Chromium, reopen, visit site → session still active |
| Google OAuth sign-in from non-CN network | AUTH-04 | GFW-blocked from CN; cannot be asserted from a CN-only CI runner | From a non-CN network, click Google button → verify full round-trip |
| Resend `from` domain DNS verification | AUTH-03 | DNS-level state; manual sanity check on Resend dashboard | Confirm SPF/DKIM pass in Resend dashboard before promotion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (22 test files)
- [ ] No watch-mode flags (`vitest run` not `vitest`; `playwright test` not `--ui`)
- [ ] Feedback latency < 90s for unit quick-run
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
