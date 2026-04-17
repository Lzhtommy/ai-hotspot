# Architecture Research

**Domain:** LLM-curated Chinese AI news aggregator (RSS ingestion + LLM pipeline + feed UI)
**Researched:** 2026-04-17
**Confidence:** HIGH (deployment topology, DB patterns, embedding choice) / MEDIUM (clustering thresholds — require empirical tuning)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VERCEL (Next.js App Router)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Feed UI     │  │  Admin UI    │  │  Auth UI     │  │  User UI    │ │
│  │  (RSC pages) │  │  (RSC pages) │  │  (Next-Auth) │  │  (favorites)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                  │        │
│  ┌──────▼─────────────────▼─────────────────▼──────────────────▼──────┐ │
│  │              API Routes / Server Actions (App Router)               │ │
│  │  GET /api/feed  POST /api/votes  GET /api/clusters  admin CRUD      │ │
│  └──────────────────────────────┬──────────────────────────────────────┘ │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │ reads
┌─────────────────────────────────▼────────────────────────────────────────┐
│                         MANAGED DATA LAYER                                │
│  ┌───────────────────────┐    ┌──────────────────────────────────────┐   │
│  │  Neon Postgres         │    │  Upstash Redis                       │   │
│  │  + pgvector extension  │    │  - feed cache (TTL 5 min)            │   │
│  │  (sources, items,      │    │  - rate-limit counters               │   │
│  │   clusters, tags,      │    │  - session store (Next-Auth)         │   │
│  │   embeddings, users,   │    │  - LLM job dedup lock                │   │
│  │   votes, favorites)    │    └──────────────────────────────────────┘   │
│  └───────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘
                    ▲ writes                          ▲ writes
┌───────────────────┴──────────────────────────────────────────────────────┐
│                         TRIGGER.DEV (Managed Workers)                     │
│  ┌──────────────────────────┐   ┌──────────────────────────────────────┐ │
│  │  Ingestion Task          │   │  LLM Pipeline Task                   │ │
│  │  - scheduled hourly      │   │  - translate (if English source)     │ │
│  │  - polls RSSHub HTTP     │   │  - summarize → Chinese 2-4 sentences │ │
│  │  - parses RSS/Atom       │   │  - score 0-100 hotness               │ │
│  │  - dedupe by URL + hash  │   │  - generate 推荐理由                  │ │
│  │  - enqueues LLM tasks    │   │  - assign tags                       │ │
│  └──────────────────────────┘   │  - generate embedding (Voyage AI)    │ │
│                                 │  - cluster assignment                 │ │
│  ┌──────────────────────────┐   │  - write to DB + cache invalidate    │ │
│  │  Cluster Refresh Task    │   └──────────────────────────────────────┘ │
│  │  - runs after LLM batch  │                                            │
│  │  - SQL: find unassigned  │                                            │
│  │    items near existing   │                                            │
│  │    cluster centroids     │                                            │
│  │  - creates new clusters  │                                            │
│  │    for isolated items    │                                            │
│  └──────────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────────┘
                    ▲ RSS HTTP fetch
┌───────────────────┴──────────────────────────────────────────────────────┐
│                         VPS (e.g. Hetzner CX21)                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  RSSHub (Docker)                                                  │    │
│  │  - unified RSS endpoint for: Twitter/X, 微博, 公众号, HN, Reddit,  │    │
│  │    AI lab blogs, buzzing.cc, and any declarative route            │    │
│  │  - no code changes to add new sources, only config               │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Owns | Communicates With | Notes |
|-----------|------|-------------------|-------|
| Next.js App (Vercel) | Feed rendering, auth, user interactions, admin CRUD | Neon Postgres (read-heavy), Upstash Redis (cache reads) | No direct LLM calls; all async |
| Trigger.dev Ingestion Task | Hourly poll, RSS parse, dedup, enqueue | RSSHub (HTTP GET), Neon (write items), Trigger.dev task queue | Must be idempotent; duplicate-safe |
| Trigger.dev LLM Pipeline Task | Translation, summary, score, tags, embedding, cluster | Anthropic API, Voyage AI API, Neon (write enriched item), Upstash (invalidate) | One task per item; retryable per step |
| Trigger.dev Cluster Refresh Task | Finds newly landed items, assigns to clusters or creates new ones | Neon pgvector (cosine similarity query) | Runs after each LLM batch completes |
| Neon Postgres + pgvector | Source of truth for all structured data and embeddings | All workers + Next.js app | Primary persistence |
| Upstash Redis | Feed cache, rate limits, session, dedup locks | Next.js app (reads), Trigger.dev workers (writes/invalidation) | HTTP-based, serverless-safe |
| RSSHub (VPS) | Normalised RSS for heterogeneous sources | Trigger.dev ingestion task (inbound) | Self-hosted; only component on VPS |
| Anthropic Claude API | Scoring, summarisation, translation, tag generation, 推荐理由 | LLM Pipeline Task | Sonnet-class; rate-limited |
| Voyage AI API | Text embeddings (voyage-3.5) | LLM Pipeline Task (post-enrichment) | Anthropic's recommended partner; multilingual |

