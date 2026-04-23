# Phase 5: Auth + User Interactions — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 18 (13 created, 5 modified)
**Analogs found:** 15 / 18

Scope: extracted from `05-CONTEXT.md` §canonical_refs + §code_context, `05-RESEARCH.md` §Component Responsibilities + §Wave 0 Gaps, `05-UI-SPEC.md` §Component Inventory. All analogs are from Phase 1–4 source already in the repo.

---

## File Classification

| Phase 5 File | New/Modified | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `src/lib/db/schema.ts` | modified | drizzle-schema | schema-def | `src/lib/db/schema.ts` (self) | exact |
| `drizzle/0004_auth.sql` | new | migration | schema-def | `drizzle/0003_hnsw_index_and_settings_seed.sql` | exact |
| `drizzle/meta/_journal.json` | modified | migration-index | schema-def | `drizzle/meta/_journal.json` (self) | exact |
| `src/lib/auth/config.ts` | new | auth-config | config | — (first auth module) | role-only → `src/lib/db/client.ts` singleton pattern |
| `src/lib/auth/index.ts` | new | barrel | re-export | — | role-only → `src/lib/db/client.ts` (exports `db`) |
| `src/lib/auth/session.ts` | new | auth-helper | request-response | `src/lib/feed/get-feed.ts` (deps-injected pure fn) | role-match |
| `src/lib/auth/magic-link-email.ts` | new | service (email) | request-response | `src/lib/rsshub.ts` (fetch + typed error) | role-match |
| `src/app/api/auth/[...nextauth]/route.ts` | new | api-route (auth handlers) | request-response | `src/app/api/health/route.ts` + `src/app/api/revalidate/route.ts` | role-match |
| `src/server/actions/favorites.ts` | new | server-action | CRUD | — (first server action) | no-analog (use Next.js 15 `'use server'` convention; layered per Phase 2 pattern like `src/lib/feed/get-feed.ts` deps injection) |
| `src/server/actions/votes.ts` | new | server-action | CRUD (3-state toggle) | — | no-analog (same as favorites.ts; D-12 state machine is unique) |
| `src/lib/user-actions/favorites-core.ts` (optional) | new | pure core-logic | CRUD | `src/lib/feed/get-feed.ts` (deps-injected pure fn) | exact |
| `src/lib/user-actions/votes-core.ts` (optional) | new | pure core-logic | CRUD | `src/lib/feed/get-feed.ts` | exact |
| `src/components/feed/login-prompt-modal.tsx` | modified | client-component | form → server-action | `src/components/feed/login-prompt-modal.tsx` (self, stub) + `src/components/feed/filter-popover.tsx` (form + state) | exact (self) |
| `src/components/feed/feed-card-actions.tsx` | modified | client-component | optimistic CRUD | `src/components/feed/feed-card-actions.tsx` (self, stub) | exact (self) |
| `src/components/layout/user-chip.tsx` | modified | client-component | event-dispatch + popover | `src/components/layout/user-chip.tsx` (self, stub) + `src/components/feed/filter-popover.tsx` (native `<dialog>` popover) | exact (self) |
| `src/components/layout/icon.tsx` | modified | type union | N/A | `src/components/layout/icon.tsx` (self) | exact |
| `src/app/(reader)/favorites/page.tsx` | modified | RSC page | auth-gated query | `src/app/(reader)/all/page.tsx` (pagination + feed query) + `src/app/(reader)/favorites/page.tsx` (self, stub) | exact (self + `/all`) |
| `next.config.ts` | modified | config | N/A | `next.config.ts` (self) | exact |
| `.env.example` | modified | config | N/A | `.env.example` (self) | exact |
| `docs/auth-providers.md` | new | runbook | N/A | `docs/vercel.md` + `docs/database.md` (existing runbooks) | role-match |
| `tests/lib/auth/config.test.ts` | new | unit test | assertion | `src/lib/feed/get-feed.test.ts` (vitest mocks) | role-match |
| `tests/server/actions/favorites.test.ts` | new | unit test | assertion | `src/lib/feed/get-feed.test.ts` | role-match |
| `tests/server/actions/votes.test.ts` | new | unit test | assertion | `src/lib/feed/get-feed.test.ts` | role-match |
| `tests/e2e/login-modal.spec.ts` | new | E2E test | playwright | `tests/e2e/all.spec.ts` + `tests/e2e/filters.spec.ts` | role-match |
| `tests/e2e/favorite-toggle.spec.ts` | new | E2E test | playwright | `tests/e2e/filters.spec.ts` | role-match |
| `tests/e2e/sign-out.spec.ts` | new | E2E test | playwright | `tests/e2e/all.spec.ts` | role-match |
| `tests/e2e/vote-honest-copy.spec.ts` | new | E2E test | playwright | `tests/e2e/all.spec.ts` | role-match |
| `tests/e2e/anonymous-gated-action.spec.ts` | new | E2E test | playwright | `tests/e2e/filters.spec.ts` | role-match |
| `tests/helpers/seed-session.ts` | new | test helper | db seed | `drizzle/seed-sources.ts` (if present) or fresh | no-analog |

