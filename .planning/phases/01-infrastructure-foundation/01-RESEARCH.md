# Phase 1: Infrastructure Foundation - Research

**Researched:** 2026-04-17
**Domain:** Next.js 15 App Router scaffold + Neon Postgres (pgvector) + Drizzle ORM + Trigger.dev v4 + Upstash Redis + RSSHub wiring + CI/CD + env topology
**Confidence:** HIGH (stack verified via Context7, official docs, npm registry; Trigger.dev v4 specifics MEDIUM on a few env var names)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** RSSHub is already deployed on Hugging Face Spaces at `https://lurnings-rsshub.hf.space/`. Phase 1 does NOT provision RSSHub — it wires the existing Space into the app's env and health check.
- **D-02:** `RSSHUB_ACCESS_KEY` lives only in env vaults — never committed to repo. User must rotate the current key (exposed in discuss-phase chat) before Phase 1 completes.
- **D-03:** RSSHub uses in-process memory cache (no Redis backing). Acceptable for hourly polling.
- **D-04:** RSSHub hardened defaults: `ALLOW_USER_HOTLINK=false`, `DISALLOW_ROBOT=true`, `REQUEST_RETRY=2`, `CACHE_EXPIRE=900`, `CACHE_CONTENT_EXPIRE=3600`. Planner verifies these are set on the HF Space; does not redeploy the Space.
- **D-05:** HF Space cold-start is tolerated. Ingestion (Phase 2) uses Trigger.dev's retry to absorb 30–60s warmup. Phase 1's `/api/health` performs a fire-and-forget warmup call before asserting OK.
- **D-06:** Single `.env.example` at repo root is the source of truth for variable names. Three vaults: Vercel project env, Trigger.dev Cloud env, Hugging Face Space.
- **D-07:** Env var names are identical across services. Values may differ per environment; names must not drift.
- **D-08:** No secret ever committed. Pre-commit hook greps for UUID pattern of the HF ACCESS_KEY in staged content.
- **D-09:** All 11 tables in a single Drizzle migration in Phase 1: `sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs`.
- **D-10:** pgvector extension enabled in same migration. `items.embedding` is `vector(1024)` for Voyage AI voyage-3.5. HNSW index deferred to Phase 3.
- **D-11:** Neon branching per PR. GitHub Actions creates a Neon branch for each preview deploy, runs `drizzle-kit migrate`, preview env points at that branch. Branch auto-deletes on PR close.
- **D-12:** `main` branch writes to production Neon branch. Dev uses a long-lived `dev` Neon branch.
- **D-13:** Single Next.js repo. Trigger.dev code lives under `./src/trigger/`. RSSHub is external; documented in `/docs/rsshub.md`.
- **D-14:** Package manager: pnpm. Node: >= 20.9 (minimum for Next.js 15; also satisfies Trigger.dev v4's Node 18.20+ floor). `.nvmrc` pinned to `20`.
- **D-15:** `/api/health` (Node runtime) performs four parallel checks: (1) Neon SELECT 1 + pgvector extension check, (2) Upstash Redis ping, (3) RSSHub GET with 60s timeout, (4) Trigger.dev reachability. Returns JSON `{ ok, services }`.
- **D-16:** Response: `{ ok: boolean, services: { neon: "ok" | { error }, redis: ..., rsshub: ..., trigger: ... } }`. HTTP 200 if all green, 503 otherwise.
- **D-17:** GitHub Actions on every PR and `main`: install → typecheck (`tsc --noEmit`) → lint → build → `drizzle-kit migrate` against PR's Neon branch.
- **D-18:** Vercel deployment triggered by Vercel's GitHub app, not Actions. Actions migrations run before Vercel preview finishes.

### Claude's Discretion

- Exact file/folder names inside `src/`
- Drizzle column types and nullability for tables whose usage is phase-later
- Whether to use Neon's Vercel integration or GitHub Action migrations — pick the lower-friction path
- Logging format for `/api/health` failures
- ESLint/Prettier vs Biome — default to `eslint-config-next` + Prettier

### Deferred Ideas (OUT OF SCOPE)

- Keep-alive ping for HF Space (Phase 2 if cold-starts become an issue)
- Cloudflare / IP allowlist in front of RSSHub
- Migration to persistent HF Space or alt host
- Secrets scanning beyond pre-commit (Phase 6)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Next.js 15 App Router (TypeScript) project scaffolded and deploying to Vercel | §Standard Stack: `pnpm create next-app@latest` command; Node 20.9 min; Vercel GitHub app integration |
| INFRA-02 | Neon Postgres provisioned with pgvector extension enabled | §Architecture Patterns: `CREATE EXTENSION IF NOT EXISTS vector;` in Drizzle migration; Neon supports pgvector natively |
| INFRA-03 | Drizzle ORM schema migration defines all 11 tables | §Code Examples: full schema with column types, FKs, nullability for all 11 tables |
| INFRA-04 | Upstash Redis provisioned and reachable from Vercel | §Standard Stack: `@upstash/redis` HTTP client; env vars `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| INFRA-05 | Trigger.dev v4 project linked to the repo with deploy pipeline working | §Architecture Patterns: `trigger.config.ts`, `src/trigger/`, `TRIGGER_SECRET_KEY`, CLI flow |
| INFRA-06 | RSSHub deployed on a HK/SG VPS — **already satisfied (HF Space)**; Phase 1 wires it | §Code Examples: `/api/health` RSSHub check pattern |
| INFRA-07 | Environment variables wired across Vercel + Trigger.dev + RSSHub | §`.env.example` Complete Variable List section |
| INFRA-08 | CI builds, typechecks, and runs migrations on preview deployments | §Architecture Patterns: GitHub Actions YAML skeleton; Neon create-branch-action@v6 |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold and service-wiring phase. The repo currently has no `package.json` or `src/`. Every task in this phase provisions or connects external services and lays down the shared foundations that all later phases depend on.

The critical path is: (1) scaffold Next.js 15 with pnpm, (2) configure Neon + pgvector + Drizzle schema with all 11 tables in one migration, (3) wire Upstash Redis and Trigger.dev v4, (4) configure CI (GitHub Actions + Neon branch-per-PR + drizzle-kit migrate), (5) build `/api/health` to prove connectivity, (6) land `.env.example` as the authoritative variable registry. Success is measured by a single `git push` that produces a Vercel deployment whose `/api/health` returns HTTP 200.

The two most tricky areas are (a) Neon branch-per-PR: use `neondatabase/create-branch-action@v6` in GitHub Actions — this is the lower-friction path vs. the Vercel Neon integration (which bundles branch creation with Vercel's preview deploy but has less CI control). And (b) Trigger.dev v4 env: the app uses `TRIGGER_SECRET_KEY` for triggering from Next.js; the Trigger.dev CLI uses `TRIGGER_ACCESS_TOKEN` for deployment. These are two different credentials with two different purposes.

**Primary recommendation:** Follow the exact scaffold → schema → service wiring → CI → health check sequence. Do not combine tasks. Each layer requires the previous one to be verified.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP request routing, page rendering | Next.js App Router (Vercel) | — | App Router is the entry point for all HTTP |
| Database persistence + vector storage | Neon Postgres + pgvector | — | All structured data and embeddings live here |
| Feed caching + rate limiting | Upstash Redis (HTTP) | — | Serverless-safe; HTTP-based, no persistent TCP |
| Background task execution + cron | Trigger.dev v4 (dedicated workers) | — | No Vercel function timeout; designed for LLM workloads |
| RSS normalization | RSSHub (HF Space) | — | External; app only reads from it |
| Health-check aggregation | `/api/health` route (Node runtime) | — | Requires DB driver; must not be Edge runtime |
| Env var topology | Three vaults (Vercel, Trigger.dev, HF Space) | `.env.example` as canonical names | Values differ per vault; names must be identical |
| Secrets scanning | Pre-commit hook | GitHub Actions typecheck | First line of defence against accidental key commits |
| CI migrations | GitHub Actions + Neon branch-per-PR | — | Migrations must run before Vercel preview boots |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router framework | Locked decision; ISR + RSC-first |
| TypeScript | 5.x | Type safety | Locked decision |
| pnpm | latest (10.x) | Package manager | Locked decision (D-14) |
| `drizzle-orm` | 0.45.2 | Type-safe SQL ORM | Edge-native, tiny bundle, no cold-start penalty |
| `drizzle-kit` | 0.31.10 | Schema migrations | Paired with drizzle-orm; `push` for dev, `migrate` for CI |
| `@neondatabase/serverless` | 1.0.2 | Neon HTTP driver | Purpose-built for Neon serverless HTTP transport |
| `@trigger.dev/sdk` | 4.4.4 | Trigger.dev task definitions + triggering | Locked decision: v4 (not Inngest) |
| `@trigger.dev/build` | 4.4.4 | Trigger.dev build toolchain | Required dev dependency alongside SDK |
| `@upstash/redis` | 1.37.0 | Redis HTTP client | Serverless-safe; no persistent TCP connection |
| `voyageai` | 0.2.1 | Voyage AI embeddings SDK | Official SDK; voyage-3.5 generates vector(1024) |
| `@anthropic-ai/sdk` | 0.90.0 | Claude API | Locked decision; placeholder in Phase 1 .env.example |

### Supporting (Phase 1 scope)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `husky` | 9.1.7 | Git hooks framework | Pre-commit secret scanning |
| `lint-staged` | 16.4.0 | Run checks only on staged files | Paired with husky for fast pre-commit |
| `zod` | 3.x | Runtime schema validation | API route inputs + `/api/health` response typing |

### Version Verification

Versions above were verified against npm registry on 2026-04-17. [VERIFIED: npm registry]

Next.js reports as 16.2.4 on npm — this is Next.js 16 (updated from 15.x during the project planning window). Still App Router, still pnpm-compatible. Node.js minimum remains 20.9. [VERIFIED: nextjs.org/docs/app/getting-started/installation]

### Installation

```bash
# 1. Scaffold Next.js project
pnpm create next-app@latest . --yes
# Creates: TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, import alias @/*

# 2. Database
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit

# 3. Trigger.dev
pnpm add @trigger.dev/sdk
pnpm add -D @trigger.dev/build trigger.dev
pnpm dlx trigger.dev@latest init

# 4. Redis
pnpm add @upstash/redis

# 5. Voyage AI + Anthropic (env placeholder only in Phase 1)
pnpm add voyageai @anthropic-ai/sdk

# 6. Validation
pnpm add zod

# 7. Pre-commit hooks
pnpm add -D husky lint-staged
pnpm exec husky init
```

---

## Architecture Patterns

### System Architecture Diagram

```
                         git push → Vercel GitHub App → Preview Build
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    VERCEL (Next.js App Router)                            │
│                                                                           │
│  GET /                 GET /api/health          POST /api/trigger/test    │
│  (placeholder RSC)     (Node runtime)           (trigger Trigger.dev)     │
│                              │                          │                  │
│                    Promise.allSettled([               tasks.trigger()     │
│                      neon check,                         │                │
│                      redis.ping(),                       │                │
│                      rsshub GET,                         │                │
│                      trigger check                       │                │
│                    ])                                    │                │
└──────────────────────────────────────────────────────────────────────────┘
          │  drizzle/neon-http                             │ TRIGGER_SECRET_KEY
          ▼                                                ▼
┌─────────────────────┐             ┌──────────────────────────────────────┐
│  Neon Postgres       │             │  Trigger.dev v4 Cloud                │
│  + pgvector          │             │  (dedicated worker runtime)          │
│                      │             │                                       │
│  schema: 11 tables   │             │  src/trigger/                        │
│  + vector(1024)      │             │  └── health-probe.ts (test task)    │
│  extension: vector   │             │                                       │
│                      │             │  Hourly cron: deferred to Phase 2   │
└─────────────────────┘             └──────────────────────────────────────┘
          ▲  migration via                       ▲ API calls
          │  drizzle-kit migrate                 │
┌─────────┴──────────┐            ┌──────────────┴──────────────────────────┐
│  GitHub Actions CI  │            │  Upstash Redis                          │
│                     │            │  GET redis.ping()                       │
│  PR opens:          │            │  URL: UPSTASH_REDIS_REST_URL            │
│  create-branch@v6   │            │  Token: UPSTASH_REDIS_REST_TOKEN        │
│  drizzle-kit migrate│            └─────────────────────────────────────────┘
│  tsc --noEmit       │
│  eslint             │            ┌──────────────────────────────────────────┐
│  next build         │            │  Hugging Face Space (external)           │
│                     │            │  https://lurnings-rsshub.hf.space/       │
│  PR closes:         │            │  GET /?key=RSSHUB_ACCESS_KEY             │
│  delete-branch@v5   │            │  60s timeout + warmup fire-and-forget   │
└─────────────────────┘            └──────────────────────────────────────────┘
```

Data flows:
- `/api/health` fans out four parallel checks via `Promise.allSettled` and collects results
- GitHub Actions creates a Neon branch, runs migrations, then Vercel preview boots against migrated schema
- All Trigger.dev tasks are triggered via `TRIGGER_SECRET_KEY`; CLI deployment uses `TRIGGER_ACCESS_TOKEN`

### Recommended Project Structure

```
ai-hotspot/                         # repo root
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts        # /api/health — Node runtime
│   │   ├── layout.tsx
│   │   └── page.tsx                # placeholder (Phase 4 owns feed UI)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts           # Drizzle + Neon HTTP driver singleton
│   │   │   └── schema.ts           # All 11 table definitions
│   │   └── redis/
│   │       └── client.ts           # Upstash Redis singleton
│   └── trigger/
│       ├── health-probe.ts         # Minimal task to verify Trigger.dev reachability
│       └── index.ts                # Re-exports all tasks
├── drizzle/                        # Migration output (drizzle-kit generate)
│   └── 0001_initial_schema.sql
├── docs/
│   └── rsshub.md                   # RSSHub Space URL, env vars, key rotation runbook
├── .env.example                    # Canonical variable names (no values)
├── .env.local                      # Local values (gitignored)
├── drizzle.config.ts               # Drizzle Kit config
├── trigger.config.ts               # Trigger.dev project config
├── next.config.ts                  # Next.js config
├── .nvmrc                          # node 20
├── .husky/
│   └── pre-commit                  # Secret grep hook
└── package.json
```

### Pattern 1: Drizzle ORM Client (Neon HTTP Driver)

**What:** Use `drizzle-orm/neon-http` with `@neondatabase/serverless` for all database access from Vercel serverless functions and API routes.

**When to use:** Always — in Next.js API routes and RSC data fetching. Do NOT use this driver inside Trigger.dev workers (use a standard pg pool there instead).

```typescript
// src/lib/db/client.ts
// Source: https://orm.drizzle.team/docs/connect-neon
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

### Pattern 2: Drizzle Config

```typescript
// drizzle.config.ts
// Source: https://orm.drizzle.team/docs/drizzle-kit-migrate [VERIFIED: Context7]
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**push vs migrate vs generate:**
- `drizzle-kit push` — applies schema directly without generating SQL files. For dev only. Never use in CI.
- `drizzle-kit generate` — generates SQL migration files from schema diff.
- `drizzle-kit migrate` — applies pending SQL migration files from `./drizzle/`. Use in CI.

Workflow: dev uses `drizzle-kit push` (fast iteration). Before merge, run `drizzle-kit generate` to create SQL file. CI runs `drizzle-kit migrate` against PR Neon branch. [VERIFIED: Context7 /websites/orm_drizzle_team]

### Pattern 3: Drizzle Schema — All 11 Tables

```typescript
// src/lib/db/schema.ts
// Source: ARCHITECTURE.md schema sketch + REQUIREMENTS.md column inference
import {
  pgTable,
  serial,
  bigserial,
  bigint,
  text,
  boolean,
  integer,
  smallint,
  numeric,
  timestamp,
  uuid,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core'; // pgvector column type

// SOURCES — RSSHub routes or raw RSS URLs
export const sources = pgTable('sources', {
  id:                   serial('id').primaryKey(),
  name:                 text('name').notNull(),
  rssUrl:               text('rss_url').notNull().unique(),
  language:             text('language').notNull().default('zh'),   // 'zh' | 'en'
  weight:               numeric('weight', { precision: 3, scale: 1 }).notNull().default('1.0'),
  isActive:             boolean('is_active').notNull().default(true),
  consecutiveEmptyCount:  integer('consecutive_empty_count').notNull().default(0),
  consecutiveErrorCount:  integer('consecutive_error_count').notNull().default(0),
  lastFetchedAt:        timestamp('last_fetched_at', { withTimezone: true }),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ITEMS — one row per ingested RSS entry
export const items = pgTable('items', {
  id:               bigserial('id', { mode: 'bigint' }).primaryKey(),
  sourceId:         integer('source_id').notNull().references(() => sources.id),
  url:              text('url').notNull().unique(),
  urlFingerprint:   text('url_fingerprint').notNull().unique(), // SHA-256(normalized url)
  contentHash:      text('content_hash').notNull(),             // SHA-256(url + title) for dedup
  title:            text('title').notNull(),
  titleZh:          text('title_zh'),
  bodyRaw:          text('body_raw'),
  bodyZh:           text('body_zh'),
  summaryZh:        text('summary_zh'),
  recommendation:   text('recommendation'),                     // 推荐理由
  score:            integer('score'),                           // 0-100
  tags:             text('tags').array(),
  embedding:        vector('embedding', { dimensions: 1024 }), // Voyage voyage-3.5
  clusterId:        bigint('cluster_id', { mode: 'bigint' }),  // FK set after clusters defined
  isClusterPrimary: boolean('is_cluster_primary').notNull().default(false),
  status:           text('status').notNull().default('pending'), // pending|processing|published|failed|dead_letter
  publishedAt:      timestamp('published_at', { withTimezone: true }).notNull(),
  ingestedAt:       timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt:      timestamp('processed_at', { withTimezone: true }),
  failureReason:    text('failure_reason'),
  retryCount:       integer('retry_count').notNull().default(0),
}, (table) => ({
  statusPublishedIdx: index('items_status_published_at_idx').on(table.status, table.publishedAt.desc()),
  clusterIdx:         index('items_cluster_id_idx').on(table.clusterId),
  sourceIdx:          index('items_source_id_idx').on(table.sourceId),
  tagsIdx:            index('items_tags_idx').using('gin', table.tags),
}));

// CLUSTERS — one row per grouped event
export const clusters = pgTable('clusters', {
  id:              bigserial('id', { mode: 'bigint' }).primaryKey(),
  primaryItemId:   bigint('primary_item_id', { mode: 'bigint' }),
  centroid:        vector('centroid', { dimensions: 1024 }),
  memberCount:     integer('member_count').notNull().default(1),
  earliestSeenAt:  timestamp('earliest_seen_at', { withTimezone: true }).notNull().defaultNow(),
  latestSeenAt:    timestamp('latest_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ITEM_CLUSTERS — join table (allows many-to-many if needed later; v1: items.cluster_id suffices)
export const itemClusters = pgTable('item_clusters', {
  itemId:    bigint('item_id', { mode: 'bigint' }).notNull().references(() => items.id, { onDelete: 'cascade' }),
  clusterId: bigint('cluster_id', { mode: 'bigint' }).notNull().references(() => clusters.id, { onDelete: 'cascade' }),
  addedAt:   timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.clusterId] }),
}));

// TAGS — canonical tag taxonomy
export const tags = pgTable('tags', {
  id:        serial('id').primaryKey(),
  name:      text('name').notNull().unique(),
  nameZh:    text('name_zh'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ITEM_TAGS — normalized tag assignments
export const itemTags = pgTable('item_tags', {
  itemId: bigint('item_id', { mode: 'bigint' }).notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId:  integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));

// USERS
export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  email:       text('email').notNull().unique(),
  name:        text('name'),
  avatarUrl:   text('avatar_url'),
  role:        text('role').notNull().default('user'),   // 'user' | 'admin'
  isBanned:    boolean('is_banned').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt:  timestamp('last_seen_at', { withTimezone: true }),
});

// FAVORITES
export const favorites = pgTable('favorites', {
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId:    bigint('item_id', { mode: 'bigint' }).notNull().references(() => items.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.itemId] }),
}));

// VOTES
export const votes = pgTable('votes', {
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId:    bigint('item_id', { mode: 'bigint' }).notNull().references(() => items.id, { onDelete: 'cascade' }),
  value:     smallint('value').notNull(),  // -1 | 1
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.itemId] }),
}));