---

## Data Flow — End to End

```
1. SCHEDULE (hourly)
   Trigger.dev cron → Ingestion Task starts

2. INGEST
   Ingestion Task
     → HTTP GET RSSHub/<route> for each active source
     → Parse RSS/Atom items
     → For each item:
         a. compute sha256(url + title) as content_hash
         b. SELECT 1 FROM items WHERE url = $url OR content_hash = $hash
         c. If found → skip (dedup)
         d. If new → INSERT items(source_id, url, title, raw_content,
                                   published_at, content_hash, status='pending')
         e. Trigger.dev: trigger LLM Pipeline Task for new item_id

3. LLM PIPELINE (per item, parallelised across items)
   Trigger.dev LLM Pipeline Task (one task per item):
     Step 1 — Translate (if source.language = 'en'):
       → Claude Haiku: translate title + body to Chinese
       → UPDATE items SET title_zh, body_zh
     Step 2 — Enrich:
       → Claude Sonnet: single prompt for summary_zh + score + tags + 推荐理由
       → UPDATE items SET summary_zh, score, tags[], recommendation
     Step 3 — Embed:
       → Voyage AI voyage-3.5: embed(title_zh + summary_zh)
       → UPDATE items SET embedding = vector(1024)
     Step 4 — Signal cluster refresh:
       → Trigger.dev: debounced trigger of Cluster Refresh Task

4. CLUSTER ASSIGNMENT (batch, after LLM wave)
   Trigger.dev Cluster Refresh Task:
     → SELECT items WHERE cluster_id IS NULL AND embedding IS NOT NULL
     → For each unassigned item:
         a. SELECT cluster_id, centroid FROM clusters
            ORDER BY centroid <=> item.embedding
            LIMIT 1
         b. If cosine_similarity >= 0.82 → assign item to nearest cluster,
            UPDATE cluster centroid (running average), bump cluster.item_count
         c. Else → INSERT INTO clusters(primary_item_id, centroid = item.embedding)
                   UPDATE item SET cluster_id = new_cluster_id, is_primary = true
     → UPDATE clusters SET updated_at = NOW() for touched clusters

5. SERVE
   Next.js API Route /api/feed:
     → Check Upstash Redis cache key "feed:精选:page:1" (TTL 5 min)
     → Cache HIT → return JSON
     → Cache MISS →
         SELECT items JOIN clusters JOIN sources
         WHERE status = 'published'
         ORDER BY score DESC, cluster.item_count DESC
         LIMIT 50
         → serialize → SET in Redis (TTL 5 min) → return

6. INVALIDATE
   After Cluster Refresh Task completes:
     → DEL Redis keys matching "feed:*"
     → Next fetch rebuilds cache
```

---

## Clustering — Detailed Design

### Why Embedding-Based Clustering

Cross-source deduplication is the core product differentiator. Rule-based URL matching misses paraphrased re-reports; keyword overlap misses translated or summarized items. Semantic embeddings naturally cluster "GPT-5 announced" and "OpenAI releases next-generation model" regardless of phrasing or source language.

### Embedding Model: Voyage AI `voyage-3.5`

