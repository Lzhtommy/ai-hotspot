# Phase 5: Auth + User Interactions - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire real authentication providers (GitHub OAuth + Resend email magic link + Google OAuth as secondary) into the existing Phase 4 seams, persist favorites and like/dislike votes, and convert `/favorites` from an anonymous empty-state into an authenticated RSC view. Anonymous users who click a gated action continue to see the existing `LoginPromptModal` — this phase fills it with real provider buttons and a working sign-in flow.

**In scope:**
- Auth.js v5 (`next-auth@5`) configured with `@auth/drizzle-adapter`, **database session strategy**
- Adapter tables: `accounts`, `sessions`, `verification_tokens` (standard @auth/drizzle-adapter Postgres schema)
- `users` table extended with `emailVerified` (timestamptz null) and `image` (text); existing `avatar_url`, `role`, `is_banned`, `last_seen_at` preserved
- GitHub OAuth provider (primary visual button)
- Resend email magic link provider (primary; mainland-China-accessible fallback)
- Google OAuth provider (secondary button — not default; GFW-blocked in CN)
- `AUTH_REDIRECT_PROXY_URL` configured for Vercel preview OAuth callbacks
- `AUTH_SECRET` + `AUTH_URL` wired in Vercel env + `.env.example`
- `auth()` RSC helper and `useSession()` client helper usage convention documented
- Sign-out action (any page — triggered from `UserChip` once authenticated)
- `UserChip` (Phase 4 placeholder) swapped to a real authenticated/anonymous branch: anon renders 登录 ghost chip (opens modal); authenticated renders avatar + name + sign-out affordance
- `LoginPromptModal` (Phase 4 D-26 placeholder) extended with real provider buttons (GitHub / Email / Google) and Auth.js v5 server-action sign-in handlers
- `/favorites` route (Phase 4 D-16 placeholder) converted to authenticated RSC: requires session, queries `favorites JOIN items` in reverse-chronological order, renders via existing `FeedCard` components
- Server actions for favorite / unfavorite / like / dislike that write to `favorites` / `votes` tables
- Optimistic UI via React `useOptimistic` (per CLAUDE.md §11) for the three action buttons
- `VOTE-03`: honest copy "个性化推荐即将上线" (or equivalent) surfaced near the like/dislike actions
- `session()` callback enforces `users.is_banned`: returns null for banned sessions, effectively revoking the session on next refresh
- Server action guards: every favorite/vote action re-asserts `!is_banned` defensively (two-layer defense)
- `users.role` field respected — no Phase 5 admin UI, but the column is populated so Phase 6 can gate `/admin` on it

**Out of scope (later phases / deferred):**
- Admin UI, ban management UI, source management UI (Phase 6 — ADMIN-*)
- Personalized feed driven by likes/dislikes (v2 — PERSO-01; this phase only persists the signal + shows honest copy)
- WeChat OAuth (v2 — WECHAT-01; requires Chinese business entity)
- 2FA / passkeys / recovery codes (not in AUTH-01..08)
- Email verification enforcement beyond what magic-link already provides
- Rate limiting on favorite/vote/magic-link endpoints — **deferred to Phase 6 operational hardening** unless planner finds it can't safely ship without it (planner's call, see Claude's Discretion)
- Admin bootstrap UI / seed flow — **deferred**: v1 admin is promoted via a one-off SQL update on the `users` table documented in a runbook; no API surface for role change in Phase 5
- Anonymous→login action resumption (clicking 收藏 anon → login → auto-apply the 收藏) — **deferred**: Phase 5 modal closes on successful sign-in but does not re-fire the pending click. Keeps the flow simple; revisit if UAT surfaces friction.
- A dedicated `/login` or `/signin` page — **deferred**: modal is the sole entry point in Phase 5. Auth.js default `/api/auth/signin` remains available as a fallback for magic-link callback landing but is not themed/featured
- Ban-triggered redirect page (`/banned`) — session callback simply clears the session; user is treated as anonymous and can still read. Phase 6 can add a dedicated "account disabled" surface
- Running migrations for the new columns — the planner decides between drizzle-kit push (dev branch) vs a numbered migration file; both are acceptable given Phase 1 precedent