---

## Pattern Assignments

### 1. `src/lib/db/schema.ts` — extend `users`, add adapter tables

**Analog:** `src/lib/db/schema.ts` lines 128–173 (existing `users`, `favorites`, `votes`)

**Copy verbatim — existing users table shape (lines 129–138):**
```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'),
  isBanned: boolean('is_banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});
```

**Extend** (per CONTEXT D-02) by adding two nullable columns inside this `pgTable('users', {...})` block — keep position before `createdAt` for readability; Postgres column order is cosmetic:
```typescript
emailVerified: timestamp('email_verified', { withTimezone: true }),
image: text('image'),
```

**Add new adapter tables at bottom of file**, mirroring the `favorites` + `votes` composite-PK convention (schema.ts lines 140–173) and reusing the `uuid('user_id').references(() => users.id, { onDelete: 'cascade' })` idiom already used in `favorites` (line 144). Column names for adapter tables MUST be camelCase-in-TS, camelCase-in-SQL-quoted (e.g. `"userId"`) per `@auth/drizzle-adapter`'s contract — this is the ONE place the project departs from snake_case SQL:

```typescript
// Phase 5 — Auth.js adapter tables (do not rename columns; adapter expects these exact names)
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

**Imports already present at top of schema.ts (lines 4–19):** `pgTable, text, boolean, integer, timestamp, uuid, primaryKey, index`. No new imports needed.

---

### 2. `drizzle/0004_auth.sql` — migration

**Analog:** `drizzle/0003_hnsw_index_and_settings_seed.sql` (entire file — 15 lines)

**Copy the header-comment pattern verbatim (lines 1–6):**
```sql
-- Phase 3 migration — adds HNSW index on items.embedding (CLUST-02) and seeds
-- the cluster threshold setting (CLUST-04).
-- Hand-authored (not drizzle-kit generated) because Drizzle's index DSL does not
-- yet emit HNSW + vector_cosine_ops + WITH (m, ef_construction). Mirrors the
-- precedent in 0000_enable_pgvector.sql.
-- Source: 03-RESEARCH.md §Pattern 2 + §Pitfall 5, neon.com/docs/extensions/pgvector
```

**Copy FK-with-cascade pattern from `0001_initial_schema.sql` (line 122):**
```sql
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
```

Applied to Phase 5 (inline REFERENCES is equivalent; choose either — inline is shorter and matches RESEARCH §Pitfall 2 guidance to use UUID FK):

```sql
-- Phase 5 migration — adds Auth.js adapter tables (accounts, sessions,
-- verification_tokens) and extends users with email_verified + image.
-- Hand-authored (Phase 3 precedent) because:
--   (a) @auth/drizzle-adapter expects camelCase SQL column names (e.g. "userId")
--       which drift from the project's snake_case convention — worth pinning explicitly.
--   (b) The FK must be uuid → uuid (Research §Pitfall 2); a plain copy-paste of the
--       Auth.js default docs schema uses text() and fails here.
-- Source: 05-RESEARCH.md §Pattern 1 + §Pitfall 2, authjs.dev/getting-started/adapters/drizzle

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

**Also append to `drizzle/meta/_journal.json`** (copy entry shape from lines 26–32):
```json
{
  "idx": 4,
  "version": "7",
  "when": <unix-ms>,
  "tag": "0004_auth",
  "breakpoints": true
}
```

---

### 3. `src/lib/auth/config.ts` + `src/lib/auth/index.ts` — Auth.js singleton

**Analog (role-only):** `src/lib/db/client.ts` — canonical singleton-export pattern

**Copy the top-of-file explainer + named-export pattern from `client.ts`:**
```typescript
// src/lib/db/client.ts (lines 1–15)
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export { schema };
```