- Recommended by Anthropic (official docs); no native Claude embeddings exist
- Multilingual with strong Chinese performance; voyage-3-large ranks #1 across multilingual MTEB benchmarks
- voyage-3.5 offers best quality/cost balance at $0.06/M tokens; voyage-3.5-lite ($0.02/M) acceptable for volume fallback
- 1024-dimensional output stored as pgvector `vector(1024)` in Postgres
- Embeddings are L2-normalized; use dot product as cosine similarity (faster)
- Context length: 32K tokens — more than enough for title + summary

### Similarity Threshold

- **Recommended starting threshold: 0.82 cosine similarity**
- Below 0.75: too permissive, unrelated items cluster together
- Above 0.88: too strict, legitimate cross-source reports treated as independent
- Empirically tune using the first two weeks of production data by reviewing cluster groupings manually
- Store threshold as a config row in DB (`settings` table) so it can be adjusted without redeploy

### Cluster Data Model

Each cluster has:
- A single **primary item** (highest score within cluster; re-elected when new higher-scored item joins)
- A **centroid** vector (running mean of all member item embeddings; updated incrementally)
- An **item_count** that drives the "另有 N 个源也报道" display

### When to Re-Cluster

- Items are assigned to clusters once, immediately after their embedding is computed
- No full re-cluster sweep needed in v1; incremental assignment is sufficient
- Re-cluster trigger for v2: when a source is deleted (orphan items need reassignment) or when threshold config changes

### pgvector Index

```sql
-- IVFFlat index for approximate nearest-neighbor at scale
-- lists = sqrt(number of cluster centroids expected) — start with 100
CREATE INDEX ON clusters USING ivfflat (centroid vector_ip_ops) WITH (lists = 100);
-- Use vector_ip_ops (inner product) because Voyage embeddings are L2-normalized
-- inner product on unit vectors == cosine similarity
```

At v1 scale (<10K clusters), exact search without index is fast enough. Add IVFFlat when clusters exceed ~50K.

---

## Postgres Schema Sketch

```sql
-- SOURCES: RSSHub routes or raw RSS URLs
CREATE TABLE sources (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                    -- display name, e.g. "Anthropic Blog"
  rss_url     TEXT NOT NULL UNIQUE,             -- full RSSHub or raw RSS URL
  language    TEXT NOT NULL DEFAULT 'zh',       -- 'zh' | 'en' (drives translation step)
  weight      NUMERIC(3,1) NOT NULL DEFAULT 1.0,-- admin-set per-source weight for scoring
  is_active   BOOLEAN NOT NULL DEFAULT true,
  health      TEXT NOT NULL DEFAULT 'ok',       -- 'ok' | 'error' | 'timeout'
  last_fetched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ITEMS: one row per ingested RSS entry
CREATE TABLE items (
  id              BIGSERIAL PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES sources(id),
  url             TEXT NOT NULL UNIQUE,
  content_hash    TEXT NOT NULL,                -- sha256(url + title) for dedup
  title           TEXT NOT NULL,               -- original language
  title_zh        TEXT,                        -- translated (null if already zh)
  body_raw        TEXT,                        -- original body
  body_zh         TEXT,                        -- translated body
  summary_zh      TEXT,                        -- LLM 2-4 sentence summary
  recommendation  TEXT,                        -- 推荐理由 one-line
  score           INTEGER,                     -- 0-100 hotness
  tags            TEXT[],                      -- e.g. ['Agent', '模型发布', 'Anthropic']
  embedding       vector(1024),               -- Voyage AI voyage-3.5 embedding
  cluster_id      BIGINT REFERENCES clusters(id),
  is_cluster_primary BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'published' | 'failed'
  published_at    TIMESTAMPTZ NOT NULL,        -- from RSS feed
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX ON items (status, published_at DESC);
CREATE INDEX ON items (cluster_id);
CREATE INDEX ON items (source_id);
CREATE INDEX ON items USING GIN (tags);

-- CLUSTERS: one row per grouped event
CREATE TABLE clusters (
  id              BIGSERIAL PRIMARY KEY,
  primary_item_id BIGINT REFERENCES items(id),
  centroid        vector(1024),               -- running mean of member embeddings
  item_count      INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON clusters USING ivfflat (centroid vector_ip_ops) WITH (lists = 100);

-- USERS
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  is_banned   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- AUTH ACCOUNTS (OAuth)
CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,               -- 'google' | 'github' | 'email'
  provider_account_id TEXT NOT NULL,
  UNIQUE (provider, provider_account_id)
);

-- FAVORITES
CREATE TABLE favorites (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id   BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

-- VOTES
CREATE TABLE votes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),  -- -1 dislike, 1 like
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

-- SETTINGS (admin-tunable config)
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,               -- e.g. 'cluster_threshold', 'feed_strategy'
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO settings VALUES ('cluster_threshold', '0.82', NOW());
```