</domain>

<decisions>
## Implementation Decisions

### Schema + Auth.js adapter
- **D-01:** **Auth.js v5 Drizzle adapter ships the standard Postgres schema.** Add `accounts`, `sessions`, `verification_tokens` tables exactly as `@auth/drizzle-adapter` expects (Postgres variant). Do not rename. Pass the project's `users` table into `DrizzleAdapter({ usersTable: users, accountsTable, sessionsTable, verificationTokensTable })` so Auth.js owns writes to the three adapter tables but co-owns `users` with the project.
- **D-02:** **Users column reconciliation — add missing, preserve existing.** A new migration adds two columns to `users`:
  - `email_verified TIMESTAMPTZ NULL` (Auth.js adapter convention; name `emailVerified` in Drizzle TS schema, `email_verified` in Postgres)
  - `image TEXT NULL` (Auth.js adapter convention for OAuth avatar URL)

  Existing columns stay intact: `id uuid PK default random`, `email text unique not null`, `name text`, `avatar_url text`, `role text default 'user'`, `is_banned boolean default false`, `last_seen_at timestamptz`, `created_at timestamptz default now()`. The adapter's `image` column is the source of truth for OAuth-sourced avatars; `avatar_url` is kept for Phase 4 UI code already reading it, and a lightweight mirror happens at account-link time (see D-04). If keeping both becomes awkward, Phase 6 may deprecate `avatar_url` — not in scope now.
- **D-03:** **Database session strategy** per CLAUDE.md §5. `sessions` table stores one row per active session; Auth.js reads/writes on every authenticated request. Trade-off accepted: small DB hit per session refresh in exchange for server-side revocation (required by `is_banned`).
- **D-04:** **OAuth profile → users column mapping.**
  - GitHub profile: `profile.name → users.name`, `profile.avatar_url → users.image` AND `→ users.avatar_url` (mirror, so Phase 4 code reading `avatar_url` keeps working for OAuth users)
  - Google profile: `profile.name → users.name`, `profile.picture → users.image` AND `→ users.avatar_url`
  - Resend (email magic link): `users.email` is the only populated field at sign-up; `name` and `image`/`avatar_url` remain null; `UserChip` must fall back to an initial-monogram render when `image` is null (reuse `SourceDot`-style monogram primitive at a different size)
  - `email_verified` is set to `now()` on successful magic-link verification and on OAuth confirmation (adapter handles OAuth path automatically)

### Ban enforcement
- **D-05:** **Two-layer ban enforcement.**
  - Layer 1: Auth.js `callbacks.session()` reads `users.is_banned` on every session refresh. If `is_banned === true`, return `null` (or throw) to clear the session. This is the primary mechanism — a banned user effectively becomes anonymous on their next request.
  - Layer 2: every server action that mutates user state (favorite/unfavorite/like/dislike/sign-out) re-fetches `users.is_banned` and rejects the request when banned. Belt-and-suspenders against a short window where an in-flight session is mid-refresh.
  - No `/banned` redirect page in Phase 5 — banned users are treated as anonymous (they can still read the feed).

### Auth providers
- **D-06:** **Three providers, primary ordering: GitHub → Email → Google.** In the `LoginPromptModal`:
  - GitHub OAuth button — primary (accent fill), first
  - Email magic link form (Resend) — primary, immediately below GitHub
  - Google OAuth button — secondary (ghost style), separated by a divider labeled "其他方式"

  Rationale from PROJECT.md: Google is blocked by the GFW for mainland Chinese users; GitHub is reachable via IPv6/cloudflare/DNS workarounds; magic link is the universal fallback for any China-accessible mailbox. VOTE-03-style honest copy is **not** needed in the auth modal — it belongs next to the like/dislike icons only.
