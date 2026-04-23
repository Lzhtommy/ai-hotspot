---
phase: 05-auth-user-interactions
plan: 10
subsystem: docs
tags: [runbook, auth, oauth, vercel, resend, deployment, phase-5-deliverable]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 Task 3 — .env.example rows for AUTH_SECRET / AUTH_URL / AUTH_REDIRECT_PROXY_URL / GITHUB_* / GOOGLE_* / RESEND_API_KEY / RESEND_FROM
  - phase: 05-auth-user-interactions
    provides: Plan 05-03 Task 3 — next.config.ts images.remotePatterns allowlist for GitHub + Google avatar CDNs
  - phase: 05-auth-user-interactions
    provides: Plan 05-01 users.role + users.is_banned columns that the admin-promotion / ban-enforcement SQL operates on
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 session callback D-05 Layer 1 (is_banned → null session), referenced by §7 Ban Enforcement
provides:
  - docs/auth-providers.md — 8-section operational runbook for Phase 5 auth providers + Vercel env + admin SQL + preview OAuth smoke test
  - Documented closure for AUTH-05 (AUTH_REDIRECT_PROXY_URL operational contract)
  - README Further Reading link so the runbook is discoverable from the repo entry point
affects: [06-admin-ops, deployment, phase-5-UAT]

tech-stack:
  added: []
  patterns:
    - "One-runbook-per-operational-surface: docs/auth-providers.md follows the existing docs/{rsshub,health,ci,vercel,database}.md pattern — status banner, dated, section-numbered, copy-pasteable code fences, failure-mode table. Phase 6 admin + ops runbooks should extend this shape."
    - "Out-of-band admin bootstrap: v1 has no promote/demote API surface (attack-surface minimization per T-5-04). First admin is created via direct SQL UPDATE on users.role after the target user has signed in at least once. Documented as the only supported path until Phase 6 ships an admin dashboard."
    - "Preview OAuth verification via redirect-chain inspection: smoke test §6 traces the address-bar redirects (preview → provider → production → preview) rather than asserting on internal state — lets the deployer catch AUTH_SECRET mismatches / redirect_uri_mismatch / proxy misconfig without reading server logs."

key-files:
  created:
    - docs/auth-providers.md
  modified:
    - README.md

key-decisions:
  - "Ship the runbook in English despite the UI being Chinese-only. The runbook is operator-facing (deployer, not end-user) — matching docs/{rsshub,health,ci,vercel,database}.md which are all English. The only Chinese strings are the quoted UI text in §6 (登录 / 使用 GitHub 登录 / 退出登录 / 发送登录链接 / 链接已发送 / 发送失败) where the copy must match what the tester sees on screen."
  - "Task 3 (blocking human-verify checkpoint) auto-approved under Auto Mode with the live-smoke-test checklist deferred to HUMAN-UAT. Local OAuth / magic-link / ban-enforcement tests require real provider credentials, live email inbox, and browser interaction at localhost — Auto Mode's 'do not take overly destructive actions / do not exfiltrate' constraints plus the absence of wired OAuth apps mean the checklist cannot run autonomously. The runbook itself is complete and the automated grep-gated checks all pass; the experiential verification is preserved as the Phase 5 UAT playbook."
  - "Added a §8 'Final deployment checklist' as explicit phase-close DoD — captures the acceptance criteria from Plan 05-10's success_criteria plus the residual preconditions from Plans 05-02 / 05-03 in one place, so a fresh deployer can tick through a single list instead of walking seven summaries."
  - "No .env.example or next.config.ts edits required — Plan 05-02 Task 3 and Plan 05-03 Task 3 had already landed both. Task 2 downgraded to a verification + README-link step."

patterns-established:
  - "Runbook status banner: `> **Status ({YYYY-MM-DD}):** Phase N — active.` — matches docs/vercel.md style; dated so readers know when last reviewed."
  - "Failure-mode table: runbook §6 closes with a three-column table (Symptom | Root cause | Fix). Faster than paragraph-per-symptom; Phase 6 admin/ops runbooks should follow."

requirements-completed: [AUTH-05]

duration: 3 min
completed: 2026-04-23
---

# Phase 5 Plan 10: Auth Providers Runbook Summary

**Operational hand-off runbook for Phase 5 — GitHub / Google OAuth app setup, Resend domain verification, Vercel env scope matrix with the AUTH_SECRET-byte-identical requirement, admin-role promotion SQL (v1 has no UI), ban-enforcement SQL, and a preview-deployment OAuth smoke test — plus verification sweep over Plan 02/03 env + remotePatterns.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-23T07:19:17Z
- **Completed:** 2026-04-23T07:22:02Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved under Auto Mode)
- **Files created:** 1 (`docs/auth-providers.md`, 198 lines)
- **Files modified:** 1 (`README.md` — one-line addition to Further Reading)