**Applied pattern for `src/lib/auth/index.ts`:** single file exports the singleton; other modules import `{ auth, signIn, signOut, handlers }` from `@/lib/auth`. Split the config into a separate `./config.ts` so tests can import the raw `authConfig` for shape assertions (mirrors how `schema.ts` is split from `client.ts`).

**Config body** — see `05-RESEARCH.md` §Pattern 1 lines 292–376 (full verbatim config; do NOT duplicate here to avoid drift — planner MUST copy that block verbatim).

**Comment header (mirror the `/** ... */` JSDoc style used in every Phase 4 file, see `login-prompt-modal.tsx` lines 3–24):**
```typescript
/**
 * Auth.js v5 configuration — Phase 5 AUTH-01..08.
 *
 * Exports `authConfig` (providers, adapter, callbacks, events).
 * Database session strategy (D-03) with two-layer ban enforcement (D-05).
 * Consumed by:
 *   - src/lib/auth/index.ts (NextAuth(authConfig) → handlers/auth/signIn/signOut)
 *   - tests/lib/auth/config.test.ts (shape assertions)
 */
```

---

### 4. `src/lib/auth/magic-link-email.ts` — Chinese Resend template

**Analog:** `src/lib/rsshub.ts` — typed-error + fetch pattern (same file is cited in `api/health/route.ts` at `import { fetchRSSHub, RSSHubError } from '@/lib/rsshub';`)

**Copy pattern: export a named function + a named error class; never read `process.env` inside the function.** RESEARCH §Pattern 2 body (lines 386–424) is the verbatim source.

**Pure-logic / injected-deps pattern — copy from `src/lib/feed/get-feed.ts` lines 51–55:**
```typescript
export interface GetFeedDeps {
  db?: typeof realDb;
  redis?: typeof realRedis;
  now?: () => Date;
}
```
Apply:
```typescript
export interface SendMagicLinkDeps {
  fetch?: typeof globalThis.fetch;
}
```
Lets `tests/lib/auth/magic-link-email.test.ts` inject a mock fetch and assert the Chinese subject/body are on the wire.

---

### 5. `src/app/api/auth/[...nextauth]/route.ts` — handler route

**Analog:** `src/app/api/health/route.ts` lines 101–129 + `src/app/api/revalidate/route.ts` lines 41–78

**Copy the runtime pragma + export shape.** From `health/route.ts` lines 23–25:
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Phase 5 route is simpler** — just re-export `handlers.GET` and `handlers.POST` (see RESEARCH §`/api/auth/[...nextauth]/route.ts` lines 840–845):
```typescript
/**
 * Auth.js v5 route handler — delegates GET/POST to NextAuth(authConfig).handlers.
 * runtime = 'nodejs' required — @auth/drizzle-adapter uses Node-only APIs
 * (crypto.randomUUID for sessionToken generation).
 */
export const runtime = 'nodejs';
export { GET, POST } from '@/lib/auth';
```

The existing `api/health/route.ts` `runtime = 'nodejs'` header-comment convention (lines 7–16) is the model to copy for the explainer.

---

### 6. `src/server/actions/favorites.ts` + `src/server/actions/votes.ts`

**Analog:** `src/lib/feed/cache-invalidate.ts` (closest role match — backend mutation with deps injection + graceful error handling) + `src/lib/feed/get-feed.ts` (deps injection pattern)

**Copy deps-injection pattern from `cache-invalidate.ts` lines 18–21:**
```typescript
export interface InvalidateDeps {
  redis?: typeof realRedis;
  fetch?: typeof globalThis.fetch;
}
export async function invalidateFeedCache(deps?: InvalidateDeps): Promise<void> {
  const redis = deps?.redis ?? realRedis;
  const fetchFn = deps?.fetch ?? globalThis.fetch;
  // ...
}
```

**Phase 5 adaptation — server actions must live in a file with `'use server'` at the top-of-file.** This is a new convention for the project (RESEARCH Standard Stack §§Architecture Patterns — no prior server action exists). Recommended split per CONTEXT §Established Patterns "core-logic / adapter split":

- `src/server/actions/favorites.ts` (thin, `'use server'`) — calls into…
- `src/lib/user-actions/favorites-core.ts` (pure, deps-injected) — does the DB work

