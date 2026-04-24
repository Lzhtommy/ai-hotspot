# Requirements: AI Hotspot

**Defined:** 2026-04-17
**Core Value:** A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase.

### Infrastructure

- [x] **INFRA-01**: Next.js 15 App Router (TypeScript) project scaffolded and deploying to Vercel
- [x] **INFRA-02**: Neon Postgres provisioned with pgvector extension enabled
- [x] **INFRA-03**: Drizzle ORM schema migration defines `sources`, `items`, `clusters`, `item_clusters`, `tags`, `item_tags`, `users`, `favorites`, `votes`, `settings`, `pipeline_runs`
- [x] **INFRA-04**: Upstash Redis provisioned and reachable from Vercel
- [x] **INFRA-05**: Trigger.dev v4 project linked to the repo with deploy pipeline working
- [x] **INFRA-06**: RSSHub deployed on a HK/SG VPS (Railway or Hetzner) with ACCESS_KEY auth
- [x] **INFRA-07**: Environment variables wired across Vercel + Trigger.dev + RSSHub (Anthropic, Voyage AI, DB, Redis, RSSHub URL/key)
- [x] **INFRA-08**: CI builds, typechecks, and runs migrations on preview deployments

### Ingestion

- [x] **INGEST-01**: Trigger.dev cron task polls all active sources via RSSHub once per hour
- [x] **INGEST-02**: Source URLs are normalized (strip UTM params, resolve shortlinks, canonical protocol) before fingerprinting
- [x] **INGEST-03**: Items are deduplicated by SHA-256 `url_fingerprint` with a UNIQUE DB index
- [x] **INGEST-04**: Each new item is written in `pending` status and enqueued for LLM processing
- [x] **INGEST-05**: Timestamps are stored as UTC; source-local time is preserved separately for display
- [x] **INGEST-06**: Source health is tracked: `last_fetched_at`, `consecutive_empty_count`, `consecutive_error_count`
- [x] **INGEST-07**: Source failures are logged and isolated — one bad source does not stop the others
- [x] **INGEST-08**: Ingestion task is idempotent — re-running an hour's poll does not create duplicates

### LLM Pipeline

- [x] **LLM-01**: Per-item pipeline runs on Trigger.dev workers (never inside Next.js API routes)
- [x] **LLM-02**: Full-text extraction step (Readability-style) fetches article body when RSS excerpt is short; falls back to excerpt with a flag on failure
- [x] **LLM-03**: English-source items are translated to Chinese by Claude Haiku 4.5 before summarization
- [x] **LLM-04**: Claude Haiku 4.5 produces a Chinese summary (~2–4 sentences) per item
- [x] **LLM-05**: Claude Haiku 4.5 produces a 0–100 hotness score per item; score is immutable after publish
- [x] **LLM-06**: Claude Haiku 4.5 produces a one-line 推荐理由 per item
- [x] **LLM-07**: Claude Haiku 4.5 produces up to N auto-tags per item (e.g., Agent, 模型发布, 编码, Anthropic)
- [x] **LLM-08**: Prompt caching (`cache_control: ephemeral`) is enabled on all system prompts from the first call; `cache_read_input_tokens` verified > 0
- [x] **LLM-09**: All ingested article text is wrapped in `<untrusted_content>` delimiters to mitigate prompt injection
- [x] **LLM-10**: LLM outputs are validated (score in 0–100, required fields present) before DB write; invalid responses go to dead-letter state
- [x] **LLM-11**: Failed items transition to `failed` with error detail; max retries exceeded items land in dead-letter, never silently dropped
- [x] **LLM-12**: Token usage per item (input / cache-read / cache-write / output) is logged to `pipeline_runs`
- [x] **LLM-13**: LLM pipeline calls are instrumented with Langfuse traces

### Event Clustering

- [x] **CLUST-01**: Voyage AI `voyage-3.5` generates a 1024-dim embedding for every published item
- [x] **CLUST-02**: Embeddings are stored in pgvector column with HNSW index for ANN search
- [x] **CLUST-03**: Cluster refresh task assigns each new item to nearest existing cluster if cosine similarity ≥ configurable threshold (default 0.82) within ±24h window; otherwise creates a new cluster
- [x] **CLUST-04**: Clustering threshold is stored in the `settings` table and adjustable without redeploy
- [x] **CLUST-05**: Each cluster tracks `member_count`, `primary_item_id`, `earliest_seen_at`, `latest_seen_at`
- [x] **CLUST-06**: Cluster refresh task is debounced to run once per ingestion wave (coalesces bursts)
- [x] **CLUST-07**: Primary item is selected by earliest timestamp within the cluster (stable)

### Feed UI

