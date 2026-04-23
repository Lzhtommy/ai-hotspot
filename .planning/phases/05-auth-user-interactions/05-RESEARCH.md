# Phase 5: Auth + User Interactions - Research

**Researched:** 2026-04-23
**Domain:** Authentication (Auth.js v5 + Drizzle adapter + Resend magic-link + OAuth) + optimistic user interactions
**Confidence:** HIGH on adapter schema + session strategy + redirect proxy; MEDIUM on React `useOptimistic` runtime availability under React 18.3.1 (Next.js 15 App Router ships a canary React that exposes it — see Pitfall 1)

## Summary

Phase 5 wires three auth providers (GitHub OAuth, Resend magic link, Google OAuth) into Auth.js v5 with **database session strategy** via `@auth/drizzle-adapter` against the existing Neon Postgres `users` table, then persists user favorites/votes and swaps Phase 4 placeholder components to authenticated states. The bulk of the plan-shaping decisions are already locked in CONTEXT.md D-01..D-21; this research verifies the exact adapter API contracts, preview-URL OAuth proxy mechanics, Resend email template override path, `useOptimistic` availability under the project's React 18.3.1 pin, and proposes the Nyquist validation architecture.

**Three non-obvious risks surfaced:**

1. **`useOptimistic` under React 18.3.1 is a Next.js canary feature, not a React 18 feature.** Runtime works (Next 15 App Router client bundle uses a canary React build), but TypeScript + ESM imports need care. See Pitfall 1.
2. **`users.id` is `uuid default random` today** — the Auth.js default schema uses `text` with `crypto.randomUUID()`. Adapter supports uuid via typed override, but `accounts.userId` and `sessions.userId` FK columns MUST also be declared `uuid` (not `text`). A plain copy-paste of the doc's default schema will fail with a type mismatch on the FK.
3. **`AUTH_SECRET` mismatch between Vercel preview and production silently breaks preview OAuth.** Proxy cookie verification uses HMAC over the shared secret; previews with a different secret produce state-cookie verification failures that surface only as OAuth-callback errors — no loud log line names the secret mismatch.

**Primary recommendation:** Plan a single migration file `drizzle/0004_auth.sql` (hand-authored, mirroring the Phase 3 precedent in `0003_hnsw_index_and_settings_seed.sql`) that adds three new tables + two columns, followed by a `src/lib/auth/` module defining providers + adapter + callbacks + a `sendVerificationRequest` Resend override for Chinese copy, then thin server-action modules for favorites/votes consumed by an extended `FeedCardActions` client component.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema + Auth.js adapter**
- **D-01:** Auth.js v5 Drizzle adapter ships the standard Postgres schema. Add `accounts`, `sessions`, `verification_tokens` tables exactly as `@auth/drizzle-adapter` expects. Do not rename. Pass the project's `users` table into `DrizzleAdapter({ usersTable: users, accountsTable, sessionsTable, verificationTokensTable })`.
- **D-02:** Users column reconciliation — add missing, preserve existing. New migration adds `email_verified TIMESTAMPTZ NULL` and `image TEXT NULL` to `users`. Existing columns stay intact: id uuid PK default random, email text unique not null, name, avatar_url, role, is_banned, last_seen_at, created_at.
- **D-03:** Database session strategy (not JWT) — `sessions` table stores one row per active session.
- **D-04:** OAuth profile → users column mapping. GitHub `profile.avatar_url → users.image` AND `→ users.avatar_url` (mirror for Phase 4 compat). Google `profile.picture → users.image` AND `→ users.avatar_url`. Resend users get email only; UserChip falls back to monogram.

**Ban enforcement**
- **D-05:** Two-layer ban enforcement. Layer 1: `callbacks.session()` reads `users.is_banned` and returns null if banned. Layer 2: every mutating server action re-fetches `is_banned` defensively.

**Auth providers**
- **D-06:** Three providers, primary ordering GitHub → Email → Google. Modal renders accent GitHub button, accent Resend form, secondary Google button under "其他方式" divider.
- **D-07:** Resend for magic link. Chinese email body drafted by planner, executor wires via Auth.js email template override. Token TTL: Auth.js default (10 minutes).

**Session behavior**
- **D-08:** Session payload exposes `id, email, name, image, role`. `is_banned` NOT in payload.
- **D-09:** `last_seen_at` touched on `signIn` event only.

**User interactions**
- **D-10:** Favorite and vote are independent actions.
- **D-11:** `favorites` PK `(user_id, item_id)` — toggle semantics. Server action returns new state.
- **D-12:** `votes` PK `(user_id, item_id)` with `value smallint ∈ {-1, +1}` — exclusive toggle. Planner's discretion: INSERT..ON CONFLICT vs 3-state server action.
- **D-13:** `useOptimistic` per CLAUDE.md §11. `FeedCardActions` reads current state from RSC parent as `Map<itemId, {favorited, vote}>` and reconciles on server response.
- **D-14:** VOTE-03 honest copy must include "个性化" and "即将". Exact string = planner's discretion. Placement: inline below action bar.