## Accomplishments

- **`docs/auth-providers.md`** — 8-section operational runbook (198 lines) covering:
  1. GitHub OAuth app creation + rotation
  2. Google OAuth app creation + consent-screen setup
  3. Resend domain verification with `onboarding@resend.dev` dev fallback
  4. Vercel env scope matrix with the critical **`AUTH_SECRET` byte-identical across Production + Preview + Development** requirement (RESEARCH §Pitfall 3)
  5. Admin role promotion via direct SQL UPDATE on `users.role` (v1 has no promotion API/UI — attack-surface minimization)
  6. Preview OAuth smoke test with redirect-chain trace and failure-mode table (AUTH_SECRET drift / redirect_uri_mismatch / callback loops / Resend domain issues)
  7. Ban enforcement SQL (`is_banned = true` clears session on next request via Plan 05-02 session callback D-05 Layer 1)
  8. Final deployment DoD checklist consolidating Phase 5 acceptance criteria
- **README Further Reading** — `docs/auth-providers.md` linked alongside rsshub / health / database / ci / vercel so first-time deployers discover the OAuth setup through the standard entry point.
- **Verification sweep:** confirmed Plan 02 Task 3 already wrote all 9 Phase 5 env vars to `.env.example` (AUTH_SECRET, AUTH_URL, AUTH_REDIRECT_PROXY_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, RESEND_FROM) and Plan 03 Task 3 already allowlisted `avatars.githubusercontent.com` + `lh3.googleusercontent.com` in `next.config.ts`. No edits needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/auth-providers.md (6 → 8 sections)** — `a162fcb` (docs)
2. **Task 2: Verify .env.example + next.config.ts + link from README** — `fb8c444` (docs)
3. **Task 3: Human verification — Phase 5 deployment dry-run** — auto-approved under Auto Mode; experiential checklist deferred to HUMAN-UAT (see Deferred Items)

**Plan metadata commit:** will follow this SUMMARY + STATE + ROADMAP update.

## Files Created/Modified

- `docs/auth-providers.md` (created) — 198-line operational runbook for Phase 5 auth providers, Vercel env scoping, admin promotion, and preview OAuth smoke test.
- `README.md` (modified) — added `docs/auth-providers.md` link to the Further Reading section.

## Decisions Made

1. **English runbook despite Chinese-only UI.** The runbook is operator-facing and matches `docs/{rsshub,health,ci,vercel,database}.md`. Only the quoted in-app copy (登录 / 使用 GitHub 登录 / 退出登录 / 发送登录链接 / 链接已发送 / 发送失败) appears in Chinese because it has to match exactly what the smoke tester sees in the UI.
2. **Added sections 7 + 8 beyond the plan template's 6.** Plan spec called for 6 sections but mentioned ban-enforcement in passing and called for a deployment DoD in `success_criteria`. §7 (ban enforcement) was hinted in the template already as a bonus section; §8 (final deployment checklist) promotes success_criteria residuals into a copy-pasteable checklist for fresh deployers.
3. **Task 3 auto-approved under Auto Mode.** The plan's `autonomous: false` flag exists to capture a manual experiential checklist — the runbook itself is complete and automated verification passes. Per `<blocking_checkpoint_handling>` in the prompt, the live-smoke-test steps are documented as deferred HUMAN-UAT rather than blocking the phase close.
4. **Task 2 downgraded to verify + link.** Plan 02 Task 3 and Plan 03 Task 3 already landed `.env.example` and `next.config.ts` respectively; no code changes needed. Only the README link remained to land.

## Deviations from Plan

### Auto-added / reframed content

**1. [Rule 2 — Critical] Added §7 (ban enforcement) + §8 (final deployment checklist)**

- **Found during:** Task 1 (writing the runbook)
- **Issue:** Plan template showed sections 1–6 but the plan's `success_criteria` explicitly requires "Operational hand-off artifact ready for deployment", and the plan's own template preamble already referenced a §7 ban-enforcement section (template lines 192–200). Without §7, the ban-enforcement SQL lives nowhere — the E2E spec in Plan 05-09 runs `is_banned = true` UPDATE directly, but operators have no runbook for doing this in production. §8 gives the deployer a single DoD list rather than scattered preconditions.
- **Fix:** Added §7 Ban Enforcement Operational Notes (promote / unban / audit SQL) and §8 Final deployment checklist (10-item list consolidating Phase 5 acceptance).
- **Files modified:** docs/auth-providers.md
- **Verification:** `grep "## 7\." docs/auth-providers.md` + `grep "## 8\." docs/auth-providers.md` both present.
- **Committed in:** a162fcb

**2. [Rule 3 — Blocking] prettier reformatted the Vercel env matrix table**