- [x] **FEED-01**: `/` (精选) renders top-scoring items with ISR (5-minute revalidate), grouped by time
- [x] **FEED-02**: `/all` (全部 AI 动态) renders full chronological feed with pagination/infinite scroll
- [x] **FEED-03**: Item card shows: source name + badge, title, Chinese summary, hotness score, 推荐理由, tags, cluster count (`另有 N 个源也报道了此事件` when count > 0)
- [x] **FEED-04**: Item detail page `/items/[id]` shows full summary, cluster member list with source+link, original article link
- [x] **FEED-05**: Timeline groups items by HH:MM within a day; day headers for scrolling context
- [x] **FEED-06**: Dark-theme design matches reference screenshot (green accent, card spacing, left sidebar)
- [x] **FEED-07**: Responsive layout works on mobile (≥375px) and desktop
- [x] **FEED-08**: CJK fonts self-hosted (Noto Sans SC subset); never loaded from Google Fonts
- [x] **FEED-09**: OG tags (`og:title`, `og:description`, `og:image`) present on item detail pages for WeChat share cards
- [ ] **FEED-10**: Redis feed cache (5-min TTL) invalidated when a new cluster refresh completes
- [x] **FEED-11**: Chinese-only UI; English source items show Chinese-translated title and summary
- [x] **FEED-12**: Source filter / tag filter controls on `/all` view

### Authentication

- [x] **AUTH-01**: Auth.js v5 configured with Drizzle adapter
- [x] **AUTH-02**: GitHub OAuth login works end-to-end on production and preview URLs
- [x] **AUTH-03**: Email magic link login works via Resend (China-accessible email delivery)
- [x] **AUTH-04**: Google OAuth available as secondary option (not the default button)
- [x] **AUTH-05**: `AUTH_REDIRECT_PROXY_URL` configured so OAuth callbacks work on Vercel preview deployments
- [x] **AUTH-06
**: Anonymous read works for all feed pages; no login wall
- [x] **AUTH-07**: User sessions persist across browser refresh
- [x] **AUTH-08**: Sign out works from any page

### User Interactions

- [x] **FAV-01**: Authenticated user can favorite (收藏) an item; UI state reflects immediately
- [x] **FAV-02**: Authenticated user can unfavorite an item
- [x] **FAV-03**: `/favorites` page shows the user's saved items in reverse-chrono order
- [x] **VOTE-01**: Authenticated user can like an item
- [x] **VOTE-02**: Authenticated user can dislike an item
- [x] **VOTE-03**: Like/dislike UI includes honest copy that personalization is forthcoming
- [x] **VOTE-04**: Favorite/like/dislike actions require login — anonymous click prompts sign-in modal

### Admin Backend

- [x] **ADMIN-01**: Admin-only route `/admin` protected by role check
- [ ] **ADMIN-02**: 信源 list view with source name, URL, weight, active toggle, last-fetched, consecutive errors
- [ ] **ADMIN-03**: Admin can create a new source (RSSHub route or raw RSS URL) with weight and category
- [ ] **ADMIN-04**: Admin can edit source weight, name, active state
- [ ] **ADMIN-05**: Admin can soft-delete a source (items preserved, source marked inactive)
- [ ] **ADMIN-06**: 信源 health indicator: red when `consecutive_empty_count ≥ 3` or `consecutive_error_count ≥ 3`
- [ ] **ADMIN-07**: 用户 list view with email, provider, created-at, role, ban toggle
- [ ] **ADMIN-08**: Admin can ban a user (revokes sessions, blocks interactions)
- [ ] **ADMIN-09**: Admin dashboard shows daily Claude token cost (input / cache-read / cache-write / output) from `pipeline_runs`

### Operational

- [x] **OPS-01**: Sentry integrated for Next.js + Trigger.dev error capture
- [ ] **OPS-02**: Langfuse dashboard shows per-item LLM cost and cache hit rate
- [ ] **OPS-03**: Admin UI exposes dead-letter items with retry action
- [ ] **OPS-04**: Basic sitemap.xml generated from published items
- [ ] **OPS-05**: Vercel Analytics enabled (no Google Analytics due to GFW)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Curation

- **STRAT-01**: Admin-managed 精选策略 (global curation strategies — editable prompt)
- **STRAT-02**: 策略迭代 UI — A/B prompt iteration and version history
- **PERSO-01**: Per-user personalization driven by like/dislike signals
- **PERSO-02**: User-custom curation strategies (private prompts)

### Social Signals

- **SOCIAL-01**: 低粉爆文 section — low-follower high-engagement social posts
- **SOCIAL-02**: User-submitted source reporting (信源提报) with moderation queue

### Discovery & Search

- **SEARCH-01**: Full-text Chinese keyword search over items
- **SEARCH-02**: Topic subscriptions with email/push alerts
- **RSS-01**: Public RSS output feed (Feedly-style subscription)

### Platform

- **I18N-01**: English UI toggle
- **MOBILE-01**: Native mobile apps (iOS / Android)
- **WECHAT-01**: WeChat OAuth login (requires Chinese business entity)