---

## Build Order (Dependency Graph)

Dependencies are strict — each layer requires the layer above it.

```
Layer 0 — Infrastructure provisioning (Day 1, no code deps)
  ├── Neon Postgres project + pgvector extension enabled
  ├── Upstash Redis instance
  ├── Trigger.dev project + Vercel env sync
  ├── VPS provisioned, RSSHub Docker deployed
  └── Vercel project linked to repo

Layer 1 — Schema & data foundation
  └── Run initial migration: all tables above
      (blocks: everything)

Layer 2 — Ingestion pipeline
  ├── Trigger.dev Ingestion Task (poll RSSHub, insert items)
  └── Source management admin API (CRUD sources table)
      (blocks: LLM pipeline, which needs items to exist)

Layer 3 — LLM processing pipeline
  ├── Translation step (Claude Haiku)
  ├── Enrichment step (Claude Sonnet: summary + score + tags + 推荐理由)
  ├── Embedding step (Voyage AI)
  └── Cluster Refresh Task
      (blocks: feed UI, which needs enriched items to display)

Layer 4 — Feed API + cache
  ├── GET /api/feed (精选 + 全部 AI 动态 queries, Redis caching)
  └── Feed cache invalidation on cluster refresh completion
      (blocks: feed UI pages)

Layer 5 — Feed UI
  ├── Timeline pages (精选 / 全部 AI 动态)
  └── Per-item card component (source, summary, tags, score, 推荐理由, cluster badge)
      (blocks: auth, which needs somewhere to send users after login)

Layer 6 — Auth & user interactions
  ├── NextAuth.js (Google + GitHub + email magic link)
  ├── POST /api/votes, POST /api/favorites
  └── User favorites view
      (blocks: admin user management)

Layer 7 — Admin backend
  ├── Source management UI
  └── User management UI (list, ban, role)
```

---

## Deployment Topology

| Service | Provider | Why |
|---------|----------|-----|
| Next.js App | Vercel | Native deployment, Edge CDN, zero-config |
| LLM + Ingestion Workers | Trigger.dev cloud | No Vercel timeout constraints (tasks can run minutes); no infra to manage; first-class Next.js integration; v4 designed for AI agent workloads |
| Postgres | Neon | Serverless, scale-to-zero, pgvector native support, branching for CI/CD, HTTP driver for edge |
| Redis / KV | Upstash | HTTP-based (serverless-safe, no persistent connection), Vercel KV was sunsetted Dec 2024, Upstash is the canonical replacement |
| Embeddings | Voyage AI | Anthropic's official recommendation; no native Claude embeddings exist; multilingual MTEB leader |
| LLM | Anthropic Claude | Product requirement; Sonnet-class for enrichment, Haiku-class for translation |
| RSS Normalization | RSSHub (VPS) | Cannot run on Vercel (process model incompatible); single VPS (Hetzner CX21 ~€4/mo) sufficient |
| Scheduler | Trigger.dev cron | Built into Trigger.dev; hourly cron triggers ingestion task |

### Worker Placement Decision: Trigger.dev over Vercel Cron + Inngest

**Vercel Cron alone:** 10-60 second timeouts (Hobby/Pro). LLM pipeline per item can easily exceed 30 seconds (translate + enrich + embed = 3 sequential API calls). Disqualified.

**Inngest:** Excellent step-retry model. Runs by calling back into your Vercel-hosted API routes. Still bound by Vercel function timeout per step. Edge case: a single slow Claude call could timeout a step. Acceptable for v1 but adds Vercel timeout risk.