This lets `tests/server/actions/favorites.test.ts` import the core function with mock db + mock auth() without having to stub `'use server'`. Mirrors how `src/app/(reader)/all/page.tsx` (RSC thin caller) consumes `src/lib/feed/get-feed.ts` (pure, testable).

**Server-action file skeleton (copy structure from RESEARCH §Pattern 6 lines 549–608, verbatim):**
```typescript
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { favorites, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

async function requireLiveUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  const [row] = await db.select({ isBanned: users.isBanned })
    .from(users).where(eq(users.id, session.user.id));
  if (!row || row.isBanned) throw new Error('FORBIDDEN');
  return session.user.id;
}
```

**JSDoc header convention — copy from `src/lib/feed/cache-invalidate.ts` lines 1–15:**
```typescript
/**
 * Server actions: favoriteItem / unfavoriteItem — Phase 5 FAV-01, FAV-02.
 *
 * 'use server' — called from FeedCardActions client boundary.
 * Guards: session required (Auth.js v5 auth()); users.is_banned re-checked
 * defensively (D-05 Layer 2) even though the session callback clears banned
 * sessions at Layer 1.
 *
 * Consumed by:
 *   - src/components/feed/feed-card-actions.tsx
 */
```

**`revalidatePath` import — same as `src/app/api/revalidate/route.ts` line 19:**
```typescript
import { revalidatePath } from 'next/cache';
```

---

### 7. `src/app/(reader)/favorites/page.tsx` — authenticated RSC

**Analog (closest):** `src/app/(reader)/all/page.tsx` (pagination + Drizzle query) + `src/app/(reader)/favorites/page.tsx` (self, existing stub for force-dynamic + FeedTopBar)

**Preserve verbatim from existing stub** (`favorites/page.tsx` lines 13, 16, 20–21):
```typescript
import { FeedTopBar } from '@/components/feed/feed-top-bar';
export const dynamic = 'force-dynamic';
// ...
<FeedTopBar view="favorites" pathname="/favorites" />
```

**Copy auth-gate pattern from RESEARCH §Pattern 4 (lines 458–480)** — but planner chooses between `redirect('/')` and the existing `<FavoritesEmpty />` component (CONTEXT D-15). The existing `favorites-empty.tsx` is already a working 登录-CTA client island that dispatches `open-login-modal`, so reusing it is literally zero net new code. Recommended: render `<FavoritesEmpty />` when `!session` (preserves phase-4 empty-state UX), `redirect('/')` is the fallback.

**Copy Drizzle join-query pattern from `src/lib/feed/get-feed.ts` lines 106–129 (select-from-join-where-orderBy-limit-offset):**
```typescript
const rows = await db
  .select({ /* columns */ })
  .from(items)
  .leftJoin(clusters, eq(clusters.id, items.clusterId))
  .leftJoin(sources, eq(sources.id, items.sourceId))
  .where(whereClause)
  .orderBy(desc(items.publishedAt))
  .limit(PAGE_SIZE)
  .offset((params.page - 1) * PAGE_SIZE);
```

Applied to `/favorites`:
```typescript
const rows = await db
  .select({ /* FeedListItem shape — reuse shape from get-feed.ts */ })
  .from(favorites)
  .innerJoin(items, eq(items.id, favorites.itemId))
  .leftJoin(sources, eq(sources.id, items.sourceId))
  .leftJoin(clusters, eq(clusters.id, items.clusterId))
  .where(and(eq(favorites.userId, session.user.id), eq(items.status, 'published')))
  .orderBy(desc(favorites.createdAt));
```

**Card rendering — copy `<Timeline items={items} />` line from `all/page.tsx` line 68.** No new card variant needed (per CONTEXT D-15).

**Pagination — copy the nuqs + Link pattern from `all/page.tsx` lines 69–91 verbatim** if the planner wants pagination. Otherwise omit per CONTEXT D-15 (load-latest-50 acceptable).

---

### 8. `src/components/feed/login-prompt-modal.tsx` — extend in place