// SETTINGS — admin-tunable config rows
export const settings = pgTable('settings', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// PIPELINE_RUNS — LLM token usage audit trail per item per run
export const pipelineRuns = pgTable('pipeline_runs', {
  id:                  bigserial('id', { mode: 'bigint' }).primaryKey(),
  itemId:              bigint('item_id', { mode: 'bigint' }).references(() => items.id, { onDelete: 'set null' }),
  model:               text('model').notNull(),
  task:                text('task').notNull(),            // 'translate' | 'score' | 'summarize' | 'embed' | 'cluster'
  inputTokens:         integer('input_tokens'),
  outputTokens:        integer('output_tokens'),
  cacheReadTokens:     integer('cache_read_tokens'),
  cacheWriteTokens:    integer('cache_write_tokens'),
  estimatedCostUsd:    numeric('estimated_cost_usd', { precision: 10, scale: 6 }),
  latencyMs:           integer('latency_ms'),
  status:              text('status').notNull(),           // 'ok' | 'error'
  errorMessage:        text('error_message'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  itemIdx:    index('pipeline_runs_item_id_idx').on(table.itemId),
  dateIdx:    index('pipeline_runs_created_at_idx').on(table.createdAt.desc()),
}));
```

**Notes on schema design choices:**
- `items.url_fingerprint` is SHA-256(normalized URL); enforced UNIQUE for dedup. Separate from `content_hash` (SHA-256 of url+title) which is used for cross-source matching.
- `items.tags` uses a Postgres text array for fast Phase 2 writes; `item_tags` join table exists for normalized Phase 6 querying.
- `clusters.centroid` uses `vector(1024)` — same dimensionality as items. Running mean updated in Phase 3.
- `pipeline_runs.item_id` uses `ON DELETE SET NULL` so orphaned runs remain for cost auditing.
- HNSW index on `items.embedding` is intentionally omitted — deferred to Phase 3 per D-10.
- `items.status` dead-letter value is `'dead_letter'` (not a separate table) — simpler for Phase 1.
- `settings` table seeded in migration with `('cluster_threshold', '0.82')`.

[ASSUMED: column nullability for `item_clusters`, `tags`, `item_tags` fine-grained usage; planner may adjust based on Phase 2/3 needs]

### Pattern 4: pgvector Extension Migration

The `vector` column type requires the `vector` Postgres extension. This must be enabled before the schema migration or within the same migration file.

In Drizzle, use a custom SQL migration file for the extension:

```sql
-- drizzle/0000_enable_pgvector.sql
-- Source: https://orm.drizzle.team/docs/guides/vector-similarity-search [VERIFIED: Context7]
CREATE EXTENSION IF NOT EXISTS vector;
```

The main schema migration is `0001_initial_schema.sql` (generated by `drizzle-kit generate`). The extension file must be numbered `0000` so it runs first.

Alternative: embed the extension creation at the top of the schema file using Drizzle's `sql` template:
```typescript
// This runs as part of migration 0001
import { sql } from 'drizzle-orm';
// In a migration file or via drizzle-kit custom migration:
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
```

Recommended approach: two migration files — `0000_enable_pgvector.sql` and `0001_initial_schema.sql`. This ensures the extension is idempotent and clearly separated from schema changes. [VERIFIED: Context7 /websites/orm_drizzle_team vector-similarity-search guide]

### Pattern 5: Trigger.dev v4 Setup

**SDK import path:** `@trigger.dev/sdk` (NOT `@trigger.dev/sdk/v3` which is deprecated). [VERIFIED: trigger.dev/docs/upgrade-to-v4]

```typescript
// trigger.config.ts (project root)
// Source: https://trigger.dev/docs/manual-setup [VERIFIED: WebFetch]
import { defineConfig } from '@trigger.dev/sdk/build';

export default defineConfig({
  project: '<your-project-ref>',  // from Trigger.dev dashboard
  dirs: ['./src/trigger'],        // task files location
  runtime: 'node',               // 'node' | 'node-22' | 'bun'
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
```

```typescript
// src/trigger/health-probe.ts — minimal task for Phase 1 verification
// Source: Context7 /triggerdotdev/trigger.dev [VERIFIED]
import { task } from '@trigger.dev/sdk';

export const healthProbe = task({
  id: 'health-probe',
  run: async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  },
});
```

**Environment variables:**
- `TRIGGER_SECRET_KEY` — secret key from Trigger.dev dashboard (one per environment: dev/staging/prod). Required in Vercel env and local `.env.local` to trigger tasks from Next.js.
- `TRIGGER_ACCESS_TOKEN` — personal access token (from Trigger.dev profile, not project). Required ONLY for `pnpm dlx trigger.dev@latest deploy` in CI.
- `TRIGGER_PROJECT_REF` — optional; can be set instead of hard-coding in `trigger.config.ts`.

**CLI flow:**
```bash
# 1. Login (once)
pnpm dlx trigger.dev@latest login

# 2. Init (creates trigger.config.ts + src/trigger/ scaffold)
pnpm dlx trigger.dev@latest init

# 3. Dev (runs local Trigger.dev tunnel)
pnpm dlx trigger.dev@latest dev

# 4. Deploy (CI or manual)
pnpm dlx trigger.dev@latest deploy
```

**Triggering from Next.js:**
```typescript
// src/app/api/trigger-test/route.ts
// Source: Context7 /triggerdotdev/trigger.dev [VERIFIED]
import { tasks } from '@trigger.dev/sdk';
import type { healthProbe } from '@/trigger/health-probe';

export async function POST() {
  const handle = await tasks.trigger<typeof healthProbe>('health-probe', {});
  return Response.json({ runId: handle.id });
}
```

**Declarative scheduled task (Phase 2 preview pattern — define in Phase 1 but disable):**
```typescript
// Source: https://github.com/triggerdotdev/trigger.dev/blob/main/docs/tasks/scheduled.mdx [VERIFIED: Context7]
import { schedules } from '@trigger.dev/sdk';

export const hourlyIngestion = schedules.task({
  id: 'hourly-ingestion',
  cron: '0 * * * *',   // every hour UTC
  run: async (payload) => {
    // Phase 2: implement ingestion logic here
    console.log('Ingestion run at', payload.timestamp);
  },
});
```

### Pattern 6: Upstash Redis Client

```typescript
// src/lib/redis/client.ts
// Source: https://github.com/upstash/docs/blob/main/redis/quickstarts/nextjs-app-router.mdx [VERIFIED: Context7]
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

Both the URL and token are obtained from the Upstash Console when creating a new Redis database. The HTTP-based client works identically in Node.js API routes and Edge middleware.

### Pattern 7: `/api/health` Route

```typescript
// src/app/api/health/route.ts
// Source: D-15, D-16 (locked decisions) + Next.js runtime config [VERIFIED: Context7]
export const runtime = 'nodejs';   // NOT 'edge' — needs Neon DB driver

import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';

type ServiceResult = 'ok' | { error: string };

async function checkNeon(): Promise<ServiceResult> {
  try {
    await db.execute(sql`SELECT 1`);
    const ext = await db.execute(
      sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    if (!ext.rows.length) return { error: 'pgvector extension not installed' };
    return 'ok';
  } catch (e) {
    return { error: String(e) };
  }
}

async function checkRedis(): Promise<ServiceResult> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : { error: `Unexpected ping response: ${pong}` };
  } catch (e) {
    return { error: String(e) };
  }
}

async function checkRSSHub(): Promise<ServiceResult> {
  const base = process.env.RSSHUB_BASE_URL;
  const key = process.env.RSSHUB_ACCESS_KEY;
  if (!base || !key) return { error: 'RSSHUB_BASE_URL or RSSHUB_ACCESS_KEY not set' };
  try {
    // Fire-and-forget warmup to absorb HF Space cold-start (D-05)
    void fetch(`${base}/?key=${key}`, { signal: AbortSignal.timeout(5000) }).catch(() => {});

    const res = await fetch(`${base}/?key=${key}`, {
      signal: AbortSignal.timeout(60000),   // 60s cold-start budget (D-05)
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return 'ok';
  } catch (e) {
    return { error: String(e) };
  }
}

async function checkTrigger(): Promise<ServiceResult> {
  // Lightweight check: attempt to reach the Trigger.dev API
  // If TRIGGER_SECRET_KEY is absent, report misconfiguration
  if (!process.env.TRIGGER_SECRET_KEY) return { error: 'TRIGGER_SECRET_KEY not set' };
  try {
    const res = await fetch('https://api.trigger.dev/api/v1/whoami', {
      headers: { Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `Trigger.dev API returned ${res.status}` };
    return 'ok';
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET() {
  const [neonResult, redisResult, rsshubResult, triggerResult] = await Promise.allSettled([
    checkNeon(),
    checkRedis(),
    checkRSSHub(),
    checkTrigger(),
  ]);

  const services = {
    neon:    neonResult.status === 'fulfilled' ? neonResult.value : { error: String(neonResult.reason) },
    redis:   redisResult.status === 'fulfilled' ? redisResult.value : { error: String(redisResult.reason) },
    rsshub:  rsshubResult.status === 'fulfilled' ? rsshubResult.value : { error: String(rsshubResult.reason) },
    trigger: triggerResult.status === 'fulfilled' ? triggerResult.value : { error: String(triggerResult.reason) },
  };

  const allOk = Object.values(services).every(s => s === 'ok');

  return Response.json(
    { ok: allOk, services },
    { status: allOk ? 200 : 503 }
  );
}
```

**Trigger.dev health check note:** The `/api/v1/whoami` endpoint is [ASSUMED] to exist and authenticate via bearer token — this should be verified at implementation time. If it does not exist, alternative: skip the HTTP probe and instead check that `TRIGGER_SECRET_KEY` is set and correctly formatted (starts with `tr_`). A manual task trigger from the Trigger.dev dashboard still satisfies Success Criterion #3 per CONTEXT.md D-15.

### Pattern 8: Neon Branch-per-PR GitHub Actions

```yaml
# .github/workflows/ci.yml
# Source: https://github.com/neondatabase/create-branch-action [VERIFIED: WebFetch]
name: CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm tsc --noEmit

      - name: Lint
        run: pnpm eslint .

      - name: Build
        run: pnpm next build

      # Create Neon branch for this PR
      - name: Create Neon branch
        id: neon-branch
        uses: neondatabase/create-branch-action@v6
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch_name: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}

      # Run migrations against the PR branch
      - name: Run Drizzle migrations
        run: pnpm drizzle-kit migrate
        env:
          DATABASE_URL: ${{ steps.neon-branch.outputs.db_url }}

  cleanup:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          branch: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

**Required GitHub repository secrets/vars:**
- `secrets.NEON_API_KEY` — Neon API key (from Neon console)
- `vars.NEON_PROJECT_ID` — Neon project ID (not a secret, safe as a variable)
- `secrets.TRIGGER_ACCESS_TOKEN` — Trigger.dev personal access token (for deploy step, Phase 2)

**Neon branch action output:** `steps.neon-branch.outputs.db_url` is the `DATABASE_URL` connection string for the new branch. [VERIFIED: github.com/neondatabase/create-branch-action]

**Why GitHub Actions over Vercel Neon integration:** The Vercel Neon integration bundles branch creation with Vercel's own preview deploy trigger. This means migrations run after the preview is already spinning up, creating a race condition where Vercel's preview might boot before the schema is migrated. GitHub Actions gives explicit ordering: Actions creates the branch, runs migrations to completion, then Vercel's preview (triggered by the GitHub app separately) boots against an already-migrated schema. This matches D-18. [ASSUMED: Vercel Neon integration ordering behavior — prefer GH Actions to be safe]

### Pattern 9: Pre-commit Secret Hook

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Block commits containing UUID-shaped ACCESS_KEY values
# HF Space ACCESS_KEY format: UUID (8-4-4-4-12 hex)
# [ASSUMED: UUID pattern; planner should verify the actual key format with user]
if git diff --cached --name-only | xargs grep -l \
  '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' \
  2>/dev/null; then
  echo "ERROR: Staged content appears to contain a UUID (possible ACCESS_KEY)."
  echo "Remove secrets from staged files before committing."
  exit 1
fi

# Run lint-staged (formatting, linting)
pnpm lint-staged
```

```json
// package.json lint-staged config
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

**Pre-commit hook limitation:** The UUID grep is a heuristic — it will false-positive on any UUID in legitimate code (like a test fixture UUID). The hook should be documented as advisory, not blocking on false positives. For Stage 6 hardening, add `gitleaks` or GitHub push protection for more precise secret detection. [ASSUMED: UUID is the correct pattern for the HF ACCESS_KEY; D-08 confirms UUID pattern but does not specify exact format]

### Anti-Patterns to Avoid

- **`drizzle-kit push` in CI:** push applies schema without generating SQL files and has no audit trail. Always use `generate` + `migrate` in CI.
- **Edge runtime on `/api/health`:** Edge runtime cannot use the Neon HTTP driver (requires Node.js HTTP module internals). Must declare `export const runtime = 'nodejs'`.
- **Single migration file with extension + schema:** If the `CREATE EXTENSION` SQL is inside a `drizzle-kit generate` migration, Drizzle may reorder statements. Separate the extension into `0000_enable_pgvector.sql`.
- **`TRIGGER_SECRET_KEY` vs `TRIGGER_ACCESS_TOKEN` confusion:** `TRIGGER_SECRET_KEY` is for your app to trigger tasks at runtime. `TRIGGER_ACCESS_TOKEN` is a personal token for the CLI to deploy. Never swap these.
- **Importing from `@trigger.dev/sdk/v3`:** This path is deprecated in v4. Always import from `@trigger.dev/sdk`. [VERIFIED: trigger.dev/docs/upgrade-to-v4]
- **pnpm workspace config for single-package project:** Do not add a `pnpm-workspace.yaml` — this is a single-package repo, not a monorepo. Trigger.dev's `src/trigger/` layout works without workspace configuration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| pgvector column type | Custom SQL column string | `vector()` from `drizzle-orm/pg-core` | Drizzle has native pgvector support with typed column |
| Neon branch creation per PR | Custom Neon API calls in Actions script | `neondatabase/create-branch-action@v6` | Official action; handles branch naming, outputs, idempotency |
| Neon branch deletion on PR close | Custom API call | `neondatabase/delete-branch-action@v3` | Official action; idempotent |
| Database client for Vercel serverless | Standard `pg` TCP client | `drizzle-orm/neon-http` + `@neondatabase/serverless` | TCP connections don't work in Vercel serverless; HTTP driver handles connection pooling |
| Redis HTTP client | `node-redis` or `ioredis` | `@upstash/redis` | TCP-based clients require persistent connection; Upstash is HTTP-native |
| Trigger.dev project init | Manual `trigger.config.ts` | `pnpm dlx trigger.dev@latest init` | CLI creates correct config, gitignore entries, and example task |
| Secret scanning | Custom grep script | `husky` + targeted UUID pattern grep | Git hook framework handles shell portability; add `gitleaks` later |

**Key insight:** In serverless environments, the standard database and Redis client patterns from traditional Node.js apps cause connection exhaustion and cold-start failures. Every data client must be chosen for HTTP or connection-pool-free operation.

---

## `.env.example` — Complete Variable List

```bash
# ============================================================
# AI Hotspot — Environment Variables
# Source of truth for variable names across all three vaults:
# 1. Vercel project env (Next.js runtime)
# 2. Trigger.dev Cloud env (worker runtime)
# 3. Hugging Face Space (RSSHub config — set in HF Space secrets UI)
#
# DO NOT commit actual values. This file documents names only.
# ============================================================

# --- Database (Vercel + Trigger.dev) ---
DATABASE_URL=                    # Neon Postgres connection string (production branch)
# CI note: DATABASE_URL is set per-PR by create-branch-action output

# --- Redis (Vercel) ---
UPSTASH_REDIS_REST_URL=          # Upstash Redis REST endpoint URL
UPSTASH_REDIS_REST_TOKEN=        # Upstash Redis REST token

# --- Trigger.dev (Vercel runtime — for triggering tasks) ---
TRIGGER_SECRET_KEY=              # From Trigger.dev dashboard > API Keys (per-environment)

# --- Trigger.dev (CLI / GitHub Actions CI — for deployment) ---
TRIGGER_ACCESS_TOKEN=            # Personal access token from Trigger.dev profile (CI only)

# --- RSSHub (Vercel + Trigger.dev) ---
RSSHUB_BASE_URL=                 # e.g. https://lurnings-rsshub.hf.space
RSSHUB_ACCESS_KEY=               # UUID-format key; rotate before Phase 1 completes (D-02)

# --- LLM APIs (Vercel + Trigger.dev) ---
ANTHROPIC_API_KEY=               # Anthropic console > API keys
VOYAGE_API_KEY=                  # Voyage AI console > API keys

# --- Authentication (Vercel) — placeholders; implemented in Phase 5 ---
AUTH_SECRET=                     # Random secret for Auth.js v5 (generate: openssl rand -base64 32)
AUTH_URL=                        # e.g. https://ai-hotspot.vercel.app (production canonical URL)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=                  # Resend transactional email (magic link auth)

# --- Observability (Vercel + Trigger.dev) — placeholders; implemented in Phase 6 ---
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=               # https://cloud.langfuse.com (or self-hosted)
SENTRY_DSN=

# --- Neon CI (GitHub Actions secrets/vars — not in Vercel) ---
# NEON_API_KEY=                  # GitHub secret — not an app secret; set in repo settings
# NEON_PROJECT_ID=               # GitHub variable — not an app secret; set in repo settings

# --- HF Space variables (set in HF Space secrets UI, not here) ---
# ALLOW_USER_HOTLINK=false
# DISALLOW_ROBOT=true
# REQUEST_RETRY=2
# CACHE_EXPIRE=900
# CACHE_CONTENT_EXPIRE=3600
# ACCESS_KEY=<same value as RSSHUB_ACCESS_KEY>
```

---

## Common Pitfalls

### Pitfall 1: Race Between GitHub Actions Migration and Vercel Preview Boot

**What goes wrong:** Vercel's GitHub app triggers a preview deployment immediately on PR push, potentially booting against an unmigrated schema. If the Neon branch is just-created and migrations haven't run yet, the preview crashes on startup.

**Why it happens:** Vercel's GitHub app and GitHub Actions run in parallel. Vercel does not wait for Actions to complete.

**How to avoid:** This is partially mitigated by the fact that the Next.js app in Phase 1 does not query the database on startup — only `/api/health` does. The real risk is in Phase 2+ when RSC pages query the DB. Add a `vercel.json` `ignoreCommand` or use a `vercel.json` build hook to check if migrations have run. Alternatively, run `drizzle-kit migrate` in the Vercel build command (Vercel supports `DATABASE_URL` env vars). Best practice: add a migration step to the Vercel build command in `vercel.json` as a fallback.

**Warning signs:** Preview deployment 500-errors on routes that touch the DB; Neon branch shows no tables in the console.

### Pitfall 2: `drizzle-kit generate` Ordering with pgvector Extension

**What goes wrong:** Running `drizzle-kit generate` produces a single migration file. If that file contains `CREATE TABLE ... embedding vector(1024)` before the extension is enabled, the migration fails with `type "vector" does not exist`.

**Why it happens:** Drizzle infers the extension requirement from the column type but may not generate `CREATE EXTENSION` automatically. The schema file and generated migration must be inspected.

**How to avoid:** Create `0000_enable_pgvector.sql` manually with `CREATE EXTENSION IF NOT EXISTS vector;`. Number it before the generated migration. In `drizzle.config.ts`, ensure `out` points to the same `./drizzle/` folder. [VERIFIED: Context7 vector-similarity-search guide]

**Warning signs:** Migration fails with "type vector does not exist"; Neon branch has no vector column.

### Pitfall 3: `TRIGGER_SECRET_KEY` vs `TRIGGER_ACCESS_TOKEN` Confusion

**What goes wrong:** Developer sets `TRIGGER_ACCESS_TOKEN` in Vercel env, thinking it will allow Next.js to trigger tasks. It doesn't — `TRIGGER_ACCESS_TOKEN` is a CLI/deploy credential, not a runtime triggering credential.

**Why it happens:** Both are "Trigger.dev tokens" but serve different purposes.

**How to avoid:** `TRIGGER_SECRET_KEY` goes in Vercel env (and `.env.local`). `TRIGGER_ACCESS_TOKEN` goes only in GitHub Actions secrets for the deploy step.

**Warning signs:** `tasks.trigger()` returns 401; Trigger.dev dashboard shows no triggered runs.

### Pitfall 4: HF Space Cold-Start Flaps `/api/health`

**What goes wrong:** First call to the HF Space takes 30–60s (cold-start). If `/api/health` is called immediately after deployment, the 60s timeout may still not be enough on a heavily cold Space.

**Why it happens:** Hugging Face free-tier Spaces sleep after 48h of inactivity.

**How to avoid:** The fire-and-forget warmup call in the health route pattern above primes the Space before the measured check. Accept occasional `/api/health` 503 immediately post-deployment (the Space will warm within 60s on the next check). The CI success criterion is `/api/health` returning 200 during manual testing, not immediately on deploy.

**Warning signs:** Health route always times out for rsshub check; HF Space shows "sleeping" state in the HF UI.

### Pitfall 5: pnpm `--frozen-lockfile` Failing in CI on First Run

**What goes wrong:** The lockfile (`pnpm-lock.yaml`) must be committed. If it is not committed (gitignored by mistake), `pnpm install --frozen-lockfile` fails in CI.

**How to avoid:** Ensure `pnpm-lock.yaml` is NOT in `.gitignore`. Commit it after running `pnpm install` locally. The `pnpm create next-app` command generates the lockfile; commit it immediately.

**Warning signs:** CI fails with "ERR_PNPM_FROZEN_LOCKFILE_VIOLATION".

### Pitfall 6: Next.js 16 (not 15) on npm

**What happens:** `npm view next version` returns 16.2.4 as of 2026-04-17. This project was spec'd as "Next.js 15" but npm latest is 16. This is fine — Next.js 16 is App Router compatible and retains all Phase 1 patterns. The `pnpm create next-app@latest` command installs the current latest (16.x). Do not pin to 15.x unless a specific regression is identified.

**Warning signs:** None — this is expected drift. The patterns documented here work for both 15.x and 16.x.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwindcss-animate` | `tw-animate-css` or inline keyframes | March 2025 | Do not install `tailwindcss-animate` |
| `@trigger.dev/sdk/v3` import path | `@trigger.dev/sdk` | Trigger.dev v4 GA (2025) | v3 import path deprecated |
| Inngest for Next.js background jobs | Trigger.dev v4 (per STATE.md) | Project decision 2026-04-17 | Use Trigger.dev; CLAUDE.md/STACK.md are stale on this |
| OpenAI `text-embedding-3-small` (1536-dim) | Voyage AI `voyage-3.5` (1024-dim) | Project decision 2026-04-17 | Use `vector(1024)` not `vector(1536)` |
| Vercel KV (Redis) | Upstash Redis | Dec 2024 | Vercel KV sunsetted; Upstash is the canonical replacement |
| `tailwind.config.js` | CSS `@theme` directive (Tailwind v4) | Early 2025 | No config file needed for Tailwind v4 |
| `next-auth@4` | `next-auth@5` (Auth.js v5) | 2024 | v5 supports App Router natively; v4 does not |
| `drizzle-kit` pre-0.20 API | `drizzle-kit@0.31.x` | 2024 | Config format changed; use `defineConfig` |

**Deprecated/outdated to avoid:**
- `@trigger.dev/nextjs` — last published a year ago (v3.3.12); do not use for v4 projects
- `inngest` — stale recommendation in CLAUDE.md/STACK.md; use Trigger.dev v4
- `openai` npm package for embeddings — use `voyageai` package instead

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/api/v1/whoami` Trigger.dev endpoint accepts `TRIGGER_SECRET_KEY` bearer auth for health check | Pattern 7: `/api/health` | Health check returns 401; use key-format check as fallback |
| A2 | UUID (8-4-4-4-12 hex) is the exact format of the HF Space ACCESS_KEY | Pattern 9: Pre-commit Hook | False positives or false negatives in pre-commit grep |
| A3 | Vercel Neon integration has a race condition with GitHub Actions migrations | Pitfall 1 | May not need fallback migration in Vercel build command |
| A4 | `item_clusters` join table nullability and usage pattern | Pattern 3: Schema | Planner may need to adjust based on Phase 2 query patterns |
| A5 | `trigger.dev/v4` docs URL redirects (docs URL returned 404) | Multiple patterns | If v4 docs are at a different URL, verify trigger.config.ts `build` import |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (It is not empty; A1, A2, A3 need verification.)

---

## Open Questions

1. **Trigger.dev health endpoint for `/api/health`**
   - What we know: `TRIGGER_SECRET_KEY` is the runtime auth token; Trigger.dev has an API at `api.trigger.dev`
   - What's unclear: Whether `GET /api/v1/whoami` or another lightweight endpoint exists and is appropriate for a health check
   - Recommendation: At implementation time, test `GET https://api.trigger.dev/api/v1/whoami` with Bearer auth. If it returns 200, use it. If not, fall back to `if (!TRIGGER_SECRET_KEY) return { error: 'not configured' }`.

2. **Next.js version: 15 vs 16**
   - What we know: `npm view next version` returns 16.2.4 as of research date. All patterns documented here work with both.
   - What's unclear: Whether the user has a preference for pinning to 15.x
   - Recommendation: Use 16.x (latest) unless user specifies otherwise. Update `.nvmrc` to Node 20.

3. **Drizzle `generate` + custom pgvector migration ordering**
   - What we know: Drizzle Kit generates numbered migrations; custom SQL files must be numbered to sort before generated ones
   - What's unclear: Whether `drizzle-kit generate` will attempt to manage the extension or leave it to the custom file
   - Recommendation: Create `0000_enable_pgvector.sql` manually. Run `drizzle-kit generate` and inspect output to confirm no extension statement conflicts.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20.9 | Next.js 15+/16+, Trigger.dev v4 | Verify at dev machine | Check: `node --version` | Install via nvm: `nvm install 20` |
| pnpm | Package manager (D-14) | Likely present | Check: `pnpm --version` | `npm i -g pnpm` |
| git | Pre-commit hooks | Almost certainly present | — | — |
| Neon account | Database | User must provision | — | — |
| Upstash account | Redis | User must provision | — | — |
| Trigger.dev account | Worker platform | User must provision | — | — |
| Anthropic API key | Phase 1 `.env.example` placeholder | User must obtain | — | — |
| Voyage AI API key | Phase 1 `.env.example` placeholder | User must obtain | — | — |
| HF Space ACCESS_KEY | D-02 — rotate before Phase 1 completes | User must rotate | — | New key from HF Space secrets UI |
| GitHub repository | CI/CD, Vercel integration | Assumed present (repo exists) | — | — |
| Vercel account | Hosting | User must provision or already has | — | — |

**Missing dependencies with no fallback:**
- Neon account + Postgres project provisioned (required for DATABASE_URL)
- Upstash Redis database provisioned (required for UPSTASH_REDIS_REST_URL + TOKEN)
- Trigger.dev account + project created (required for TRIGGER_SECRET_KEY + project ref in trigger.config.ts)

**Missing dependencies with fallback:**
- Voyage AI key: Phase 1 only needs the env var placeholder. Actual API calls are Phase 3.
- Anthropic key: Phase 1 only needs the env var placeholder. Actual API calls are Phase 3.
- HF ACCESS_KEY: must be rotated, but the Space is already live. Key rotation is a UI action, not a deployment.

---

## Validation Architecture

> `nyquist_validation` is enabled (absent = enabled).

### Test Framework

Phase 1 has no automated unit tests. Validation is integration-style: does the infrastructure actually work? The "test suite" for this phase is the `/api/health` endpoint itself plus a set of manual verification steps and CI gates.

| Property | Value |
|----------|-------|
| Framework | None in Phase 1 — integration health check route |
| Config file | None |
| Quick run command | `curl https://<preview-url>/api/health` |
| Full suite command | CI workflow: typecheck + lint + build + migrate, then curl health |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Next.js deploys to Vercel | smoke | `curl -f https://<preview-url>/` | ❌ Wave 0 (created by scaffold) |
| INFRA-02 | Neon + pgvector reachable | integration | `curl -f https://<preview-url>/api/health` → neon: "ok" | ❌ Wave 0 |
| INFRA-03 | All 11 tables exist | integration | `drizzle-kit check` + query `information_schema.tables` | ❌ Wave 0 |
| INFRA-04 | Upstash Redis reachable | integration | `curl -f https://<preview-url>/api/health` → redis: "ok" | ❌ Wave 0 |
| INFRA-05 | Trigger.dev task manually triggerable | integration | Trigger `health-probe` from Trigger.dev dashboard; verify run completes | Manual |
| INFRA-06 | RSSHub reachable with ACCESS_KEY | integration | `curl -f https://<preview-url>/api/health` → rsshub: "ok" | ❌ Wave 0 |
| INFRA-07 | All env vars wired | smoke | `curl -f https://<preview-url>/api/health` → all services: "ok" | ❌ Wave 0 |
| INFRA-08 | CI builds + migrates | CI gate | GitHub Actions workflow passes on PR | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `tsc --noEmit` (typecheck catches schema drift, missing imports)
- **Per wave merge:** Full CI workflow (typecheck + lint + build + migrate + manual health check)
- **Phase gate:** `/api/health` returns HTTP 200 with all services "ok" on a live Vercel preview before `/gsd-verify-work`

### Wave 0 Gaps

All test infrastructure is created as part of Phase 1 execution:

- [ ] `src/app/api/health/route.ts` — the integration test endpoint covering INFRA-01/02/04/06/07
- [ ] `drizzle/0000_enable_pgvector.sql` — manually created extension migration
- [ ] `drizzle/0001_initial_schema.sql` — generated by `drizzle-kit generate`
- [ ] `.github/workflows/ci.yml` — CI pipeline covering INFRA-08
- [ ] `.husky/pre-commit` — secret scanning hook
- [ ] `trigger.config.ts` — Trigger.dev project config (created by `trigger.dev init`)
- [ ] `src/trigger/health-probe.ts` — minimal task for INFRA-05 verification
- [ ] Framework install: `pnpm create next-app@latest . --yes`

### Validation Sequence (Per-Phase Gate)

**Before merge (CI-gated):**
1. `pnpm tsc --noEmit` — schema type errors caught
2. `pnpm eslint .` — code style
3. `pnpm next build` — build-time errors caught
4. `drizzle-kit migrate` against PR Neon branch — schema applied without errors
5. `drizzle-kit check` — no schema drift between TypeScript schema and migration SQL

**After merge to main (manual):**
1. Verify Vercel production deployment succeeds
2. `curl https://ai-hotspot.vercel.app/api/health` returns `{ ok: true, services: { neon: "ok", redis: "ok", rsshub: "ok", trigger: "ok" } }`
3. Manually trigger `health-probe` task from Trigger.dev dashboard; verify run completes in dashboard

**Phase 1 is complete when:** All three of the above pass on the production URL.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — auth not implemented in Phase 1 | Auth.js v5 (Phase 5) |
| V3 Session Management | No | Auth.js v5 database sessions (Phase 5) |
| V4 Access Control | Partial — `/api/health` should NOT be public in prod | Route middleware (Phase 5); acceptable open in Phase 1 |
| V5 Input Validation | Partial — `/api/health` has no input; env vars are typed | `zod` for any future API inputs |
| V6 Cryptography | No LLM calls in Phase 1 | — |
| Secrets management | YES — D-02, D-08 | Pre-commit hook + vault-based env vars |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key in committed code | Information Disclosure | Pre-commit UUID grep hook; `.env.example` with no values |
| `RSSHUB_ACCESS_KEY` exposed in HTTP logs | Information Disclosure | Never log full URLs with key param; use `?key=REDACTED` in logs |
| `/api/health` reveals internal service topology | Information Disclosure | Acceptable in Phase 1; add auth gate in Phase 5 |
| `ANTHROPIC_API_KEY` in client bundle | Information Disclosure | Never prefix with `NEXT_PUBLIC_`; all LLM calls in Trigger.dev workers |
| Neon connection string in error messages | Information Disclosure | Catch errors in health route before returning; never expose raw error stack to client |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: npm registry] — all package versions verified via `npm view <package> version` on 2026-04-17
- [VERIFIED: nextjs.org/docs/app/getting-started/installation] — Node.js 20.9 minimum; `pnpm create next-app@latest . --yes` command; Turbopack default
- [VERIFIED: Context7 /websites/orm_drizzle_team] — Drizzle Neon HTTP driver setup, `drizzle.config.ts` shape, `push` vs `migrate` distinction, pgvector column type, HNSW index syntax
- [VERIFIED: Context7 /triggerdotdev/trigger.dev] — `schedules.task()` cron syntax, `tasks.trigger()` from Next.js, `trigger.config.ts` `dirs` option, CLI commands
- [VERIFIED: trigger.dev/docs/manual-setup] — `TRIGGER_SECRET_KEY` env var, Node.js 18.20+ minimum, `@trigger.dev/sdk` + `@trigger.dev/build` package names
- [VERIFIED: trigger.dev/docs/upgrade-to-v4] — `@trigger.dev/sdk/v3` import path deprecated; use `@trigger.dev/sdk`; `runtime: "node-22"` config option
- [VERIFIED: trigger.dev/docs/apikeys] — `TRIGGER_SECRET_KEY` for runtime triggering; `TRIGGER_ACCESS_TOKEN` for CLI deployment
- [VERIFIED: trigger.dev/docs/github-actions] — `actions/setup-node@v4` with `node-version: '20.x'`; `TRIGGER_ACCESS_TOKEN` for CI deploy
- [VERIFIED: Context7 /upstash/docs] — `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars; `new Redis({ url, token })` client pattern
- [VERIFIED: neon.com/docs/extensions/pgvector] — `CREATE EXTENSION vector;` SQL; HNSW index syntax; version support
- [VERIFIED: github.com/neondatabase/create-branch-action] — `neondatabase/create-branch-action@v6`; `db_url` output; `NEON_API_KEY` + `NEON_PROJECT_ID` inputs
- [VERIFIED: neon.com/docs/guides/branching-github-actions] — GitHub Actions integration for PR preview branches

### Secondary (MEDIUM confidence)

- [CITED: trigger.dev/changelog/v4-4-2] — Trigger.dev v4 is GA; latest version 4.4.4
- [CITED: npm voyageai package] — `voyageai` v0.2.1 is the official Voyage AI TypeScript SDK

### Tertiary (LOW confidence)

- [ASSUMED] — Trigger.dev `/api/v1/whoami` endpoint exists and accepts `TRIGGER_SECRET_KEY` bearer auth
- [ASSUMED] — Vercel Neon integration has a race condition with GitHub Actions (use GH Actions for explicit ordering)
- [ASSUMED] — HF Space ACCESS_KEY is UUID-format (D-08 confirms UUID pattern; exact format not verified)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via npm registry; API patterns verified via Context7 and official docs
- Architecture: HIGH — service topology locked by CONTEXT.md decisions; patterns verified
- Schema: HIGH — column types verified via Drizzle docs; nullability for some phase-later tables is ASSUMED
- CI/GitHub Actions: HIGH — create-branch-action verified via WebFetch against GitHub README
- Trigger.dev v4: MEDIUM — core patterns verified; `/api/health` Trigger check endpoint is ASSUMED
- Pre-commit hook: MEDIUM — UUID pattern approach is standard; exact ACCESS_KEY format is ASSUMED

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (Trigger.dev v4 is moving fast; re-verify CLI commands if > 30 days elapse)

---

## RESEARCH COMPLETE