**Trigger.dev v4:** Tasks run on dedicated long-running compute outside Vercel. No timeouts. Native TypeScript. Designed specifically for AI agent/LLM workflows. Batch.triggerByTaskAndWait for fan-out. Built-in retry with exponential backoff per step. Verdict: best fit.

---

## Caching Strategy

| Cache Key Pattern | TTL | Invalidated By | Notes |
|-------------------|-----|----------------|-------|
| `feed:curated:page:{n}` | 5 min | Cluster Refresh Task completion | 精选 feed pages |
| `feed:all:page:{n}` | 5 min | Cluster Refresh Task completion | 全部 feed pages |
| `item:{id}` | 1 hour | Never in v1 (items are write-once after publish) | Individual item detail |
| `rate:{ip}` | 60 sec | Auto-expires | API rate limiting counter |
| `session:{token}` | 30 days | User logout | NextAuth session |

Redis key format: always prefixed, always TTL-bounded. Never cache without TTL.

---

## Failure Modes & Isolation

| Failure | Impact | Mitigation |
|---------|--------|------------|
| RSSHub VPS down | No new items ingested until recovery; existing feed unaffected | Trigger.dev task marks source health = 'error'; retry next hour; health visible in admin |
| Claude API rate-limited (429) | LLM pipeline task fails for that item | Trigger.dev step-level retry with exponential backoff; item stays `status='processing'`; retried next run |
| Claude API cost runaway | Unbounded LLM spend | Set Anthropic usage limits in console; Trigger.dev concurrency limit (max 20 parallel LLM tasks); per-hour item cap in ingestion task config |
| Voyage AI API down | Embedding step fails | Step-level retry; item stays in `processing` until embedding succeeds; clustering deferred but item can be published without cluster (cluster_id NULL) |
| Dedup race condition | Two Ingestion Task runs (if triggered twice) insert same item | `url` column has UNIQUE constraint; second INSERT throws unique violation, ingestion task catches and skips |
| DB migration needed | Risk of downtime during deploy | Neon branch for staging migrations; use additive-only migrations in v1 (new columns, never rename/drop); Trigger.dev tasks check item.status before processing |
| Feed cache stale | Users see outdated feed | TTL of 5 min is the maximum staleness window; acceptable for hourly ingestion cadence |
| Cluster Refresh Task crashes mid-run | Some items remain without cluster_id | Items still displayed (cluster_id nullable); next Cluster Refresh Task picks them up (idempotent query: WHERE cluster_id IS NULL) |

---

## Scaling Considerations

| Scale | First Bottleneck | Mitigation |
|-------|-----------------|------------|
| ~50 sources, ~500 items/day (v1 baseline) | LLM cost ($0.003/item * 500 = $1.50/day) | Acceptable; no action needed |
| 10x sources (500), same readers | LLM cost ($15/day) + Voyage embedding cost | Add source-level relevance pre-filter (keyword score) to skip obvious noise before LLM; use Claude Haiku for scoring pass, only Sonnet for top items |
| 10x readers (>1K concurrent) | Redis cache miss rate on cold pages | Increase Redis cache TTL; add Next.js full-route cache on static segments; consider ISR for feed pages |
| 100x items/day | pgvector cluster query slows | Add IVFFlat index on clusters.centroid; partition items table by ingested_at month |
| LLM pipeline throughput limit | Trigger.dev concurrency + Anthropic TPM limits | Increase Trigger.dev concurrency ceiling; request higher Anthropic tier; split translation (Haiku) and enrichment (Sonnet) into separate tasks running in parallel |

**What breaks first at 10x sources:** LLM cost, not infrastructure. The Anthropic API rate limit (OTPM) is the practical ceiling before DB or Vercel becomes relevant. Plan a pre-filter step before Sonnet enrichment.

**What breaks first at 10x readers:** Redis cache misses and cold Neon compute spin-up. Solution: extend TTL to 10 min, add ISR (60s) on feed pages, keep Neon always-on compute after traffic justifies the cost.

---

## Recommended Project Structure