- **D-07:** **Resend is the magic-link transport** (per CLAUDE.md §5 / §7). Auth.js v5 `Resend` provider is used directly; no custom SMTP. Chinese email body copy must be written; planner drafts it and the executor wires it via Auth.js email template override. Sender domain: set in env (`RESEND_FROM` or similar — planner confirms the exact env name). Token TTL: Auth.js default (10 minutes) unless planner finds reason to extend.

### Session + callback behavior
- **D-08:** **Session payload exposes `id`, `email`, `name`, `image`, `role`.** The `session` callback augments `session.user` with `role` (read from DB) so server components can branch on admin without an extra query. `is_banned` is NOT surfaced in the session payload — a banned session is cleared, not exposed.
- **D-09:** **`last_seen_at` is touched on sign-in only** (adapter `signIn` event), not on every request. Phase 6 can add a lightweight session-refresh hook if analytics need finer granularity.

### User interactions — favorites + votes
- **D-10:** **Favorite and vote are independent actions.** The design (Phase 4 D-17 step 8) renders three separate icons — star (收藏), check (like = vote +1), x (dislike = vote -1). They do not interact: favoriting does not like; liking does not favorite. This matches the existing DB schema (two tables, separate PKs).
- **D-11:** **`favorites` PK is `(user_id, item_id)` — toggle semantics.** Click 收藏 inserts; click again removes. No history preserved. Server action returns the new state so `useOptimistic` can reconcile.
- **D-12:** **`votes` PK is `(user_id, item_id)` with `value smallint` ∈ {-1, +1} — exclusive toggle.**
  - First click like: insert row `value=+1`
  - Click like again while `value=+1`: delete row (unlike)
  - Click dislike while `value=+1`: update row to `value=-1` (flip, no intermediate neutral state)
  - Symmetric for dislike path
  - **Planner's discretion** on whether to implement as `INSERT ... ON CONFLICT (user_id, item_id) DO UPDATE` with an explicit delete branch when toggling to the same value, or as a 3-state finite machine in a server action. Either is acceptable.