- **Found during:** Task 1 commit (lint-staged hook)
- **Issue:** prettier adjusted column widths in the markdown table and escape-sequence-normalized `\<email\>` inside a bold phrase. Not a correctness issue — purely cosmetic reflow.
- **Fix:** Accepted the prettier output via lint-staged auto-apply; content is semantically identical.
- **Files modified:** docs/auth-providers.md (via lint-staged)
- **Verification:** all 5 automated grep checks from the plan's `<verify>` block still pass after the reformat.
- **Committed in:** a162fcb (single commit includes the reformat)

---

**Total deviations:** 2 (1 Rule 2 content extension, 1 Rule 3 lint-staged auto-format)
**Impact on plan:** No scope creep — both additions are within the plan's stated success_criteria scope. §7/§8 close gaps the plan template's prose flagged but didn't enumerate in the numbered section list.

## Issues Encountered

None.

## User Setup Required

**External services require final operator configuration — see `docs/auth-providers.md` for the runbook.** In summary:

- GitHub OAuth app (github.com/settings/developers) — callback `https://{production}/api/auth/callback/github`
- Google OAuth client (console.cloud.google.com → Credentials) — redirect URI `https://{production}/api/auth/callback/google`
- Resend domain verification (resend.com/domains) — SPF + DKIM records green
- Vercel env — 9 vars in Production + Preview + Development; `AUTH_SECRET` identical across all three; `AUTH_REDIRECT_PROXY_URL` Preview only

## Deferred Items

| Item                                             | Why deferred                                                                                                   | Re-verify when                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Task 3 live local GitHub OAuth smoke test        | Requires real GitHub OAuth app credentials in `.env.local` + browser interaction — not autonomous              | First real local dev session after user provisions GitHub OAuth app                                   |
| Task 3 live local magic-link smoke test          | Requires `RESEND_API_KEY` + an email inbox — not autonomous                                                    | First local dev session after Resend provisioning per runbook §3                                      |
| Task 3 live favorites + vote + sign-out UI smoke | Requires authenticated local session — depends on the two above                                                | After OAuth is live locally, run the four-step checklist in Plan 05-10 Task 3 `how-to-verify`         |
| Task 3 ban-enforcement smoke via Neon dev branch | Requires a live seeded user + live session + `psql` against Neon dev branch — not autonomous                   | After the OAuth smoke passes, run the `UPDATE users SET is_banned = true` step and reload             |
| Preview OAuth smoke test (runbook §6)            | Requires a deployed Vercel preview with full env vars — runbook ships the procedure, not the execution         | First PR preview after all 9 env vars are live in Vercel Preview scope                                |

These items are Phase 5 UAT concerns — the runbook that guides them IS Plan 05-10's deliverable. The experiential verification runs in the deployment session, not in the planning/execution session.

## Threat Flags

None new. This plan is pure documentation; it does not introduce any new network endpoint, auth path, or trust boundary. The runbook documents existing Phase 5 surfaces (already threat-modeled in Plans 05-02 / 05-03 / 05-06) and explicitly reinforces the T-5-04 "no admin-promotion UI" disposition by codifying the out-of-band SQL as the only supported path.

## Self-Check: PASSED

- `docs/auth-providers.md` — FOUND (198 lines, all 8 sections grep-verified: §1 GitHub OAuth, §2 Google OAuth, §3 Resend, §4 Vercel env matrix, §5 Admin promotion, §6 Preview smoke test, §7 Ban enforcement, §8 Final checklist)
- `README.md` contains `auth-providers.md` — FOUND
- `.env.example` contains all 9 Phase 5 env vars — FOUND (AUTH_SECRET, AUTH_URL, AUTH_REDIRECT_PROXY_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, RESEND_FROM)
- `next.config.ts` contains `avatars.githubusercontent.com` + `lh3.googleusercontent.com` — FOUND
- Commit `a162fcb` (Task 1 — runbook) — FOUND via `git log --oneline`
- Commit `fb8c444` (Task 2 — README link) — FOUND via `git log --oneline`

## Next Phase Readiness

Phase 5 (auth-user-interactions) is **functionally complete** and ready for HUMAN-UAT + production deployment.

Phase 6 (admin + ops hardening) inherits:

- The `users.role = 'admin'` convention documented in §5 — Phase 6's admin dashboard replaces the SQL runbook with an in-app promote/demote action.
- The `users.is_banned` session-invalidation pattern documented in §7 — Phase 6 wraps the SQL in an admin "ban user" button.
- The Vercel env matrix in §4 as the template shape for Phase 6 operational env additions (Langfuse, Sentry, etc.).
- The runbook style (status banner, numbered sections, failure-mode table) as the canonical shape for future operational docs.

No blockers. Phase 5 plan counter advances to 11/11 → Phase 5 is the final plan of this phase; state marks phase complete.

---

_Phase: 05-auth-user-interactions_
_Completed: 2026-04-23_