```
ai-hotspot/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (feed)/                   # Route group — public feed
│   │   │   ├── page.tsx              # 精选 feed (default)
│   │   │   ├── all/page.tsx          # 全部 AI 动态
│   │   │   └── item/[id]/page.tsx    # Item detail
│   │   ├── (user)/                   # Route group — authenticated
│   │   │   ├── favorites/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── admin/                    # Admin-only pages
│   │   │   ├── sources/page.tsx
│   │   │   └── users/page.tsx
│   │   ├── api/                      # API routes
│   │   │   ├── feed/route.ts
│   │   │   ├── votes/route.ts
│   │   │   ├── favorites/route.ts
│   │   │   └── auth/[...nextauth]/route.ts
│   │   └── layout.tsx
│   ├── components/                   # UI components
│   │   ├── feed/
│   │   │   ├── FeedTimeline.tsx
│   │   │   ├── ItemCard.tsx
│   │   │   └── ClusterBadge.tsx
│   │   ├── admin/
│   │   └── ui/                      # Shared primitives
│   ├── lib/                          # Shared utilities
│   │   ├── db/
│   │   │   ├── client.ts            # Neon postgres client
│   │   │   └── queries/             # Typed query functions
│   │   ├── redis/
│   │   │   └── client.ts            # Upstash Redis client
│   │   ├── auth/
│   │   │   └── config.ts            # NextAuth config
│   │   └── types.ts                 # Shared TypeScript types
│   └── trigger/                     # Trigger.dev task definitions
│       ├── ingestion.ts             # Hourly ingestion task
│       ├── llm-pipeline.ts          # Per-item LLM enrichment task
│       └── cluster-refresh.ts       # Cluster assignment task
├── migrations/                       # SQL migration files (numbered)
│   └── 001_initial_schema.sql
├── trigger.config.ts                 # Trigger.dev project config
└── vercel.json                       # Vercel deployment config
```

---

## Architectural Patterns

### Pattern 1: Status Machine on Items

**What:** Items move through states: `pending` → `processing` → `published` | `failed`. Workers only operate on items in the right state.
**When to use:** Any multi-step async pipeline where work can be interrupted mid-flight.
**Trade-offs:** Adds a state column and conditional logic; prevents double-processing and orphan items.

### Pattern 2: Debounced Cluster Refresh

**What:** Each LLM Pipeline Task does not immediately run clustering. Instead it signals a Trigger.dev event. Cluster Refresh Task debounces: it runs once after a wave of LLM tasks completes (e.g., 60 seconds after last signal), not once per item.
**When to use:** Any batch operation where N upstream events should coalesce into one downstream run.
**Trade-offs:** Adds 60s latency to cluster assignment, which is acceptable given hourly ingestion cadence.

### Pattern 3: Feed Cache Aside

**What:** Feed API checks Redis first; on miss, queries Postgres and writes result to Redis with TTL; Trigger.dev invalidates all feed keys after cluster refresh.
**When to use:** Read-heavy endpoints with infrequent writes — exactly the feed use case.
**Trade-offs:** TTL creates a staleness window; explicit invalidation after each publish cycle minimizes it.

---

## Anti-Patterns

### Anti-Pattern 1: Calling LLM Inside API Routes

**What people do:** PUT LLM calls (Claude summarize, score) inside Next.js API routes triggered by user requests or even by the cron endpoint.
**Why it's wrong:** Vercel function timeout (60s Pro tier) is too short for multi-step LLM chains. Cost is hard to control. User requests block on LLM latency.
**Do this instead:** API routes are read-only (feed, votes, favorites). All LLM work happens in Trigger.dev tasks, asynchronously, with retries and observability.

### Anti-Pattern 2: Storing Embeddings in a Separate Vector DB

**What people do:** Stand up Pinecone or Weaviate for embeddings while Postgres holds everything else.
**Why it's wrong:** Introduces a second data store, join across network boundaries, consistency issues when an item is deleted from Postgres but not from the vector store.
**Do this instead:** pgvector in Neon collocates embeddings with item metadata. Queries like "find nearest cluster AND join item metadata" are a single SQL statement. At v1-v2 scale pgvector performs adequately; migrate only if vector search becomes a latency bottleneck at 1M+ rows.