- **D-13:** **Optimistic UI via `useOptimistic`** (CLAUDE.md §11). The three action icons on `FeedCard` are wrapped in a small Client Component (`FeedCardActions` already exists at `src/components/feed/feed-card-actions.tsx`) that:
  - Reads the current user's favorite/vote state for the visible items (passed from the RSC parent as a `Map<itemId, {favorited: boolean, vote: -1|0|1}>`)
  - Uses `useOptimistic` to reflect the click instantly
  - Calls the server action in a transition; rolls back the optimistic state on failure (surface a toast or subtle inline error — planner's call)
- **D-14:** **VOTE-03 honest copy is rendered once per card** (or once per viewport — planner's call). Exact string is planner's discretion but must include "个性化" and "即将" (or equivalent phrasing that signals personalization is a forthcoming feature). Place: inline below the action bar on the detail page, OR as a subtle hover-title on the like/dislike icons on cards, OR both. Copy source of truth lives in `src/components/feed/` constants for easy iteration.

### /favorites page
- **D-15:** **`/favorites` becomes an authenticated RSC page.** Replace the Phase 4 empty-state with:
  - Auth gate: `const session = await auth(); if (!session) redirect('/');` (or render the EmptyState with a 登录 CTA — planner's call; redirect is simpler and cleaner)
  - Query: `favorites JOIN items` where `favorites.user_id = session.user.id` AND `items.status = 'published'`, ordered by `favorites.created_at DESC`
  - Render with the same `<FeedCard>` components as `/` and `/all` — no new card variant needed
  - Pagination: identical pattern to `/all` (nuqs + numbered pages, 50 per page per Phase 4 D-14), or a simpler "load 50 latest" if planner finds pagination overkill for personal favorites
  - `export const dynamic = 'force-dynamic'` — user-specific, cannot be CDN-cached (matches Phase 4 D-16)

### Sign-in UX
- **D-16:** **`LoginPromptModal` becomes the sole sign-in surface in Phase 5.** The existing Client Component at `src/components/feed/login-prompt-modal.tsx` is extended in-place:
  - Real GitHub OAuth button wired via Auth.js `signIn('github')` server action
  - Email input + magic-link submit wired via `signIn('resend', { email, redirect: false })` with inline "检查邮箱" success state
  - Google OAuth button wired via `signIn('google')`, grouped under a divider
  - On successful sign-in: Auth.js returns and the modal closes via the existing `close()`. **Action resumption is NOT implemented** — the user must click 收藏/like again post-login. This is an explicit trade-off for Phase 5 simplicity; see Deferred Ideas.
  - The existing `open-login-modal` custom event stays as the sole open trigger — no changes to the Phase 4 dispatch seams in `feed-card-actions.tsx` or `user-chip.tsx`.
- **D-17:** **Sign-out is triggered from `UserChip`** once authenticated. Clicking the authenticated chip opens a small menu (or Popover) with "退出登录" that calls `signOut()`. Planner chooses Popover vs simple dropdown vs direct click-to-sign-out (explicit confirmation preferred to avoid misclicks).
- **D-18:** **`UserChip` renders three states:**
  - Anonymous: 登录 ghost chip, clicking dispatches `open-login-modal`
  - Authenticated with `image`: 32px rounded avatar + name (truncated at 8 chars / 16 CJK chars) + chevron
  - Authenticated without `image` (magic-link users): initial monogram (reuse `SourceDot`-style primitive, amber background, first CJK char or first Latin letter) + name + chevron
  - In all auth'd cases, a menu/popover reveals 退出登录

### Preview-URL OAuth
- **D-19:** **`AUTH_REDIRECT_PROXY_URL` for Vercel preview OAuth callbacks.** Production URL acts as the OAuth callback proxy per Auth.js v5 convention (https://authjs.dev/concepts/session-strategies#edge-compatibility — the redirect-proxy pattern). One GitHub OAuth app, one Google OAuth app; both register their callback to the production URL; previews redirect through production. Required env:
  - `AUTH_URL` — the canonical site URL
  - `AUTH_REDIRECT_PROXY_URL` — set to production URL on preview deployments only
  - `AUTH_SECRET` — shared across production AND previews so the cross-deployment state cookie verifies
- **D-20:** **Preview magic-link flow works without the proxy** because Resend callbacks are HTTP redirects to the deployment's own URL — no external OAuth provider whitelisting needed. This is a useful safety net if the proxy pattern encounters bugs on a given preview.

### Env vars
- **D-21:** **New/confirmed env vars for Phase 5** (all already listed in `.env.example` as Phase 5 placeholders, per Phase 1 D-07):
  - `AUTH_SECRET` — now required, not placeholder
  - `AUTH_URL` — production canonical URL
  - `AUTH_REDIRECT_PROXY_URL` — preview-only (set via Vercel env scoping)
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `RESEND_API_KEY`
  - `RESEND_FROM` (new — planner confirms exact name; NOT in `.env.example` yet)

  No new Trigger.dev env vars — Phase 5 runs entirely in Next.js land.

### Claude's Discretion
- File layout: planner decides the exact structure under `src/lib/auth/`, `src/server/actions/`, `src/app/api/auth/[...nextauth]/route.ts`
- Whether to ship rate limiting (Upstash `@upstash/ratelimit`) on the magic-link endpoint now or defer to Phase 6 — CLAUDE.md recommends both; planner makes the call based on abuse risk appetite
- Exact Chinese copy for the magic-link email body, sign-in modal CTAs, sign-out confirmation, VOTE-03 honest copy
- Whether to migrate via `drizzle-kit push` (dev branch) or a numbered migration file — both have Phase 1 precedent
- Whether `useOptimistic` lives in `FeedCardActions` directly or in a new hook under `src/components/feed/use-item-interaction.ts`
- Whether `UserChip` dropdown is a Radix Popover, a native `<details>`, or a custom Click-away component
- Whether `/favorites` uses a redirect-when-unauthenticated or an empty-state-with-login-CTA
- Whether to add a `loading.tsx` for `/favorites` or rely on the existing `(reader)/loading.tsx`
- Whether admin role promotion is captured in a `docs/auth-admin-bootstrap.md` runbook vs inline in `docs/database.md`

### Folded Todos
None — no pending todos matched this phase (per init check).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project truth
- `.planning/REQUIREMENTS.md` §Authentication (AUTH-01..08), §User Interactions (FAV-01..03, VOTE-01..04) — the 15 requirements this phase must satisfy
- `.planning/ROADMAP.md` "Phase 5: Auth + User Interactions" — goal + 5 success criteria (GitHub OAuth on prod + preview; magic link from CN-accessible email; anon sign-in modal; /favorites reverse-chrono; like/dislike with honest copy)
- `.planning/PROJECT.md` — Constraints (Chinese-only UI, PIPL-aware data handling) + Key Decisions (GFW-aware provider selection)
- `.planning/STATE.md` §Decisions — decisions affecting current work (GitHub OAuth + Resend magic link primary per roadmap; Auth.js tables deferred from Phase 1 D-09)
- `CLAUDE.md` §5 Auth: Auth.js v5 + `@auth/drizzle-adapter`, DB sessions (revocable), magic link rationale (universal fallback), Google/GitHub/Resend provider set, `AUTH_REDIRECT_PROXY_URL` for preview OAuth, anti-Clerk rationale (PIPL / US PII hosting)
- `CLAUDE.md` §11 State Management: `useOptimistic` for like/favorite, no Redux/Zustand — binding for the action bar interactions
- `CLAUDE.md` §12 Image handling: OAuth provider avatar URLs via `next/image` with `remotePatterns` — required when rendering `users.image` from GitHub/Google

### Prior phase artifacts (locked decisions Phase 5 depends on)
- `.planning/phases/04-feed-ui/04-CONTEXT.md` §D-26 — `LoginPromptModal` exists as stub at `src/components/feed/login-prompt-modal.tsx`; Phase 5 extends in place
- `.planning/phases/04-feed-ui/04-CONTEXT.md` §D-27 — favorite/like/dislike persistence, `useOptimistic` pattern deferred to Phase 5
- `.planning/phases/04-feed-ui/04-CONTEXT.md` §D-16 — `/favorites` route exists as EmptyState; Phase 5 replaces the body
- `.planning/phases/04-feed-ui/04-CONTEXT.md` §D-12, §D-18 (UserChip) — user chip shows 登录 when anon; Phase 5 flips to authenticated state
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` §D-09 — Auth.js tables explicitly deferred to Phase 5; 11-table v1 schema does NOT include adapter tables yet
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` §D-07 — `.env.example` Phase 5 placeholders already present: AUTH_SECRET, AUTH_URL, GITHUB_*, GOOGLE_*, RESEND_API_KEY

### Existing code Phase 5 extends
- `src/lib/db/schema.ts` — `users` table (extend with `emailVerified`, `image`); `favorites`, `votes` tables (use as-is); add `accounts`, `sessions`, `verification_tokens`
- `src/lib/db/client.ts` — Drizzle+Neon HTTP singleton. Auth.js adapter consumes this
- `src/components/feed/login-prompt-modal.tsx` — extend in place per D-16
- `src/components/feed/feed-card-actions.tsx` — wire real server actions; add `useOptimistic`
- `src/components/layout/user-chip.tsx` — wire authenticated state branch per D-18
- `src/app/(reader)/favorites/page.tsx` — replace empty-state body per D-15
- `.env.example` — confirm all AUTH_* / GITHUB_* / GOOGLE_* / RESEND_* vars promoted from placeholder; add `RESEND_FROM` + `AUTH_REDIRECT_PROXY_URL`
- `next.config.js` (or `.ts`) — add `images.remotePatterns` for `github.com`/`avatars.githubusercontent.com` and `lh3.googleusercontent.com` if not already present

### External docs (planner fetches via Context7 / WebFetch at research time)
- Auth.js v5 (next-auth@5) App Router setup — https://authjs.dev/getting-started/installation?framework=next.js (HIGH confidence)
- `@auth/drizzle-adapter` Postgres schema — https://authjs.dev/getting-started/adapters/drizzle (HIGH confidence — official)
- Auth.js `AUTH_REDIRECT_PROXY_URL` for Vercel previews — https://authjs.dev/guides/pages/signin-page-for-multiple-providers / https://authjs.dev/reference/nextjs#auth (v5 preview-auth guide)
- Resend provider for Auth.js — https://authjs.dev/getting-started/providers/resend
- GitHub OAuth provider — https://authjs.dev/getting-started/providers/github
- Google OAuth provider — https://authjs.dev/getting-started/providers/google
- Session callback + `is_banned` pattern — Auth.js v5 `callbacks.session` + JWT/session strategy docs
- React `useOptimistic` — https://react.dev/reference/react/useOptimistic (CLAUDE.md-sanctioned pattern)
- Drizzle migrations workflow — https://orm.drizzle.team/docs/migrations (planner already familiar from phases 1-3)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/db/schema.ts`** — `users`, `favorites`, `votes` already exist with the correct shape. Phase 5 only adds adapter tables + two columns on `users`.
- **`src/lib/db/client.ts`** — Drizzle + Neon HTTP singleton. `DrizzleAdapter(db, { ... })` consumes this directly. No new DB infra.
- **`src/components/feed/login-prompt-modal.tsx`** — Phase 4 stub with correct a11y (native `<dialog>` focus trap + Escape), native backdrop click-to-close, Chinese copy "登录以继续" / "登录后才可以收藏、点赞或屏蔽动态。" / "稍后再说" / "登录". Extends cleanly — the 登录 `<Button variant="accent">` becomes a form surrounding GitHub/Email/Google.
- **`src/components/feed/feed-card-actions.tsx`** — Client Component dispatching `open-login-modal` event today. Replace the three `onClick={openLoginModal}` handlers with server-action calls wrapped in `useOptimistic`. The external-link IconButton stays as-is.
- **`src/components/layout/user-chip.tsx`** — Phase 4 stub that currently renders a single 登录 chip. Extend with an authenticated branch.
- **`src/app/(reader)/favorites/page.tsx`** — Phase 4 empty-state route. Replace body with authenticated query.
- **`src/app/(reader)/layout.tsx`** — hosts the `<LoginPromptModal />` (single instance, per Phase 4 wiring). No structural change; may need an auth context provider for `useSession()` if planner chooses hooks-based client auth reads.

### Established Patterns
- **Core-logic / adapter split** (Phase 2 pattern, reinforced in Phase 4 D-28): pure modules under `src/lib/*/` with injected deps; Next.js pages/actions are thin. Applies here — `src/lib/auth/config.ts` exports the Auth.js config; `src/lib/user-actions/` exports pure functions consumed by server actions.
- **RSC-first** (Phase 4 D-29): server actions + `auth()` helper for RSC; `useSession()` only when a client boundary truly needs session state. Most cards can stay RSC; only the three action icons need a client boundary (already present in `FeedCardActions`).
- **Drizzle migration naming:** `drizzle/0000_*` through `drizzle/0003_*` exist. Phase 5 adds `0004_auth.sql` (or similar) with the adapter tables + two `users` columns.
- **Env var registration:** every new env var MUST be added to `.env.example` and to the Vercel + Trigger.dev vaults (Phase 1 D-20). Phase 5 only touches Vercel — Trigger.dev has no auth surface.

### Integration Points
- **Auth.js API route:** `src/app/api/auth/[...nextauth]/route.ts` exports `GET`/`POST` from `NextAuth(authConfig).handlers`. This is the only route Phase 5 mounts under `/api/`.
- **Middleware:** Auth.js v5 ships a `middleware.ts` helper. Phase 5 does NOT need route-level auth middleware (feed remains anonymous-readable per AUTH-06); `/favorites` auth-gates at the page level via `auth()` call.
- **RSC read pattern:** `const session = await auth();` replaces the pattern used anywhere a page needs user context. Already the Auth.js v5 convention; planner uses consistently.
- **Redis (Upstash):** Upstash is available from Phase 1 but Phase 5 does NOT require it unless planner opts in for magic-link rate limiting (Claude's Discretion).
- **`next/image` remotePatterns:** once `users.image` renders real OAuth avatars, `next.config` must allowlist the relevant hosts (GitHub, Google). Currently Phase 4 doesn't need this because every avatar is a monogram.
- **Session cookie in preview ↔ production:** `AUTH_SECRET` must be identical across preview + production Vercel env scopes for the proxy redirect to verify state. Different `AUTH_SECRET` on preview silently breaks OAuth.

</code_context>

<specifics>
## Specific Ideas

- **Anonymous action resumption is deliberately excluded.** After the user signs in via the modal, they re-click 收藏/like. This keeps the server action contract simple (no pending-action queue, no intent-persisting cookie, no post-signIn replay middleware). If UAT finds this friction-inducing, a follow-up phase can add it.
- **Magic link is the China safety net.** Even if both OAuth providers are blocked or the user has no GitHub/Google, Resend email delivers. This is the single point of "no user locked out."
- **Role promotion stays out-of-band.** The `users.role` column is populated ('user') by default; an admin is created via a one-off SQL update documented in a runbook. No API endpoint promotes to admin in v1 — reduces attack surface and fits the scale (few admins, infrequent churn).
- **`is_banned` ≠ account deletion.** A banned user's data stays; their session clears; they read the feed anonymously. GDPR-style "right to erasure" is not in v1 scope (REQUIREMENTS.md does not include a deletion requirement).
- **Google button is visually secondary** to match the "Google blocked by GFW" reality. Visible, not default.
- **VOTE-03 honest copy is non-negotiable** — the product's trust signal to users that like/dislike isn't secretly feeding an opaque algorithm yet. Copy is Claude's Discretion but the sentiment is locked.
- **Existing 4-step anonymous-click pipeline stays intact** (click → dispatch event → modal opens → user dismisses). Phase 5 just replaces the dismiss path with "user signs in → modal closes → user can now interact."

</specifics>

<deferred>
## Deferred Ideas

- **Anonymous→login action resumption.** Click 收藏 anon → login → auto-fire the 收藏 server action. Keeps Phase 5 simpler. Revisit if UAT shows drop-off at the "click again post-login" step.
- **Dedicated `/login` page.** Modal is sufficient for v1. A themed `/signin` could improve share-a-sign-in-link UX but isn't required.
- **Rate limiting on favorite/vote/magic-link endpoints.** Planner may pull this in if abuse risk is evaluated high; otherwise Phase 6 operational hardening.
- **Admin bootstrap UI.** First admin promoted via SQL runbook in v1. Phase 6's admin UI can ship a "promote user" action.
- **`/banned` page with account-disabled messaging.** Phase 5 just clears the session silently. Phase 6 or v2 can add a user-facing surface.
- **WeChat OAuth (WECHAT-01).** v2 — requires ICP + Chinese business entity.
- **Personalized feed driven by likes/dislikes (PERSO-01).** v2. Phase 5 only persists the signal and shows the "即将上线" copy.
- **2FA / passkeys.** Out of AUTH-01..08; deferrable to v2.
- **Email verification strictness beyond magic-link.** Auth.js treats a completed magic-link as verified; no separate "verify your email" flow needed.
- **GDPR-style data export / erasure.** Not in REQUIREMENTS.md v1; revisit if scale or jurisdiction requires.
- **Session refresh `last_seen_at` on every request.** Phase 5 only updates on sign-in to avoid DB write amplification. Phase 6 can add an analytics hook.
- **Multi-device session management UI ("view and revoke sessions").** Not in AUTH-01..08; v2 territory.

</deferred>

---

*Phase: 05-auth-user-interactions*
*Context gathered: 2026-04-23*
