# Phase 5: Auth + User Interactions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 05-auth-user-interactions
**Areas discussed:** Schema + adapter

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Schema + adapter | Auth.js Drizzle adapter tables, users column reconciliation, session strategy, ban enforcement | ✓ |
| Anonymous→login UX | Modal with real providers vs /login page; action resumption | |
| Vote + favorite semantics | Toggle rules, independence of favorite vs vote | |
| Preview OAuth + rate limits | AUTH_REDIRECT_PROXY_URL; rate limiting now vs Phase 6 | |

**User's choice:** Schema + adapter only. Remaining areas resolved via Claude's Discretion / explicit deferral in CONTEXT.md.

---

## Schema + adapter

### Q1: Adapter table layout

| Option | Description | Selected |
|--------|-------------|----------|
| Standard adapter schema (Recommended) | accounts, sessions, verification_tokens per @auth/drizzle-adapter Postgres defaults | ✓ |
| Custom-named tables | Rename for project naming consistency | |
| Defer sessions table (JWT) | Skip sessions, use JWT strategy — loses DB revocation | |

**User's choice:** Standard adapter schema.
**Notes:** Matches adapter upgrade path; aligns with CLAUDE.md §5 preference for DB sessions.

### Q2: Users column reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Add missing, keep existing (Recommended) | Add emailVerified + image; preserve avatar_url/role/is_banned/last_seen_at | ✓ |
| Rename avatar_url→image | Drop avatar_url, cleaner but touches Phase 4 code | |
| Separate user_profile table | 1:1 FK, cleanest separation but extra join on admin checks | |

**User's choice:** Add missing, keep existing.
**Notes:** Mirror OAuth-sourced avatars from image→avatar_url so Phase 4 components reading avatar_url keep working.

### Q3: Session strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Database sessions (Recommended) | Stored in sessions table; revocable; required for is_banned | ✓ |
| JWT sessions | Stateless, zero DB read per request, cannot revoke without denylist | |

**User's choice:** Database sessions.
**Notes:** Matches CLAUDE.md §5 explicit guidance.

### Q4: is_banned enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Session callback + server action guards (Recommended) | session() callback clears banned session; server actions re-assert !is_banned | ✓ |
| Middleware redirect only | Edge middleware redirects to /banned; skips server-action defense | |
| Session callback only (minimal) | Rely solely on callback; defer deeper enforcement to Phase 6 | |

**User's choice:** Session callback + server action guards.
**Notes:** Two-layer defense; no /banned redirect in Phase 5 — banned users become anonymous.

---

## Claude's Discretion

Areas explicitly left to Claude / planner in CONTEXT.md:
- Anonymous→login action resumption (deferred; user re-clicks after sign-in)
- Dedicated /login page (deferred; modal-only)
- Rate limiting on magic-link / favorite / vote endpoints (Claude's Discretion; defer to Phase 6 recommended)
- Admin role promotion mechanism (out-of-band SQL runbook in v1)
- Exact Chinese copy for email body, sign-in CTAs, VOTE-03 honest-copy
- File layout under src/lib/auth/, src/server/actions/
- Migration delivery — drizzle-kit push vs numbered migration file
- UserChip dropdown implementation (Popover vs native details)

## Deferred Ideas

See CONTEXT.md `<deferred>` section for the full list. Highlights:
- Anonymous→login action resumption
- /banned page
- WeChat OAuth (v2)
- Personalized feed driven by likes/dislikes (v2)
- 2FA / passkeys (v2)
- Session revocation UI / "view active sessions" (v2)