### Anti-Pattern 3: Re-embedding on Every Cluster Re-run

**What people do:** Recompute embeddings for all items every time the cluster threshold changes.
**Why it's wrong:** Voyage AI embedding calls cost money and time. With 10K items this is $0.60 and minutes of API calls.
**Do this instead:** Embeddings are computed once per item and stored permanently. Threshold changes only re-run cluster assignment SQL — no embedding recomputation needed.

### Anti-Pattern 4: Using Vercel Cron for LLM Pipeline

**What people do:** Trigger the full ingestion + LLM pipeline via Vercel Cron function.
**Why it's wrong:** 60-second max execution on Vercel Pro. One item with a slow Claude call (translate + enrich + embed sequentially) can exceed 30 seconds, leaving no margin for 20+ items per source.
**Do this instead:** Vercel Cron (or Trigger.dev cron) fires the Ingestion Task only. Each item fans out to a separate Trigger.dev LLM task with no timeout constraint.

---

## Integration Points

### External Services

| Service | Integration Pattern | Auth | Gotchas |
|---------|---------------------|------|---------|
| Anthropic Claude | HTTPS REST (Anthropic SDK) | `ANTHROPIC_API_KEY` | Rate limits per model tier; use exponential backoff; track OTPM usage |
| Voyage AI | HTTPS REST (voyageai SDK or HTTP) | `VOYAGE_API_KEY` | 200M free tokens then $0.06/M; batch up to 128 texts per call |
| RSSHub | HTTPS GET (node-fetch or axios) | None (own VPS) | Some routes need API keys configured in RSSHub env; timeout if VPS unresponsive |
| Neon Postgres | `@neondatabase/serverless` (HTTP driver) | `DATABASE_URL` | Use HTTP driver on edge/serverless; use standard pg for worker tasks |
| Upstash Redis | `@upstash/redis` (HTTP REST) | `UPSTASH_REDIS_REST_URL` + token | No persistent connection needed; safe for serverless |
| Trigger.dev | Trigger.dev SDK | `TRIGGER_SECRET_KEY` | Tasks defined in `src/trigger/`; deploy with `trigger.dev deploy` |
| NextAuth.js | Next.js App Router handler | OAuth app credentials | Use `auth()` server-side; session in Upstash Redis adapter |

### Internal Boundaries

| Boundary | Communication | Contract |
|----------|---------------|----------|
| Next.js API ↔ Postgres | Direct query via Neon HTTP driver | Read-only for feed; writes for votes/favorites/admin |
| Trigger.dev Tasks ↔ Postgres | Neon standard pg driver (not HTTP, long connection OK in worker) | Insert/update items, clusters; SELECT for dedup |
| Trigger.dev Tasks ↔ Upstash | Upstash REST client | DEL feed cache keys on publish |
| LLM Pipeline Task ↔ Cluster Refresh | Trigger.dev event signalling | `io.sendEvent('cluster.refresh.needed')` with debounce |

---

## Sources

- Anthropic Claude Embeddings docs (official): https://platform.claude.com/docs/claude/docs/embeddings — confirms no native Claude embeddings; Voyage AI as official recommendation (HIGH confidence)
- Voyage AI blog, voyage-3-large announcement (Jan 2025): https://blog.voyageai.com/2025/01/07/voyage-3-large/ — multilingual MTEB benchmark leadership (HIGH confidence)
- Trigger.dev v3/v4 docs and announcement: https://trigger.dev/blog/v3-announcement — no-timeout worker tasks, AI agent workloads (HIGH confidence)
- Neon vs Supabase 2026 comparisons (multiple sources): pgvector support, serverless characteristics (MEDIUM confidence; aggregated from multiple community posts)
- pgvector GitHub and Supabase docs: https://github.com/pgvector/pgvector — IVFFlat index, cosine similarity operators (HIGH confidence)
- Upstash Redis on Vercel (Vercel KV sunsetted Dec 2024): https://vercel.com/docs/redis — canonical replacement confirmed (HIGH confidence)

---

*Architecture research for: AI Hotspot — LLM-curated Chinese AI news aggregator*
*Researched: 2026-04-17*