**/favorites**
- **D-15:** `/favorites` = authenticated RSC. Redirect OR empty-state-with-login-CTA (planner's call; redirect simpler). Query favorites JOIN items where status='published', ORDER BY favorites.created_at DESC. Render with existing FeedCard. `export const dynamic = 'force-dynamic'`.

**Sign-in UX**
- **D-16:** LoginPromptModal is sole sign-in surface. Extend in place. No action resumption — user re-clicks post-login. Existing `open-login-modal` custom event stays.
- **D-17:** Sign-out triggered from UserChip once authenticated. Popover or dropdown; no "are you sure?" modal (two-click open-chip→click-menu-item provides friction).
- **D-18:** UserChip renders three states: anonymous 登录 chip / authenticated with image / authenticated without image (monogram).

**Preview-URL OAuth**
- **D-19:** `AUTH_REDIRECT_PROXY_URL` for Vercel preview OAuth callbacks. Required env: `AUTH_URL` (canonical), `AUTH_REDIRECT_PROXY_URL` (preview-only), `AUTH_SECRET` (shared across prod+preview).
- **D-20:** Preview magic-link flow works without the proxy (Resend redirects to deployment's own URL).

**Env vars**
- **D-21:** New/confirmed env vars: `AUTH_SECRET`, `AUTH_URL`, `AUTH_REDIRECT_PROXY_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, and new `RESEND_FROM`.

### Claude's Discretion

- Exact file layout under `src/lib/auth/`, `src/server/actions/`, `src/app/api/auth/[...nextauth]/route.ts`
- Rate limiting on magic-link endpoint (now vs Phase 6) — abuse risk assessment
- Chinese copy for magic-link email body, sign-in CTAs, sign-out confirmation, VOTE-03
- `drizzle-kit push` vs numbered migration file (both have Phase 1-3 precedent)
- `useOptimistic` direct in component vs new `use-item-interaction.ts` hook
- UserChip dropdown primitive (Radix Popover vs native `<details>` vs custom click-away)
- `/favorites` redirect vs empty-state-with-login-CTA
- INSERT..ON CONFLICT vs 3-state server action for votes toggle
- `loading.tsx` for `/favorites` vs rely on existing `(reader)/loading.tsx`
- Admin promotion documented in `docs/auth-admin-bootstrap.md` vs inline in `docs/database.md`

### Deferred Ideas (OUT OF SCOPE)

- Anonymous→login action resumption (re-fire pending click post-signIn)
- Dedicated `/login` or `/signin` page (modal is sole surface)
- Rate limiting on favorite/vote/magic-link endpoints (Phase 6 unless planner pulls in)
- Admin bootstrap UI (v1 admin promoted via one-off SQL)
- `/banned` account-disabled surface (Phase 5 just clears session)
- WeChat OAuth (v2 — requires ICP)
- Personalized feed driven by likes/dislikes (v2 — PERSO-01; Phase 5 persists signal + honest copy only)
- 2FA / passkeys / recovery codes
- Email verification enforcement beyond magic-link
- Session-refresh `last_seen_at` amplification (Phase 6 analytics hook if needed)
- GDPR-style data export/erasure
- Multi-device session management UI

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Auth.js v5 configured with Drizzle adapter | Standard Stack §Auth.js + §Drizzle adapter; Architecture §Pattern 1; Migration §0004_auth.sql |
| AUTH-02 | GitHub OAuth works on prod AND preview URLs | Standard Stack §GitHub provider; Architecture §Pattern 3 (AUTH_REDIRECT_PROXY_URL); Pitfall 3 (AUTH_SECRET mismatch) |
| AUTH-03 | Email magic link via Resend works from CN-accessible email | Standard Stack §Resend; Architecture §Pattern 2 (sendVerificationRequest override for Chinese copy) |
| AUTH-04 | Google OAuth available as secondary | Standard Stack §Google provider; UI-SPEC D-06 (visually secondary) |
| AUTH-05 | AUTH_REDIRECT_PROXY_URL configured for Vercel preview OAuth | Architecture §Pattern 3; Pitfall 3 |
| AUTH-06 | Anonymous read works for all feed pages; no login wall | Architecture §Pattern 4 (no middleware; page-level auth() only on /favorites) |
| AUTH-07 | Sessions persist across browser refresh | Standard Stack §Auth.js database session strategy (cookie + sessions table) |
| AUTH-08 | Sign out works from any page | Standard Stack §Auth.js `signOut()`; UI-SPEC §UserChip D-17 |
| FAV-01 | Favorite item; UI reflects immediately | Architecture §Pattern 5 (useOptimistic + server action); Don't Hand-Roll §optimistic-state |
| FAV-02 | Unfavorite item | Same as FAV-01; toggle in one server action |
| FAV-03 | `/favorites` reverse-chrono | Architecture §Pattern 6 (authenticated RSC with redirect); query pattern sketched below |
| VOTE-01 | Like an item | Architecture §Pattern 5; D-12 exclusive toggle |
| VOTE-02 | Dislike an item | Same; D-12 flip semantics |
| VOTE-03 | Honest personalization-forthcoming copy | UI-SPEC binding — copy must include "个性化" and "即将" |
| VOTE-04 | Anonymous interaction prompts sign-in modal | Existing Phase 4 seam: `open-login-modal` CustomEvent; FeedCardActions gates auth client-side |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth authorization flow | API / Backend | — | OAuth code exchange + token storage happen in `/api/auth/[...nextauth]/route.ts`. Browser only redirects. |
| Session validation / auth() | Frontend Server (SSR) | Database | `auth()` called in RSC reads cookie + queries sessions/users row. Every /favorites page render + every server action call. |
| Sign-in button UI | Browser / Client | Frontend Server (SSR) | Button lives in `LoginPromptModal` (client). Clicking invokes server action that runs signIn() on SSR side. |
| Magic-link email dispatch | API / Backend | External SaaS (Resend) | `sendVerificationRequest` runs server-side on signIn('resend'). Calls Resend HTTP API. |
| Session cookie | Browser / Client | API / Backend | Cookie stored in browser; issued by API route on sign-in; consumed on every SSR auth() call. |
| Favorite/vote mutation | API / Backend | Database | Server action writes to Postgres. RSC reads on next request. |
| Optimistic UI state | Browser / Client | — | `useOptimistic` lives in FeedCardActions client boundary. Zero server involvement until action dispatches. |
| Ban enforcement (session clear) | Frontend Server (SSR) | Database | Session callback runs on every auth() call; reads users.is_banned; returns null to clear. |
| Ban enforcement (action guard) | API / Backend | Database | Each server action re-fetches is_banned before mutating. |
| UserChip render state | Frontend Server (SSR) | Browser / Client | RSC fetches session, passes as prop; client boundary just renders and handles open/close. |
| OAuth avatar image | CDN / Static | Browser / Client | Image served by OAuth provider's CDN via `next/image`; `remotePatterns` allowlist required. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-auth` | `5.0.0-beta.31` (current, 2026-04-23) | Auth.js v5 — providers, signIn/signOut/auth exports, /api/auth handlers | [VERIFIED: `npm view next-auth versions`] Canonical auth solution for Next.js; v5 is the App Router-native line. v4 is Pages-Router era. Beta is production-used at scale. |
| `@auth/drizzle-adapter` | `1.11.2` (current, 2026-04-23) | Persists sessions/accounts/users in Drizzle Postgres | [VERIFIED: `npm view @auth/drizzle-adapter version`] Official adapter maintained by Auth.js team; accepts custom schema with uuid/extra columns. |
| `resend` | `6.12.2` (current, 2026-04-23) | Transactional email for magic-link delivery | [VERIFIED: `npm view resend version`] Official Resend SDK. Auth.js v5 has a built-in `Resend` provider that wraps the HTTP API — direct SDK dependency optional; planner can use `fetch` inside `sendVerificationRequest` per Auth.js docs. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/redis` + `@upstash/ratelimit` | already installed (`^1.37.0`) | Rate limit magic-link endpoint | Planner's call (CONTEXT Claude's Discretion) — pull in if abuse risk is evaluated high, else defer to Phase 6. |
| `react` (canary bundled by Next 15) | bundled | `useOptimistic` hook | Client boundary in FeedCardActions. NOTE: project has `react@18.3.1` pinned, but Next 15 App Router ships a canary React bundle for client components that exposes `useOptimistic`. See Pitfall 1. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@auth/drizzle-adapter` | Hand-rolled SQL adapter | Loses adapter updates (new provider columns, security patches). Adapter is the documented path; hand-rolling invites drift. |
| Resend built-in provider | Custom SMTP via nodemailer | Nodemailer needs SMTP creds + server configuration; Resend is HTTP-only, already chosen per CLAUDE.md §5. |
| `next-auth/react` client `signIn` | Server-action `signIn` | Server action preferred in App Router — works without JS on edge cases, integrates with RSC. Client `signIn` is legacy. |
| Database session strategy | JWT strategy | Locked by D-03. JWT would be faster per request but cannot be revoked server-side on ban. DB read per session is ~1ms on Neon — acceptable trade for revocability. |

**Installation:**

```bash
pnpm add next-auth@beta @auth/drizzle-adapter
# Resend provider included in next-auth; direct `resend` SDK optional
```

**Version verification (performed 2026-04-23):**
- `next-auth` latest tag: `5.0.0-beta.31` (published after 2025-09 Better Auth team takeover announcement). [VERIFIED: npm registry]
- `@auth/drizzle-adapter` latest: `1.11.2`. [VERIFIED: npm registry]
- No v5 GA release; `beta.31` is what the Auth.js docs' "Getting Started" page ships.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │  Browser (anonymous or authenticated)│
                    └──┬────────────────────────┬──────────┘
                       │                        │
             CustomEvent 'open-login-modal'     │ navigation + cookie
                       │                        │
              ┌────────▼────────┐    ┌──────────▼──────────────┐
              │ LoginPromptModal│    │  RSC page render         │
              │ (client)        │    │  - (reader)/layout.tsx   │
              └────────┬────────┘    │  - /favorites (auth gate)│
                       │             │  - /all / /             │
             form action=server      │  - UserChip (session)    │
                       │             └──────────┬──────────────┘
                       │                        │
                       │                        ▼
                       │              ┌─────────────────────┐
                       │              │  auth() server call  │
                       │              │  → reads cookie      │
                       │              │  → DB session lookup │
                       │              │  → users.is_banned?  │
                       │              │  → session callback  │
                       │              └──────┬───────────────┘
                       │                     │
                       ▼                     │
          ┌─────────────────────────┐        │
          │ signIn('github' |       │        │
          │        'resend' |       │        │
          │        'google')        │        │
          │ (server action)         │        │
          └──┬──────────────────┬───┘        │
             │                  │            │
     OAuth   │                  │  Resend    │
  redirect   │                  │ HTTP POST  │
             ▼                  ▼            │
  ┌──────────────────┐  ┌────────────────┐   │
  │ GitHub / Google  │  │ Resend API     │   │
  │ authorization    │  │ (email w/ link)│   │
  └────────┬─────────┘  └────────┬───────┘   │
           │                     │            │
   callback to AUTH_REDIRECT     │            │
   _PROXY_URL (prod) which       │            │
   redirects back to actual      │            │
   deployment URL                │            │
           │                     │            │
           ▼                     ▼            │
  ┌──────────────────────────────────────┐    │
  │  /api/auth/[...nextauth]/route.ts    │    │
  │  NextAuth(authConfig).handlers       │    │
  │  GET + POST                          │    │
  └──────────┬───────────────────────────┘    │
             │                                 │
             ▼                                 │
  ┌──────────────────────────────────────┐    │
  │  Neon Postgres                       │◄───┘
  │  tables: users, accounts, sessions,  │
  │          verification_tokens,        │
  │          favorites, votes            │
  └──────────────────────────────────────┘
             ▲
             │
  ┌──────────┴───────────────────────────┐
  │ Server actions                        │
  │  favoriteItem / unfavoriteItem        │
  │  voteItem(id, value: 1|-1)            │
  │  — guard: requireSession() +          │
  │           !users.is_banned            │
  └──────────┬───────────────────────────┘
             │
     called from
             │
             ▼
  ┌──────────────────────────────────────┐
  │ FeedCardActions (client)              │
  │ useOptimistic + startTransition       │
  └──────────────────────────────────────┘
```

### Component Responsibilities

| Component / File | Tier | Responsibility |
|------------------|------|----------------|
| `src/lib/auth/config.ts` | SSR | Exports `authConfig` object (providers, adapter, callbacks, events). Consumed by route handler + exports. |
| `src/lib/auth/index.ts` | SSR | Re-exports `{ handlers, auth, signIn, signOut }` from `NextAuth(authConfig)`. Single import surface. |
| `src/lib/auth/session.ts` | SSR | `getSession()` / `requireSession()` wrappers. `requireSession()` throws redirect or 401. |
| `src/app/api/auth/[...nextauth]/route.ts` | API | `export const { GET, POST } = handlers`. |
| `src/server/actions/favorites.ts` | SSR action | `favoriteItem(itemId)` + `unfavoriteItem(itemId)`. Returns `{ favorited: boolean }`. Guards session + !is_banned. |
| `src/server/actions/votes.ts` | SSR action | `voteItem(itemId, value: 1 \| -1)`. Returns `{ vote: -1 \| 0 \| 1 }`. Implements D-12 toggle/flip. |
| `src/server/actions/auth.ts` (optional) | SSR action | Thin wrappers around signIn/signOut if the planner wants named server-action exports for the modal form. |
| `src/lib/db/schema.ts` | DB schema | Extend `users` (email_verified, image); add `accounts`, `sessions`, `verification_tokens`. |
| `drizzle/0004_auth.sql` | Migration | Hand-authored SQL mirroring Phase 3 precedent. |
| `src/components/feed/login-prompt-modal.tsx` | Client | Provider buttons + magic-link form. Calls server actions. |
| `src/components/feed/feed-card-actions.tsx` | Client | `useOptimistic` + `startTransition`. Reads initial state as prop. |
| `src/components/layout/user-chip.tsx` | Client | Three-state render; sign-out popover. |
| `src/app/(reader)/favorites/page.tsx` | RSC | Auth gate + query + render FeedCards. |

### Recommended Project Structure

```
src/
├── app/
│   ├── api/auth/[...nextauth]/route.ts   # Auth.js handlers
│   └── (reader)/
│       └── favorites/page.tsx             # Authenticated RSC
├── lib/
│   └── auth/
│       ├── config.ts                      # authConfig
│       ├── index.ts                       # { handlers, auth, signIn, signOut }
│       └── session.ts                     # getSession / requireSession
├── server/
│   └── actions/
│       ├── favorites.ts                   # favoriteItem / unfavoriteItem
│       ├── votes.ts                       # voteItem
│       └── auth.ts (optional)             # named signIn/signOut form actions
└── components/
    └── feed/
        ├── login-prompt-modal.tsx          # Extended in place
        └── feed-card-actions.tsx           # useOptimistic
drizzle/
└── 0004_auth.sql                           # Hand-authored migration
```

### Pattern 1: Auth.js v5 DB-Session Config with Custom Drizzle Users Table

```typescript
// Source: https://authjs.dev/getting-started/adapters/drizzle
// src/lib/auth/config.ts
import NextAuth, { type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'database' }, // D-03
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL, // D-19 (falls back to env var auto-pickup)
  providers: [
    GitHub({
      // D-04: mirror avatar_url on profile; planner decides whether to also do this in events.linkAccount
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          // Note: profile() return is merged into the users INSERT; extra fields
          // like avatarUrl/role must match users schema column names (camelCase) and
          // will be ignored unless the user row is updated explicitly in events.
        };
      },
    }),
    Google({
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.RESEND_FROM!, // e.g. 'AI Hotspot <noreply@yourdomain>'
      sendVerificationRequest: sendChineseMagicLink, // see Pattern 2
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // D-05 Layer 1 — ban check
      if (user.isBanned) {
        // Return null to clear the session. Auth.js v5 treats null as signed-out.
        // Source: https://authjs.dev/guides/extending-the-session
        // Empirically: the next auth() call will return null; cookie remains but is ignored.
        return null as any;
      }
      // D-08 — expose id + role
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.image = user.image ?? user.avatarUrl ?? null;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // D-09 — touch last_seen_at only on sign-in
      if (user.id) {
        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
      }
    },
    async linkAccount({ user, profile }) {
      // D-04 — mirror image to avatar_url so Phase 4 code reading avatar_url keeps working
      const image = (profile as any)?.avatar_url ?? (profile as any)?.picture;
      if (image && user.id) {
        await db.update(users).set({ avatarUrl: image }).where(eq(users.id, user.id));
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

**Why this pattern:**
- `session.strategy: 'database'` makes the `session` callback receive `{ session, user }` (where `user` is the DB row). The JWT callback is NOT used. `user.isBanned` is read directly from the row — no extra query needed in the callback.
- Returning `null` from the session callback clears the session — the cleanest way to enforce ban (confirmed via Auth.js reference docs; behavior parity with JWT callback returning `null`).
- `redirectProxyUrl` explicit assignment is equivalent to the `AUTH_REDIRECT_PROXY_URL` env var auto-pickup — showing it explicitly makes the Phase 5 config self-documenting.

### Pattern 2: Chinese Magic-Link Email via sendVerificationRequest Override

```typescript
// Source: https://authjs.dev/getting-started/providers/resend (verified 2026-04-23)
// src/lib/auth/magic-link-email.ts
export async function sendChineseMagicLink(params: {
  identifier: string; // email
  url: string;         // magic link URL
  provider: { apiKey?: string; from?: string };
  expires: Date;
}) {
  const { identifier, url, provider } = params;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: provider.from,
      to: identifier,
      subject: 'AI Hotspot 登录链接',
      text: [
        '你好，',
        '',
        '请点击以下链接登录 AI Hotspot：',
        '',
        url,
        '',
        '链接 10 分钟内有效。如果你没有申请登录，请忽略此邮件。',
        '',
        'AI Hotspot 团队',
      ].join('\n'),
      html: `<!-- Chinese HTML body per UI-SPEC §Email body -->...`,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Resend send failed: ${res.status} ${err}`);
  }
}
```

**Key points:**
- Auth.js passes `provider.apiKey` + `provider.from` from the `Resend({ apiKey, from })` config — do not re-read env inside the function (testable, consistent).
- Token TTL is controlled by Auth.js, not the email — default 10 minutes (`params.expires` is informational; copy says "链接 10 分钟内有效").
- If you need to extend the TTL, set `providers: [Resend({ maxAge: 3600 })]` — but 10-minute default matches reference designs and is the right value.

### Pattern 3: AUTH_REDIRECT_PROXY_URL for Vercel Preview OAuth

**Mechanic (verified via https://authjs.dev/getting-started/deployment):**
1. One GitHub OAuth app. One Google OAuth app. Each registers its callback URL to the **production URL only** (e.g., `https://aihotspot.com/api/auth/callback/github`).
2. On a preview deploy, the app reads `AUTH_REDIRECT_PROXY_URL=https://aihotspot.com/api/auth` from its env. When Auth.js constructs the OAuth authorize request, it uses that proxy URL as `redirect_uri`.
3. User completes OAuth → provider sends callback to the production URL.
4. Production Auth.js recognizes the call is a proxy forward (distinguished by state-cookie contents signed with `AUTH_SECRET`), decodes the original preview-deployment URL, and **redirects the user back to the preview URL** with a new signed cookie.
5. Preview deployment receives the redirect, reads the cookie (same `AUTH_SECRET` → signature verifies), completes sign-in.

**Env var setup in Vercel:**

| Env | Scope | Value |
|-----|-------|-------|
| `AUTH_SECRET` | Production + Preview + Development | SAME value across all — mandatory |
| `AUTH_URL` | Production | `https://aihotspot.com` |
| `AUTH_URL` | Preview | unset (Vercel auto-injects `VERCEL_URL`; Auth.js v5 reads `VERCEL_URL` as fallback) |
| `AUTH_REDIRECT_PROXY_URL` | Preview only | `https://aihotspot.com/api/auth` |
| `AUTH_REDIRECT_PROXY_URL` | Production | unset |
| `GITHUB_CLIENT_ID` / `SECRET` | All envs | same values (one OAuth app) |
| `GOOGLE_CLIENT_ID` / `SECRET` | All envs | same values (one OAuth app) |

**Pitfall:** Vercel's env UI lets you set different values per environment. If `AUTH_SECRET` ends up different in preview vs production (easy accident when re-generating for a security audit), the state cookie signed by production will fail verification on the preview — OAuth callback returns a generic error with no indication the secret mismatched.

### Pattern 4: RSC Auth Gate on /favorites (Option A: redirect)

```typescript
// src/app/(reader)/favorites/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { favorites, items } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const session = await auth();
  if (!session) redirect('/'); // D-15 option A; option B: render EmptyState with CTA

  const rows = await db
    .select({ /* FeedCard shape */ })
    .from(favorites)
    .innerJoin(items, eq(items.id, favorites.itemId))
    .where(and(eq(favorites.userId, session.user.id), eq(items.status, 'published')))
    .orderBy(desc(favorites.createdAt));

  return <>{/* render FeedCards */}</>;
}
```

**Why `force-dynamic`:** user-specific, cannot be CDN-cached. Already set by Phase 4. Unchanged.

### Pattern 5: useOptimistic for Three-State Vote Toggle

```typescript
// Source: https://react.dev/reference/react/useOptimistic (verified 2026-04-23)
// src/components/feed/feed-card-actions.tsx (abbreviated)
'use client';
import { useOptimistic, startTransition } from 'react';
import { voteItem } from '@/server/actions/votes';
import { favoriteItem, unfavoriteItem } from '@/server/actions/favorites';

type Interaction = { favorited: boolean; vote: -1 | 0 | 1 };

export function FeedCardActions({
  itemId,
  initial,
}: {
  itemId: string;
  initial: Interaction;
}) {
  const [optimistic, setOptimistic] = useOptimistic<Interaction, Partial<Interaction>>(
    initial,
    (curr, patch) => ({ ...curr, ...patch }),
  );

  function handleFavorite() {
    startTransition(async () => {
      const next = !optimistic.favorited;
      setOptimistic({ favorited: next });
      try {
        const { favorited } = next
          ? await favoriteItem(itemId)
          : await unfavoriteItem(itemId);
        startTransition(() => setOptimistic({ favorited })); // reconcile
      } catch {
        startTransition(() => setOptimistic({ favorited: !next })); // rollback
        // show inline error (UI-SPEC: 操作失败，请重试。)
      }
    });
  }

  function handleVote(desired: 1 | -1) {
    startTransition(async () => {
      const next: -1 | 0 | 1 = optimistic.vote === desired ? 0 : desired;
      setOptimistic({ vote: next });
      try {
        const { vote } = await voteItem(itemId, desired);
        startTransition(() => setOptimistic({ vote }));
      } catch {
        startTransition(() => setOptimistic({ vote: optimistic.vote })); // rollback
      }
    });
  }
  // ...render with optimistic.favorited + optimistic.vote
}
```

**Key mechanics:**
- `useOptimistic` MUST be used inside a `startTransition` (or form `action`). Calling `setOptimistic` outside a transition throws in React 19 stable.
- The optimistic state is **derived** from `initial` every render — if the parent RSC re-renders with new `initial` (e.g., after revalidatePath), the optimistic state rebases automatically.
- **Reconciliation** after success: call `setOptimistic` again with the server's returned value (inside a new startTransition) to replace the optimistic guess with the confirmed value.
- **Rollback** on error: call `setOptimistic` with the prior value. Inline error copy per UI-SPEC lives alongside.

### Pattern 6: Server Actions with Two-Layer Ban Guard

```typescript
// src/server/actions/favorites.ts
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { favorites, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

async function requireLiveUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  // D-05 Layer 2 — defensive re-check
  const [row] = await db.select({ isBanned: users.isBanned })
    .from(users).where(eq(users.id, session.user.id));
  if (!row || row.isBanned) throw new Error('FORBIDDEN');
  return session.user.id;
}

export async function favoriteItem(itemId: string) {
  const userId = await requireLiveUser();
  await db.insert(favorites).values({ userId, itemId: BigInt(itemId) })
    .onConflictDoNothing();
  revalidatePath('/favorites');
  return { favorited: true };
}

export async function unfavoriteItem(itemId: string) {
  const userId = await requireLiveUser();
  await db.delete(favorites).where(
    and(eq(favorites.userId, userId), eq(favorites.itemId, BigInt(itemId))),
  );
  revalidatePath('/favorites');
  return { favorited: false };
}
```

```typescript
// src/server/actions/votes.ts (D-12 exclusive toggle)
'use server';
export async function voteItem(itemId: string, value: 1 | -1) {
  const userId = await requireLiveUser();
  const itemBig = BigInt(itemId);
  const [existing] = await db.select().from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.itemId, itemBig)));

  if (!existing) {
    await db.insert(votes).values({ userId, itemId: itemBig, value });
    return { vote: value };
  }
  if (existing.value === value) {
    // same click twice — delete (neutral)
    await db.delete(votes).where(and(eq(votes.userId, userId), eq(votes.itemId, itemBig)));
    return { vote: 0 as const };
  }
  // flip (1 → -1 or -1 → 1)
  await db.update(votes).set({ value }).where(
    and(eq(votes.userId, userId), eq(votes.itemId, itemBig)),
  );
  return { vote: value };
}
```

### Anti-Patterns to Avoid

- **Do not import `signIn` from `'next-auth/react'` in Phase 5 modal code.** Use the server-side `signIn` from `@/lib/auth` wrapped in a form action. Client-side `next-auth/react` is legacy and doesn't compose with the `redirectProxyUrl` pattern cleanly.
- **Do not call `revalidatePath('/favorites')` from like/dislike actions** — votes don't affect the favorites page. Over-revalidating wastes cache and adds latency.
- **Do not use `useSession()` inside the FeedCardActions client component** to decide whether to open the modal vs call the action. Read authenticated state from a prop set by the RSC parent (cleaner, avoids a client-side session fetch on every card).
- **Do not augment `session.user.isBanned`.** Keeping is_banned out of the session payload (D-08) means it can't be stale-cached in the client — the check always hits the DB on the next auth() or server action.
- **Do not store OAuth refresh tokens for Phase 5.** We don't call provider APIs server-to-server. `profile()` reads are sufficient. Skipping refresh-token complexity trims risk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth authorization code exchange | Custom GitHub/Google OAuth handler | `next-auth@5` provider | PKCE, state validation, nonce, discovery document handling, error recovery — ~200 edge cases across providers. |
| Session cookie signing/HttpOnly/SameSite | Manual cookie + HMAC | Auth.js `sessions` table + cookie | `__Secure-authjs.session-token` cookie attributes, secret rotation, CSRF double-submit — all handled. |
| CSRF token for signIn forms | Hidden input + server check | Next.js 15 server actions built-in | Server actions have built-in unguessable action IDs + origin check. Auth.js v5 forms use server actions. |
| Magic-link token generation + verification | Random bytes + DB lookup + TTL | Resend provider + `verification_tokens` table | TTL, one-time consumption, replay protection, rate-limiting hooks — all in the adapter. |
| OAuth state parameter | Manual generation + storage | Auth.js provider `checks: ['state', 'pkce']` | Default in v5 for all OAuth providers. `redirectProxyUrl` auto-enables `state` check per docs. |
| Open-redirect guard on signIn `callbackUrl` | Custom URL validator | Auth.js v5 built-in | v5 validates `callbackUrl` is same-origin (or matches `trustedOrigins`) by default. |
| Optimistic state machine | `useState` + rollback logic | React `useOptimistic` | Built for this exact case. Handles mid-transition state updates + batching. |
| Redirect proxy for preview OAuth | Manual state-cookie routing | `AUTH_REDIRECT_PROXY_URL` | Auth.js handles the cross-deployment cookie signing + redirect. Rolling your own is a week of work. |

**Key insight:** Phase 5 is exactly the kind of domain where the "it's just a login flow" intuition leads to expensive rewrites. OAuth has ~15 standardized-but-subtle correctness requirements (state, PKCE, nonce, authorization server metadata, token validation, redirect_uri matching, CSRF, open-redirect prevention). Auth.js v5 encodes all of them. Write configuration, not implementation.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `users` table (already exists, will gain email_verified + image columns); `favorites` + `votes` tables (exist, empty). New: `accounts`, `sessions`, `verification_tokens`. | Migration adds 3 tables + 2 columns. No data migration of existing rows — `users` table is currently empty (Phase 4 has zero users). |
| Live service config | GitHub OAuth app (to be created on github.com/settings/developers); Google OAuth app (on console.cloud.google.com); Resend sending domain (on resend.com). **None of these are in git.** | Document in `docs/auth-providers.md` runbook: how to create each app, what callback URL to register (production URL only per D-19), how to rotate secrets. |
| OS-registered state | None — Phase 5 runs entirely in Vercel + Neon + Resend. No cron jobs, no Trigger.dev auth. | None. |
| Secrets/env vars | New: `AUTH_SECRET`, `AUTH_URL`, `AUTH_REDIRECT_PROXY_URL`, `RESEND_FROM`. Promoted from Phase 1 placeholders: `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`. | Register all in Vercel (Production + Preview + Development scopes). `AUTH_REDIRECT_PROXY_URL` is Preview-scope only. `AUTH_SECRET` is CRITICAL shared-identical across all scopes. Update `.env.example`. |
| Build artifacts / installed packages | Adding `next-auth@beta` + `@auth/drizzle-adapter` to package.json. No stale artifacts from earlier phases. | `pnpm install` + lockfile commit. |

## Common Pitfalls

### Pitfall 1: `useOptimistic` typing under React 18.3.1

**What goes wrong:** `import { useOptimistic } from 'react'` may compile but `@types/react@18` does not export `useOptimistic` from its main `index.d.ts` — only from `canary.d.ts`. Depending on how the project's `tsconfig.json` resolves React types, you get either a clean import OR a `Module '"react"' has no exported member 'useOptimistic'` error.

**Why it happens:** Next.js 15 App Router bundles a React canary build for client components even when `package.json` pins React to `^18`. The runtime works. The types are out of sync.

**How to avoid:**
- Option A: install `@types/react@canary` alongside `@types/react@18` (ugly but fastest).
- Option B: add `/// <reference types="react/canary" />` at the top of the client file using useOptimistic.
- Option C: planner evaluates whether to upgrade React to 19 (CLAUDE.md does not forbid; Next 15 supports it). Cleanest long-term but expands the phase's surface. **Recommended: defer React 19 upgrade; use Option B locally in FeedCardActions.**

**Warning signs:** TypeScript error `Module '"react"' has no exported member 'useOptimistic'` during `pnpm typecheck`.

[VERIFIED: installed node_modules/@types/react/canary.d.ts exports useOptimistic; the main index.d.ts does not.]
[VERIFIED: Next.js 15 bundled React at `node_modules/next/dist/compiled/react/cjs/react.production.js` exports `useOptimistic`.]

### Pitfall 2: Drizzle adapter uuid/text FK mismatch

**What goes wrong:** Copy-pasting the Auth.js docs' default Drizzle schema (`id: text('id').primaryKey()...`) and leaving the project's `users.id` as `uuid` creates two incompatible schemas. The adapter writes to `users.id` as a uuid-format string; but `accounts.userId` and `sessions.userId` (if you copied the default schema) are `text` and not FK-compatible with `users.id uuid`.

**Why it happens:** Default docs show `text` because it's the lowest-common-denominator. The project's `users.id` is `uuid default random` (Phase 1 D-09 precedent).

**How to avoid:** In `drizzle/0004_auth.sql` and in the Drizzle schema, declare `accounts.userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` and `sessions.userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`. The adapter accepts uuid — confirmed in `DefaultPostgresColumn<{ columnType: "PgVarchar" | "PgText" | "PgUUID" }>` for both `userId` fields.

**Warning signs:** Migration fails with `foreign key constraint ... incompatible types`. OR insert works but first sign-in fails with `invalid input syntax for type uuid`.

### Pitfall 3: `AUTH_SECRET` silently different between preview and production

**What goes wrong:** Preview OAuth callback returns a generic "There was an error" page. No log line names the mismatch.

**Why it happens:** The proxy flow (D-19) signs a state cookie on production, redirects to preview, preview tries to verify — signature doesn't match because secrets differ.

**How to avoid:** Set `AUTH_SECRET` at the project level in Vercel (not per-environment). If you must scope per environment, set the SAME value in Production + Preview + Development scopes explicitly. Document in `docs/auth-providers.md`. Planner MUST include a verification step in the deployment runbook: "sign in on preview URL; confirm success."

**Warning signs:** Preview OAuth sign-in appears to hang or returns "Verification" error; production works fine.

### Pitfall 4: Resend `from` domain not verified

**What goes wrong:** `sendVerificationRequest` calls Resend, Resend returns 403 "domain not verified," user never receives email, sign-in form shows generic error.

**Why it happens:** Resend requires DNS verification (SPF + DKIM) for any non-`resend.dev` from-address. First-time setup is a 10-minute DNS step that's easy to defer.

**How to avoid:** `RESEND_FROM` env var MUST use a verified domain. For initial dev, use `onboarding@resend.dev` which works without DNS. For production, verify the domain per Resend docs. Document in `docs/auth-providers.md`. Include a live send test in the Phase 5 validation runbook.

### Pitfall 5: `session.strategy: 'database'` + JWT callback

**What goes wrong:** Copying a JWT-strategy config sample (most Auth.js tutorials) and using `callbacks.jwt` to augment roles — with DB strategy, the `jwt` callback is never called. Roles silently missing from session.

**Why it happens:** When `session.strategy = 'database'`, Auth.js v5 uses the session callback with `{ session, user }` signature — no JWT involved. The `jwt` callback is a no-op.

**How to avoid:** Augment session.user.role directly in the `session` callback from the `user` parameter (which is the DB row). See Pattern 1.

**Warning signs:** `session.user.role` is undefined even for known-admin users.

### Pitfall 6: Server action called from anonymous client (no modal seam)

**What goes wrong:** An anonymous user who has disabled JS somehow reaches the server action directly (or a test harness does), and the server action throws `UNAUTHENTICATED` with a 500 to the client.

**Why it happens:** Phase 5's modal seam is client-side (the `open-login-modal` event). If the action is invoked outside the gated click handler, the guard fires.

**How to avoid:** Server actions MUST throw a specific error class (e.g., `AuthError`) that the client catches and dispatches `open-login-modal` — not a generic Error. This gives a clean UX fallback. Alternatively, the client-side handler checks session state and dispatches the modal event BEFORE calling the server action, so the action only ever runs for signed-in users.

**Recommended:** Do both. Client-side checks session (from prop); server action guards defensively.

### Pitfall 7: `next/image` remotePatterns missing for OAuth avatars

**What goes wrong:** `<Image src={session.user.image} />` throws `hostname "avatars.githubusercontent.com" is not configured under images`.

**Why it happens:** Phase 4's `next.config.ts` doesn't include remotePatterns because every avatar was a monogram. Phase 5 introduces real OAuth avatar URLs.

**How to avoid:** Add to `next.config.ts`:
```typescript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  ],
},
```

### Pitfall 8: Drizzle `verification_tokens` table missing composite PK

**What goes wrong:** Magic-link verification silently doesn't dedupe — a user requesting 5 links accumulates 5 rows; clicking any works, but the behavior drifts from the spec.

**Why it happens:** Default schema has composite PK `(identifier, token)`. Easy to miss when hand-authoring the SQL.

**How to avoid:** Ensure the migration declares `CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token)`.

## Code Examples

### Drizzle schema extension (users table)

```typescript
// src/lib/db/schema.ts — extend users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // NEW (D-02)
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  // EXISTING (preserved)
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'),
  isBanned: boolean('is_banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});
```

### Drizzle schema — new adapter tables (uuid FK)

```typescript
// src/lib/db/schema.ts — ADD
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);
```

### Hand-authored migration (0004_auth.sql)

```sql
-- drizzle/0004_auth.sql
-- Phase 5 migration — adds Auth.js adapter tables + extends users.
-- Hand-authored (Phase 3 precedent); uuid FK to match users.id.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;

CREATE TABLE IF NOT EXISTS accounts (
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS accounts_userid_idx ON accounts ("userId");

CREATE TABLE IF NOT EXISTS sessions (
  "sessionToken" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_userid_idx ON sessions ("userId");

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
```

### /api/auth/[...nextauth]/route.ts

```typescript
// src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/lib/auth';
// handlers re-exported via `export const { handlers, auth, signIn, signOut } = NextAuth(...)`
// in src/lib/auth/index.ts and then: export const { GET, POST } = handlers
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth@4` Pages Router | `next-auth@5` App Router with `handlers`/`auth`/`signIn`/`signOut` exports | 2024 (v5 beta line) | Phase 5 adopts v5; v4 docs are outdated for App Router. |
| JWT callback for role persistence | Database session strategy + session callback with `user` param | Same | No `jwt` callback needed; session callback receives DB row directly. |
| Client-side `signIn` from `'next-auth/react'` | Server-action `signIn` inside `<form action>` | Same | Works without JS; better for App Router. |
| `tailwindcss-animate` | `tw-animate-css` or inline keyframes | March 2025 | Not directly Phase 5, but relevant if planner adds spinners. |

**Deprecated/outdated:**
- Any guidance to use `getServerSession()` — v5 uses `auth()`. Verified 2026-04-23.
- Any guidance saying `useOptimistic` is React 19-only — correct for React 18 stable, but Next 15 App Router bundles a canary React that exposes it. Verified by inspecting installed `node_modules/next/dist/compiled/react/cjs/react.production.js`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Returning `null` from the `session` callback under database strategy clears the session. | Pattern 1 | [ASSUMED — widely documented behavior for JWT strategy; database-strategy docs mention "what data is exposed to the client" but don't explicitly confirm `return null` clears. Planner should verify with a test: a user with `is_banned=true` whose session callback returns null is treated as anonymous on the next `auth()` call.] |
| A2 | `redirectProxyUrl` auto-enables `state` OAuth check. | Pattern 3 | [CITED: https://authjs.dev/reference/solid-start "This option automatically enables the state OAuth2Config.checks on the provider."] |
| A3 | Resend token TTL default is 10 minutes. | D-07 / UI-SPEC email copy | [ASSUMED — common default; not confirmed in the ctx7 docs fetched. Planner should verify in Auth.js source or set explicit `maxAge: 600` on the Resend provider to lock the value.] |
| A4 | Next.js 15 App Router bundles a React canary that exposes `useOptimistic` at runtime even when the project pins `react@18.3.1`. | Pitfall 1 | [VERIFIED: inspected node_modules/next/dist/compiled/react/cjs/react.production.js line 510 `exports.useOptimistic = function (passthrough, reducer)`.] |
| A5 | Auth.js v5 `session.user.id` is available under database strategy without explicit augmentation. | Pattern 1 | [CITED: https://authjs.dev/guides/extending-the-session — "Add User ID to Database Session" guide shows `session.user.id = user.id`; absent that line, it's undefined.] Need to assign it in the callback. |
| A6 | `AUTH_SECRET` must be byte-identical across Vercel preview/production for redirect-proxy to work. | Pattern 3 / Pitfall 3 | [CITED: https://authjs.dev/getting-started/deployment "both the preview and stable environments must share the same AUTH_SECRET."] |
| A7 | `drizzle-kit push` is acceptable for Phase 5 migration (Phase 1 + Phase 3 precedent). | Migration approach | [VERIFIED: grep of prior STATE.md notes confirms Phase 3 Plan 01 used `psql fallback` AND Phase 1 Plan 02 used `drizzle-kit migrate`. Either acceptable; planner picks.] |
| A8 | Token TTL 10 minutes is a reasonable default for magic links; extending it is low-priority. | D-07 | [ASSUMED — industry norm. User may prefer longer for mobile users who context-switch; revisit if UAT feedback surfaces this.] |

## Open Questions

1. **Should magic-link emails use verified domain at initial ship, or `onboarding@resend.dev`?**
   - What we know: Resend allows `onboarding@resend.dev` without DNS verification; verified domains require SPF/DKIM.
   - What's unclear: Whether the user has a chosen production domain ready for verification on day 1.
   - Recommendation: Ship with verified domain if ready; otherwise temporarily use `onboarding@resend.dev` and document the DNS step in `docs/auth-providers.md`. Planner adds a task for domain verification.

2. **Should Phase 5 ship rate limiting on the magic-link endpoint?**
   - What we know: Auth.js provides no built-in rate limit. Upstash is provisioned and available. Abuse vector: an attacker scripts `signIn('resend', { email: 'victim@...' })` to spam a victim with login emails (Resend has some abuse protection, but it's not a substitute).
   - What's unclear: Whether Phase 5's launch traffic justifies the added complexity, or whether Phase 6 operational hardening is soon enough.
   - Recommendation: Ship a minimal rate limit using `@upstash/ratelimit` keyed on `(ip, email)` with a sliding window of 5 requests per 10 minutes. It's ~30 lines of code and prevents the most common abuse. Planner's call; if deferred, document the threat in `docs/auth-providers.md`.

3. **Does the planner use `drizzle-kit push` or a hand-authored 0004_auth.sql?**
   - What we know: Phase 1 used `drizzle-kit migrate` (Plan 01-02). Phase 3 used psql fallback for HNSW (Plan 03-01) because Drizzle DSL couldn't express the index. Phase 2 used `drizzle-kit generate` + apply.
   - What's unclear: Whether the project's CI migration pipeline (GitHub Actions w/ Neon branch-per-PR) is wired to pick up new `drizzle/*.sql` files or if it expects `drizzle-kit migrate`.
   - Recommendation: Hand-author `drizzle/0004_auth.sql` (Phase 3 precedent, cleaner for uuid FK + composite PK) AND update `drizzle/meta/_journal.json` to include it. Validate via `drizzle-kit check` in CI.

4. **Should `/favorites` redirect or show a login CTA when unauthenticated?**
   - CONTEXT D-15 explicitly leaves this to the planner.
   - Redirect is simpler, matches SaaS convention, removes an edge case for the empty-state component.
   - Empty-state-with-CTA is discoverable (a shared link to /favorites still lands somewhere meaningful).
   - Recommendation: Redirect to `/`. Keep `FavoritesEmpty` component for authenticated-no-favorites state only.

5. **Should session callback's null-return-on-ban be verified via test, not just implemented?**
   - This is a security-critical path.
   - Recommendation: Add a test (unit or integration) that exercises: create a user → sign in → set is_banned=true in DB → call auth() → assert session is null. This test belongs in the Nyquist validation section below.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres | All auth table writes | ✓ | pgvector 0.8.x + Postgres 16 | — |
| Vercel | Hosting; env vars for AUTH_REDIRECT_PROXY_URL | ✓ | Production app | — |
| GitHub OAuth app | AUTH-02 | ✗ (requires manual creation) | — | User creates one during execution; runbook documents |
| Google OAuth app | AUTH-04 | ✗ (requires manual creation) | — | Same |
| Resend account + API key + verified domain | AUTH-03 | ✗ (requires manual setup) | — | `onboarding@resend.dev` works without domain verification for initial testing |
| Upstash Redis | Optional rate limiting | ✓ (Phase 1) | — | Feature deferrable to Phase 6 |
| Node 20+ | Next.js + Auth.js runtime | ✓ | Project engines: ">=20.9" | — |
| `next-auth@5.0.0-beta.31` | All auth | ✗ (not yet installed) | — | `pnpm add next-auth@beta @auth/drizzle-adapter` |

**Missing dependencies with no fallback:**
- None technically — GitHub/Google/Resend are all human-setup steps documented in the runbook.

**Missing dependencies with fallback:**
- Verified Resend domain — can start with `onboarding@resend.dev`; mark as tech-debt.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (unit) + Playwright 1.59 (E2E) — both already installed |
| Config file | `vitest.config.ts` (root) — exists from Phase 2+; Playwright config exists from Phase 4 |
| Quick run command | `pnpm test` (Vitest unit) |
| Full suite command | `pnpm test && pnpm test:e2e:ci && pnpm typecheck && pnpm lint` |
| Phase gate | Full suite green + manual UAT per `05-UAT.md` (checklist for OAuth preview, magic-link from real email) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Auth.js configured; authConfig exports handlers/auth/signIn/signOut | unit | `pnpm test tests/lib/auth/config.test.ts` | ❌ Wave 0 |
| AUTH-01 | DrizzleAdapter uses project db + 4 tables | unit (mock adapter factory) | `pnpm test tests/lib/auth/adapter.test.ts` | ❌ Wave 0 |
| AUTH-02 | GitHub OAuth end-to-end on production | manual-only (UAT) | `05-UAT.md §§GitHub OAuth production` | ❌ Wave 0 |
| AUTH-02 | GitHub OAuth on preview URL (redirect proxy) | manual-only (UAT, requires PR preview) | `05-UAT.md §§GitHub OAuth preview` | ❌ Wave 0 |
| AUTH-03 | Magic-link email sends (unit: sendVerificationRequest called with Chinese body) | unit | `pnpm test tests/lib/auth/magic-link-email.test.ts` | ❌ Wave 0 |
| AUTH-03 | Magic-link works from CN-accessible email end-to-end | manual-only (UAT) | `05-UAT.md §§Magic link real send` | ❌ Wave 0 |
| AUTH-04 | Google OAuth provider enabled; button renders | unit + Playwright | `pnpm test:e2e:ci tests/e2e/login-modal.spec.ts` | ❌ Wave 0 |
| AUTH-05 | AUTH_REDIRECT_PROXY_URL env present in preview | unit (check process.env schema) | `pnpm test tests/lib/auth/env.test.ts` | ❌ Wave 0 |
| AUTH-05 | Preview OAuth round-trip | manual-only (UAT) | `05-UAT.md §§Preview OAuth redirect proxy` | ❌ Wave 0 |
| AUTH-06 | Anonymous read works on `/`, `/all`, `/items/[id]` | Playwright | `pnpm test:e2e:ci tests/e2e/anonymous-read.spec.ts` | ❌ Wave 0 |
| AUTH-07 | Session persists across browser restart | Playwright (use `storageState`) | `pnpm test:e2e:ci tests/e2e/session-persist.spec.ts` | ❌ Wave 0 (stubbed via `signIn` test helper) |
| AUTH-08 | Sign out from any page clears session | Playwright | `pnpm test:e2e:ci tests/e2e/sign-out.spec.ts` | ❌ Wave 0 |
| AUTH-* (ban) | Banned user's session is cleared on next auth() | integration (uses test Neon branch) | `pnpm test:integration tests/integration/ban-enforcement.test.ts` | ❌ Wave 0 |
| FAV-01 | favoriteItem server action inserts; returns {favorited:true} | unit (mock db) | `pnpm test tests/server/actions/favorites.test.ts` | ❌ Wave 0 |
| FAV-01 | Favorite toggles UI immediately | Playwright | `pnpm test:e2e:ci tests/e2e/favorite-toggle.spec.ts` | ❌ Wave 0 |
| FAV-02 | unfavoriteItem deletes; returns {favorited:false} | unit | Same file as FAV-01 | ❌ Wave 0 |
| FAV-03 | /favorites renders user's favorites reverse-chrono | Playwright | `pnpm test:e2e:ci tests/e2e/favorites-page.spec.ts` | ❌ Wave 0 |
| VOTE-01 | voteItem(id, 1) on empty → value=1 | unit | `pnpm test tests/server/actions/votes.test.ts` | ❌ Wave 0 |
| VOTE-02 | voteItem(id, -1) on empty → value=-1 | unit | Same file | ❌ Wave 0 |
| VOTE-01/02 | Exclusive toggle: like then dislike flips to -1 (no intermediate 0) | unit | Same file | ❌ Wave 0 |
| VOTE-01/02 | Same-value click deletes row (toggle off) | unit | Same file | ❌ Wave 0 |
| VOTE-03 | "个性化推荐即将上线" rendered on card + matches D-14 regex `/个性化.*即将/` | Playwright / unit on component | `pnpm test:e2e:ci tests/e2e/vote-honest-copy.spec.ts` | ❌ Wave 0 |
| VOTE-04 | Anonymous favorite/like click opens modal, no network request to server action | Playwright | `pnpm test:e2e:ci tests/e2e/anonymous-gated-action.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test` (Vitest unit, <10s)
- **Per wave merge:** `pnpm test && pnpm test:e2e:ci && pnpm typecheck && pnpm lint`
- **Phase gate:** Full suite green + manual UAT per `05-UAT.md` (covers: OAuth on preview URL, magic-link from real CN-accessible email, banned user session clearing). Manual UAT is required because the three gated flows depend on live OAuth apps + real email delivery that cannot be stubbed without sacrificing the signal.

### Wave 0 Gaps

- [ ] `tests/lib/auth/config.test.ts` — asserts authConfig shape (providers, adapter, session.strategy='database', callbacks.session, events.signIn/linkAccount)
- [ ] `tests/lib/auth/magic-link-email.test.ts` — mocks fetch, asserts Resend HTTP body has Chinese subject + text + correct url placeholder
- [ ] `tests/lib/auth/env.test.ts` — asserts required env vars present for a given env (strict for production, lenient for preview)
- [ ] `tests/server/actions/favorites.test.ts` — mocks db + auth(), asserts requireLiveUser guard + insert/delete + revalidatePath
- [ ] `tests/server/actions/votes.test.ts` — full D-12 state machine (empty→+1, +1→+1=0, +1→-1=flip, -1→-1=0, -1→+1=flip)
- [ ] `tests/integration/ban-enforcement.test.ts` — requires a Neon test branch; uses `NEON_DATABASE_URL` from CI branch. Creates a user, signs in, sets is_banned=true, asserts auth() returns null.
- [ ] `tests/e2e/login-modal.spec.ts` — Playwright: open modal, assert three provider buttons visible with correct Chinese labels per UI-SPEC, assert email input has correct aria + autocomplete
- [ ] `tests/e2e/anonymous-gated-action.spec.ts` — Playwright: click favorite on `/all`, assert modal opens, assert no POST to /server action fired (intercept requests)
- [ ] `tests/e2e/favorite-toggle.spec.ts` — Playwright: use Auth.js test helper to seed session cookie; click favorite; assert star icon fill updates; assert `/favorites` shows item; unfavorite; assert item gone
- [ ] `tests/e2e/favorites-page.spec.ts` — Playwright: seed 3 favorites with known timestamps; assert reverse-chrono order
- [ ] `tests/e2e/sign-out.spec.ts` — Playwright: seed session; open UserChip; click 退出登录; assert anonymous UserChip renders
- [ ] `tests/e2e/session-persist.spec.ts` — Playwright: seed session via `storageState`; navigate; assert authenticated; close context; reopen with same storageState; assert still authenticated
- [ ] `tests/e2e/anonymous-read.spec.ts` — Playwright: no cookies; visit `/`, `/all`, `/items/1`, assert page loads (200 + content)
- [ ] `tests/e2e/vote-honest-copy.spec.ts` — Playwright: visit `/`; assert "个性化推荐即将上线" copy exists on a card (or at least one test card)
- [ ] `05-UAT.md` — manual checklist for live OAuth (GitHub prod + preview), live magic-link send to personal CN-accessible email, session persistence across browser restart

**Framework install:** none — Vitest and Playwright already installed.

**Test-seed helper (new):** `tests/helpers/seed-session.ts` that inserts a row into `sessions` + `users` with a known `sessionToken`, returns the cookie value for Playwright `storageState`. Avoids the need to stub GitHub's OAuth for every test.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js v5 handles OAuth (PKCE, state, nonce), magic-link token generation/verification, session management. No hand-rolled auth. |
| V3 Session Management | yes | Database session strategy; HttpOnly + Secure + SameSite=Lax cookies by default in Auth.js v5. Sessions revocable via DB update. |
| V4 Access Control | yes | `users.role` (admin/user) checked in Phase 6; Phase 5 only enforces `is_banned` via two-layer defense. |
| V5 Input Validation | yes | Zod schemas on server action inputs (itemId, vote value ∈ {-1, 1}). Email input validated by `<input type="email">` + Auth.js Resend provider validation. |
| V6 Cryptography | yes | Auth.js v5 signs session cookies with `AUTH_SECRET` (HS256). OAuth tokens stored encrypted at rest in Postgres (Neon TDE at storage layer; Auth.js doesn't add app-layer encryption for stored refresh_tokens — acceptable for Phase 5 since we don't use refresh tokens). |
| V9 Communication | yes | All OAuth + Resend flows are HTTPS by default. Vercel enforces HTTPS. |
| V13 API and Web Service | yes | Server actions have CSRF protection via Next.js 15 action ID check + origin validation. Auth.js v5 enforces origin check on callback URL. |

### Known Threat Patterns for Next.js 15 + Auth.js v5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on server actions (favorite/vote) | Tampering | Next.js 15 built-in action ID + origin check. Confirmed automatic. |
| Open redirect via `callbackUrl` | Tampering | Auth.js v5 defaults to same-origin check on callbackUrl. No custom work needed. |
| Magic-link token replay | Spoofing | `verification_tokens` row deleted on first use (adapter behavior). Composite PK `(identifier, token)` ensures uniqueness. |
| Session fixation | Spoofing | Auth.js generates a new `sessionToken` on every successful sign-in. Old cookie (if any) is overwritten. |
| Ban bypass via cached session | Elevation of Privilege | Two-layer defense: session callback reads is_banned on every auth() call; server actions re-check defensively. |
| SQL injection in server actions | Tampering | Drizzle ORM uses parameterized queries exclusively. Confirmed in existing codebase. |
| Prompt injection via `users.name` | Not applicable | Phase 5 has no LLM calls. |
| OAuth state reuse | Spoofing | `redirectProxyUrl` auto-enables state check (cited in ctx7 docs). State cookie tied to `AUTH_SECRET`. |
| Email spoofing in magic-link | Spoofing | Auth.js requires the email to own the token — token is only sent to the claimed email. Magic-link also validates against `verification_tokens.identifier`. |
| Spamming victim with magic-link emails | DoS | Phase 5 Claude's Discretion: rate limit (recommended ship) on `(ip, email)` via Upstash. Without rate limit, an attacker can spam a victim ~10 emails/min before Resend flags. |
| XSS in user name rendered in UserChip | Tampering | React's default JSX escaping neutralizes HTML in names. No `dangerouslySetInnerHTML` anywhere. |
| Cookie hijacking over HTTP | Information Disclosure | `__Secure-authjs.session-token` cookie requires HTTPS; Vercel enforces HTTPS in production. |
| UUID forging in favorite/vote requests | Spoofing | `itemId` is user-supplied but validated — inserting into favorites with a bogus `itemId` fails FK constraint (items table). No impact. |

## Project Constraints (from CLAUDE.md)

Directives that constrain Phase 5 planning:

- **§5 Auth stack:** Auth.js v5 + Drizzle adapter + DB sessions (revocable) — locked.
- **§5 Providers:** GitHub, Google, Resend magic link — locked. NO Clerk (PIPL/US PII).
- **§7 Claude models:** Not applicable to Phase 5 (no LLM calls).
- **§11 State Management:** `useOptimistic` (no Redux/Zustand) — locked.
- **§12 Image handling:** OAuth provider avatar URLs via `next/image` with `remotePatterns` — locked.
- **Chinese-only UI:** All new copy in Simplified Chinese, per UI-SPEC.
- **Hosting:** Vercel for Next.js; no mainland-China-hosted infra (PIPL + ICP avoidance).
- **No Google Fonts / GA:** Not relevant to Phase 5.
- **Drizzle migrations workflow:** `drizzle-kit push` for dev, hand-authored SQL for edge cases (Phase 3 precedent).
- **`CLAUDE.md` §1 rendering strategy for /favorites:** dynamic RSC `no-store` — user-specific, cannot be CDN-cached. Already matches D-15 + Phase 4 D-16 (`force-dynamic`).
- **Env var registry:** every new env var MUST be added to `.env.example` (Phase 1 D-20). Phase 5 only touches Vercel — Trigger.dev has no auth surface (Phase 5 runs entirely in Next.js land).

Planner must NOT:
- Recommend Clerk, Supabase Auth, Better Auth, or any other auth provider.
- Recommend JWT session strategy.
- Ship a JavaScript state management library (Redux/Zustand/Jotai).
- Introduce any CDN font or Google Analytics.
- Use `next-auth@4` patterns (getServerSession, _app integration).

## Sources

### Primary (HIGH confidence)
- `/websites/authjs_dev` via Context7 — Drizzle adapter schema, AUTH_REDIRECT_PROXY_URL, Resend provider, session callback, events
- https://authjs.dev/getting-started/adapters/drizzle — DrizzleAdapter custom schema API
- https://authjs.dev/getting-started/providers/resend — `sendVerificationRequest` override contract
- https://authjs.dev/getting-started/deployment — AUTH_REDIRECT_PROXY_URL + AUTH_SECRET sharing requirement
- https://authjs.dev/reference/drizzle-adapter/lib/pg — default Postgres schema types (uuid allowed on id + userId FKs)
- https://authjs.dev/guides/extending-the-session — Add User ID to Database Session pattern
- https://authjs.dev/guides/role-based-access-control — role in session callback (DB strategy variant)
- https://react.dev/reference/react/useOptimistic — optimistic like-button pattern
- https://react.dev/blog/2024/12/05/react-19 — useOptimistic stable as of React 19 GA (2024-12-05)
- `npm view next-auth versions` — `5.0.0-beta.31` is latest v5 beta
- `npm view @auth/drizzle-adapter version` — `1.11.2` is latest
- Local node_modules inspection — React 18.3.1 + Next.js 15 bundled React (canary) — verified `useOptimistic` export in Next's bundle

### Secondary (MEDIUM confidence)
- https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/pg.ts — default schema column types (fetched via WebFetch)
- https://nextjs.org/blog/next-15 — Next.js 15 App Router + React Canary bundling
- https://dev.to/dthompsondev/react-19-useoptimistic-hook-breakdown-5g9k — useOptimistic stable requires React 19 (confirms canary-only before)
- [Implementing Optimistic Updates in Next.js using React 18's `useOptimistic` Hook](https://typeofweb.com/implementing-optimistic-updates-in-nextjs-using-react-18s-useoptimistic-hook) — confirms runtime works via Next's bundled canary

### Tertiary (LOW confidence — flagged A1, A3, A8)
- A1: database-strategy null-return-clears-session — inferred behavior, not explicit in ctx7 results. Planner verifies via integration test.
- A3: Resend TTL default 10 minutes — inferred from common practice. Planner sets `maxAge: 600` explicitly to lock.
- A8: UAT feedback may find 10 min TTL too short for mobile users — speculative.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view` and ctx7 documentation confirms API contracts
- Architecture (Drizzle adapter + DB session + redirect proxy): HIGH — official docs consulted, custom schema override confirmed compatible with uuid + extra columns
- Pitfalls: MEDIUM — Pitfall 1 (useOptimistic typing) verified by inspecting installed node_modules; Pitfall 3 (AUTH_SECRET mismatch) cited from official deployment docs; Pitfall 5 (JWT callback no-op under DB strategy) inferred from API contract
- Validation architecture: HIGH — test framework already installed, test map is complete per requirement ID

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days; Auth.js v5 still in beta line — expect possible API changes if v5.0.0 GA ships within this window)