**Analog:** self (the file's own Phase 4 stub, lines 1–123)

**PRESERVE verbatim:**
- The `'use client';` directive (line 1)
- The `open-login-modal` event listener + useEffect pattern (lines 32–42)
- The native `<dialog>` element + `ref.current?.showModal()` focus-trap pattern (lines 29–31, 47–71)
- The `onKeyDown` Escape + backdrop click-to-close (lines 52–61)
- Inline styles on the `<dialog>` (lines 62–71)
- Heading/body copy (lines 85, 98)
- Dismiss button (lines 111–113)

**ADD (per UI-SPEC §Component Inventory + §Copywriting Contract):**
- GitHub button — accent variant, `form` wrapping `Button` with `formAction={signIn.bind(null, 'github')}` (App-Router server-action pattern; see RESEARCH §Anti-Patterns — do NOT import `signIn` from `'next-auth/react'`)
- Email `<form>` with `<input type="email" autocomplete="email">` + accent submit, formAction wrapping `signIn('resend', ...)`
- Divider `其他方式` + Google button (secondary variant)
- Success state (useState) replacing form content with `检查邮箱` copy
- Error state (useState) — inline `role="alert"` container

**Copy `Button` import + variant usage from the existing file (lines 27, 111–118):**
```typescript
import { Button } from '@/components/layout/button';
<Button variant="accent" size="md">登录</Button>
<Button variant="ghost" size="md" onClick={close}>稍后再说</Button>
```
Extend with `variant="secondary" size="lg"` for Google (Button size "lg" = 40px height per `button.tsx` lines 14–18, which UI-SPEC calls out as matching the 40px provider button contract).

**A11y additions** per UI-SPEC §Accessibility Contracts — add `role="status"` on the success container and `role="alert"` on error container. The `aria-labelledby="login-modal-heading"` already present on the `<dialog>` (line 49) stays unchanged.

---

### 9. `src/components/feed/feed-card-actions.tsx` — extend in place

**Analog:** self (Phase 4 stub, lines 1–106)

**PRESERVE verbatim:**
- `'use client'` + JSDoc header (lines 1–14)
- `IconButton` import from `@/components/layout/icon-button` (line 16)
- `domainOf(url)` helper (lines 23–29)
- Three `<IconButton>` elements with `icon="star" / "check" / "x"` + `tone` prop (lines 59–79)
- External-link ungated `<a>` + domain footer (lines 82–103)
- Wrapper `<div style={{ marginTop: 14, paddingTop: 12, borderTop: ... }}>` (lines 45–57)

**REPLACE three handlers (lines 64, 71, 78):**
```typescript
onClick={openLoginModal}
```
with session-aware handlers that call server actions via `useOptimistic` — verbatim pattern from RESEARCH §Pattern 5 (lines 487–537).

**ADD new props per RESEARCH §Component Responsibilities:**
```typescript
interface FeedCardActionsProps {
  itemId: string;
  url: string;
  sourceUrl?: string | null;
  // NEW (Phase 5):
  initial?: { favorited: boolean; vote: -1 | 0 | 1 };
  isAuthenticated: boolean; // RSC parent passes session presence — avoids client-side auth fetch per Anti-Pattern
}
```

**Copy `IconButton`'s existing `active` prop behavior from `src/components/layout/icon-button.tsx` lines 26–32, 66:**
```typescript
const ACTIVE_FG: Record<IconButtonTone, string> = {
  accent: 'var(--accent-500)',
  danger: 'var(--danger-500)',
  neutral: 'var(--ink-900)',
};
// usage:
const fgColor = active ? ACTIVE_FG[tone] : 'var(--ink-700)';
```
No change to IconButton itself — Phase 5 just passes `active={optimistic.favorited}` / `active={optimistic.vote === 1}` etc. UI-SPEC §FeedCardActions active-state styling contract requires that the `active` background fill (accent-50 / success-50 / danger-50) be added to IconButton — **that is a modification to IconButton**, not a new component.

**VOTE-03 honest copy constant — define at TOP of the file** per UI-SPEC §Copywriting Contract "defined in a constant at the top of `feed-card-actions.tsx`":
```typescript
const PERSONALIZATION_COPY = '个性化推荐即将上线';
```
Mirrors the project's existing file-scope constants (e.g., `src/components/feed/feed-card.tsx` line 32: `const TZ = 'Asia/Shanghai';` and `src/components/feed/cluster-siblings.tsx` line 24).

**Event-dispatch for anonymous branch — PRESERVE the existing `openLoginModal` helper (lines 18–21):**
```typescript
function openLoginModal() {
  document.dispatchEvent(new CustomEvent('open-login-modal'));
}
```
Call it from the three handlers when `!isAuthenticated` (keeps CONTEXT D-16 "existing seam stays intact").

---

### 10. `src/components/layout/user-chip.tsx` — three-state render

**Analog:** self (Phase 4 stub, lines 1–29) + `src/components/feed/filter-popover.tsx` (native `<dialog>` popover precedent, cross-referenced via `modal-filter.test.tsx`)

**PRESERVE verbatim:**
- `'use client'` + JSDoc header (lines 1–13)
- `Button` import (line 15)
- Anonymous branch render: `<Button variant="ghost" size="sm" onClick={() => document.dispatchEvent(...)}>登录</Button>` (lines 20–25)
- Outer wrapper `<div style={{ margin: '0 12px 12px' }}>` (line 19)

**ADD three-state switching** — see UI-SPEC §Component Inventory §UserChip. The "authenticated" branches need:
1. A session prop: `interface UserChipProps { session: { id: string; name: string | null; image: string | null; email: string } | null }`. RSC parent (`src/components/layout/sidebar.tsx`) will call `auth()` and pass the session down — keeps auth out of the client boundary per RESEARCH §Anti-Patterns.
2. 32px avatar via `next/image` (requires `next.config.ts` `remotePatterns` — see File #13 below)
3. Monogram fallback — copy `SourceDot` pattern verbatim from `src/components/layout/source-dot.tsx` lines 30–58 but adapted to `--accent-100` / `--accent-700` colors and 32px size per UI-SPEC
4. Popover — prefer a native `<dialog>` (anchored positioning is now supported on Chrome/Safari; falls back to `position: absolute` for Firefox). Use the same `ref.current?.showModal()` / `close()` idiom from `login-prompt-modal.tsx` lines 29–44 to get focus-trap + Escape-to-close for free.
5. Sign-out menu item — `onClick={() => signOut()}` (server action import from `@/lib/auth`, NOT from `next-auth/react`).

**Menu/popover ARIA — verbatim from UI-SPEC §Accessibility:**
```
aria-haspopup="menu", aria-expanded={open}, role="menu", role="menuitem"
```

---

### 11. `src/components/layout/icon.tsx` — extend union

**Analog:** self (lines 14–35)

**Copy the exact `IconName` union style (line 14–35) and add two entries per UI-SPEC §Design System:**
```typescript
export type IconName =
  | 'sparkles'
  // ...existing 21 entries...
  | 'tag'
  // NEW (Phase 5):
  | 'log-out'
  | 'user';
```

**Drop SVGs at `public/icons/log-out.svg` and `public/icons/user.svg`** — the directory listing confirms 21 existing icons already live there. Copy from `.design/feed-ui/project/ds/icons/user.svg` if present; hand-author `log-out` to match the feather-style contract (16px outline, `stroke-linecap="round"`, `stroke-width="1.5"`, `currentColor`) — other icons in `public/icons/` are feather-style so stylistic consistency is automatic.

---

### 12. `next.config.ts` — add remotePatterns

**Analog:** self (lines 1–17)

**PRESERVE verbatim (do NOT drop existing serverExternalPackages):**
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
};
```

**ADD images.remotePatterns** (RESEARCH §Pitfall 7):
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};
```

---

### 13. `.env.example` — add new variables

**Analog:** self (the Phase 5 placeholder block already exists under `# --- Authentication (Vercel) --- placeholders; implemented in Phase 5 ---`)

**Copy the existing comment-header convention (one `# --- Group (scope) ---` per section, one blank line between groups).** The Phase 5 block already has:
```
AUTH_SECRET=
AUTH_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
```

**ADD two new vars** (CONTEXT D-19, D-21):
```
AUTH_REDIRECT_PROXY_URL=
# Preview-only. Set in Vercel preview env scope ONLY; unset on production.
# Points preview deployments at production's /api/auth for OAuth callback.
# AUTH_SECRET MUST be byte-identical across production + preview + development.
RESEND_FROM=
# Email sender in "Display Name <email@domain>" format; e.g., "AI Hotspot <noreply@aihotspot.com>"
# For pre-DNS-verification testing, use onboarding@resend.dev.
```

**Remove the "placeholders; implemented in Phase 5" note on the block heading** — replace with the same "required at runtime" framing other sections use (e.g., `# --- Database (Vercel + Trigger.dev) ---`).

---

### 14. Tests — unit + E2E

**Unit test analog:** `src/lib/feed/get-feed.test.ts` lines 1–58

**Copy vitest setup pattern (line 7):**
```typescript
import { describe, expect, it, vi, type Mock } from 'vitest';
```

**Copy manual-mock pattern from `get-feed.test.ts`** — inject `db`, `redis`, `now` via the deps interface. Phase 5 server-action tests inject `db` + a mocked `auth()` (via `vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))`). **Test files live under `tests/`** (per the Wave 0 Gaps list), NOT co-located with the module. This DEPARTS from the Phase 4 convention of co-located `feed-card.test.tsx` — the planner should pick ONE convention and document it. Existing co-located tests: `src/lib/feed/get-feed.test.ts`, `src/components/feed/feed-card.test.tsx`. Existing `tests/` tree is E2E only. Recommendation: keep unit tests co-located (simpler, matches Phase 4), keep E2E in `tests/e2e/`. Align the RESEARCH §Wave 0 paths accordingly.

**E2E test analog:** `tests/e2e/all.spec.ts` (lines 1–9) + `tests/e2e/filters.spec.ts` (lines 1–22)

**Copy playwright test structure verbatim:**
```typescript
import { test, expect } from '@playwright/test';

test('AUTH-xx: description', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '...' })).toBeVisible();
});
```

For seeded-session E2E tests, use `storageState` per playwright docs — implement `tests/helpers/seed-session.ts` that inserts a row into the real `sessions` table (Neon test branch) and returns the cookie value for `storageState`. No analog in the repo — fresh implementation.

---

### 15. `docs/auth-providers.md` — runbook

**Analog:** `docs/vercel.md` + `docs/database.md` (existing runbook precedent under `docs/`)

Copy the existing docs style (couldn't read full contents here — planner should `cat docs/vercel.md docs/database.md` as model). Required sections per CONTEXT Claude's Discretion + RESEARCH §Runtime State Inventory:
1. GitHub OAuth app creation + callback URL registration (production URL only)
2. Google OAuth app creation
3. Resend domain verification (DNS SPF + DKIM)
4. Vercel env-var scope matrix (AUTH_SECRET shared across prod+preview+dev — **CRITICAL**)
5. Admin role promotion SQL (CONTEXT §Deferred §Admin bootstrap) — `UPDATE users SET role='admin' WHERE email='...';`
6. Preview OAuth smoke test steps

---

## Shared Patterns

### Shared Pattern A: JSDoc file header
**Source:** every Phase 4 file (e.g., `src/components/feed/login-prompt-modal.tsx` lines 3–24, `src/components/feed/feed-card-actions.tsx` lines 3–14, `src/lib/feed/get-feed.ts` lines 1–11)
**Apply to:** every new Phase 5 file

Verbatim shape:
```typescript
/**
 * <Component name> — Phase <N> <REQ-ID>, D-<decision number>.
 *
 * <One-paragraph explanation of behavior + key decision rationale.>
 *
 * Consumed by:
 *   - <file1>
 *   - <file2>
 */
```

### Shared Pattern B: `'use client'` placement
**Source:** `src/components/layout/icon-button.tsx` line 1, `src/components/feed/feed-card-actions.tsx` line 1, `src/components/feed/login-prompt-modal.tsx` line 1, `src/components/layout/user-chip.tsx` line 1
**Apply to:** all modified client components + any new client component

Always at line 1 (before JSDoc), followed by blank line, followed by the JSDoc header.

### Shared Pattern C: Deps-injected pure functions
**Source:** `src/lib/feed/get-feed.ts` lines 51–74 + `src/lib/feed/cache-invalidate.ts` lines 18–31
**Apply to:** `src/lib/auth/magic-link-email.ts`, `src/lib/user-actions/*-core.ts`, any new pure module under `src/lib/`

```typescript
export interface FooDeps {
  db?: typeof realDb;
  // ... any injectable dep
}
export async function foo(params: FooParams, deps?: FooDeps): Promise<FooResult> {
  const db = deps?.db ?? realDb;
  // ...
}
```
Makes unit tests possible without `vi.mock` gymnastics. This is the CONTEXT §Established Patterns "core-logic / adapter split" concretely applied.

### Shared Pattern D: `document.dispatchEvent(new CustomEvent('open-login-modal'))`
**Source:** three call sites — `src/components/feed/feed-card-actions.tsx:20`, `src/components/layout/user-chip.tsx:23`, `src/components/feed/login-prompt-modal.tsx:40` (listener)

**INCONSISTENCY FLAGGED:** `src/app/(reader)/favorites/favorites-empty.tsx:26` uses `window.dispatchEvent` while the other three use `document.dispatchEvent`. The listener at `login-prompt-modal.tsx:40` binds to `document`, so `favorites-empty.tsx` is currently broken (or only works because modern browsers bubble `CustomEvent` up/down across the tree for custom events — actually they don't; `window` and `document` are separate targets). Phase 5 planner MUST either (a) fix `favorites-empty.tsx` to use `document`, or (b) add a second listener on `window` in the modal. Recommendation: fix `favorites-empty.tsx`. Keep the Phase 5 convention = `document.dispatchEvent(new CustomEvent('open-login-modal'))`.

### Shared Pattern E: Chinese copy convention
**Source:** Phase 4 has NO centralized Chinese-copy module. Strings live inline where used (e.g., `src/components/feed/feed-top-bar.tsx:59–67` inlines H1/subtitle; `src/components/feed/login-prompt-modal.tsx:85,98` inlines modal copy).

**Recommendation for Phase 5:** KEEP inline-where-used for Phase 4-style single-use strings (modal heading, UserChip labels). **DO NOT** introduce a new `src/lib/i18n/copy.ts` module — it would be the first such module in the project and requires cross-cutting buy-in best handled in a dedicated phase. **EXCEPTION:** the VOTE-03 personalization copy MUST live as `const PERSONALIZATION_COPY = '个性化推荐即将上线';` at the top of `feed-card-actions.tsx` per UI-SPEC §Copywriting Contract. That's the only constant required.

### Shared Pattern F: Path alias `@/`
**Source:** `tsconfig.json` lines 21–23: `"paths": { "@/*": ["./src/*"] }`
**Apply to:** every import in every new file. Never use relative paths that climb out of the current directory (e.g., `../../lib/db/client`).

### Shared Pattern G: `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` for sensitive routes
**Source:** `src/app/api/health/route.ts:23–25`, `src/app/api/revalidate/route.ts:22–23`, `src/app/(reader)/favorites/page.tsx:16`
**Apply to:** `src/app/api/auth/[...nextauth]/route.ts` (node runtime required by @auth/drizzle-adapter) and `src/app/(reader)/favorites/page.tsx` (preserve existing `export const dynamic = 'force-dynamic'`).

### Shared Pattern H: Migration journal entry
**Source:** `drizzle/meta/_journal.json` lines 4–33 (four existing entries)
**Apply to:** new `0004_auth` journal entry — mirror the `{ idx, version: "7", when: <ms>, tag, breakpoints: true }` shape exactly.

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `src/server/actions/favorites.ts` | server-action | No `'use server'` file exists in the project yet. First Phase 5 server action establishes the convention. Layered pattern (thin action → pure core module) derived from Phase 2/4 "core-logic / adapter split" idiom applied to a new context. |
| `src/server/actions/votes.ts` | server-action | Same — plus the D-12 3-state toggle state machine is a new pattern. |
| `src/lib/auth/config.ts` | auth-config | No prior auth configuration. Follows the singleton-export shape of `src/lib/db/client.ts` but the internal providers/adapter/callbacks body is new. |
| `src/lib/auth/session.ts` | helper | `getSession()` / `requireSession()` wrapper pattern — pure Phase-5-new. |
| `tests/helpers/seed-session.ts` | test helper | No existing E2E helpers directory. Phase 5 introduces `tests/helpers/`. |
| `docs/auth-providers.md` | runbook | No `auth-*.md` runbook precedent; structure mirrors `docs/vercel.md` + `docs/database.md`. |

For these files the planner should use `05-RESEARCH.md` §Pattern 1, §Pattern 2, §Pattern 5, §Pattern 6 as the authoritative source (verbatim code blocks).

---

## Metadata

**Analog search scope:**
- `src/app/(reader)/**/*.tsx` (4 pages)
- `src/app/api/**/route.ts` (3 routes)
- `src/lib/db/*.ts` (2 files)
- `src/lib/feed/*.ts` (10 files)
- `src/lib/redis/*.ts` (1 file)
- `src/components/feed/*.tsx` (13 files + 3 tests)
- `src/components/layout/*.tsx` (14 files)
- `drizzle/**/*.sql` (4 migrations + journal)
- `tests/e2e/*.spec.ts` (6 specs)
- `next.config.ts`, `.env.example`, `drizzle.config.ts`, `package.json`, `tsconfig.json`

**Files scanned:** ~55

**Pattern extraction date:** 2026-04-23