### Commercial

- **COMMERCE-01**: Monetization (ads, sponsored items, subscription tiers)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time (<5 min) ingestion | Hourly cadence is sufficient for AI news; real-time multiplies LLM + infra cost |
| Mainland-China-hosted infrastructure | Triggers ICP 备案 requirement; 60-day process + Chinese business entity; HK/SG avoids this |
| Google Fonts / Google Analytics | Blocked by the GFW for mainland Chinese users |
| Google OAuth as primary login | Google is blocked by the GFW for mainland Chinese users |
| Self-hosted Next.js | No operational upside vs Vercel; adds ops burden |
| Comments / threaded discussion | Moderation burden; not core to "never miss AI news" value |
| Video posts / video items | Not aligned with text-news aggregation |
| Custom embedding model hosting | Voyage AI voyage-3.5 covers multilingual needs at low cost |
| Prisma ORM | Cold-start penalty and Rust binary bloat vs Drizzle on serverless |
| Inngest as worker platform | Vercel-route-bound steps still hit function timeout; Trigger.dev avoids this |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| INFRA-08 | Phase 1 | Complete |
| INGEST-01 | Phase 2 | Complete |
| INGEST-02 | Phase 2 | Complete |
| INGEST-03 | Phase 2 | Complete |
| INGEST-04 | Phase 2 | Complete |
| INGEST-05 | Phase 2 | Complete |
| INGEST-06 | Phase 2 | Complete |
| INGEST-07 | Phase 2 | Complete |
| INGEST-08 | Phase 2 | Complete |
| LLM-01 | Phase 3 | Complete |
| LLM-02 | Phase 3 | Complete |
| LLM-03 | Phase 3 | Complete |
| LLM-04 | Phase 3 | Complete |
| LLM-05 | Phase 3 | Complete |
| LLM-06 | Phase 3 | Complete |
| LLM-07 | Phase 3 | Complete |
| LLM-08 | Phase 3 | Complete |
| LLM-09 | Phase 3 | Complete |
| LLM-10 | Phase 3 | Complete |
| LLM-11 | Phase 3 | Complete |
| LLM-12 | Phase 3 | Complete |
| LLM-13 | Phase 3 | Complete |
| CLUST-01 | Phase 3 | Complete |
| CLUST-02 | Phase 3 | Complete |
| CLUST-03 | Phase 3 | Complete |
| CLUST-04 | Phase 3 | Complete |
| CLUST-05 | Phase 3 | Complete |
| CLUST-06 | Phase 3 | Complete |
| CLUST-07 | Phase 3 | Complete |
| FEED-01 | Phase 4 | Complete |
| FEED-02 | Phase 4 | Complete |
| FEED-03 | Phase 4 | Complete |
| FEED-04 | Phase 4 | Complete |
| FEED-05 | Phase 4 | Complete |
| FEED-06 | Phase 4 | Complete |
| FEED-07 | Phase 4 | Complete |
| FEED-08 | Phase 4 | Complete |
| FEED-09 | Phase 4 | Complete |
| FEED-10 | Phase 4 | Pending |
| FEED-11 | Phase 4 | Complete |
| FEED-12 | Phase 4 | Complete |
| AUTH-01 | Phase 5 | Complete |
| AUTH-02 | Phase 5 | Complete |
| AUTH-03 | Phase 5 | Complete |
| AUTH-04 | Phase 5 | Complete |
| AUTH-05 | Phase 5 | Complete |
| AUTH-06 | Phase 5 | Complete |
| AUTH-07 | Phase 5 | Complete |
| AUTH-08 | Phase 5 | Complete |
| FAV-01 | Phase 5 | Complete |
| FAV-02 | Phase 5 | Complete |
| FAV-03 | Phase 5 | Complete |
| VOTE-01 | Phase 5 | Complete |
| VOTE-02 | Phase 5 | Complete |
| VOTE-03 | Phase 5 | Complete |
| VOTE-04 | Phase 5 | Complete |
| ADMIN-01 | Phase 6 | Complete |
| ADMIN-02 | Phase 6 | Pending |
| ADMIN-03 | Phase 6 | Pending |
| ADMIN-04 | Phase 6 | Pending |
| ADMIN-05 | Phase 6 | Pending |
| ADMIN-06 | Phase 6 | Pending |
| ADMIN-07 | Phase 6 | Pending |
| ADMIN-08 | Phase 6 | Pending |
| ADMIN-09 | Phase 6 | Pending |
| OPS-01 | Phase 6 | Complete |
| OPS-02 | Phase 6 | Pending |
| OPS-03 | Phase 6 | Pending |
| OPS-04 | Phase 6 | Pending |
| OPS-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 75 total
- Mapped to phases: 75
- Unmapped: 0

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after roadmap creation — all 75 requirements mapped*
