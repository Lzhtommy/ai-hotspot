# Project Research Summary

**Project:** AI Hotspot — LLM-curated Chinese AI news aggregator
**Domain:** LLM-curated news aggregation with semantic clustering (Next.js App Router)
**Researched:** 2026-04-17
**Confidence:** HIGH

---

## Executive Summary

AI Hotspot is a Chinese-language aggregator that ingests AI news from heterogeneous sources (official lab blogs, X/Twitter, HN, Reddit, 公众号, 微博), processes each item through a Claude-powered pipeline (translate, summarize, score, tag, cluster), and presents a ranked timeline where cluster count acts as an implicit popularity signal. The product occupies a specific niche between editorial aggregators (机器之心, 量子位) and raw title-translators (buzzing.cc): it provides full Chinese summaries, LLM-judged hotness scores, per-item 推荐理由, and cross-source event clustering. No competitor offers all four simultaneously in Chinese.

The recommended technical approach is a strict separation between the read path (Next.js RSC + Neon Postgres + Upstash Redis, all on Vercel) and the write/processing path (Trigger.dev v4 workers running outside Vercel's timeout constraints). RSSHub provides unified RSS normalization on a VPS. Claude Haiku 4.5 handles translation/scoring/summarization; Voyage AI voyage-3.5 generates multilingual embeddings for semantic clustering via pgvector in Neon. This architecture was designed specifically to avoid Vercel's 60-second function timeout, which is the single most common failure mode for LLM ingestion pipelines on this stack.

The two dominant risks are cost runaway (LLM prompt caching must be enabled from day one — skipping it inflates costs 5–10x) and China accessibility (Google OAuth and Google Fonts are blocked by the GFW; primary auth should be GitHub OAuth plus email magic link via Resend, with Google OAuth as an optional addition). The full-text extraction gap is a concrete pipeline risk: most RSS feeds provide only excerpts, not full article text, which degrades LLM summary quality. An explicit extraction step using a readability library must be included in the LLM pipeline before the Claude summarization call.

---

## Key Findings

### Recommended Stack

The stack is fully specified and high-confidence across all components. Next.js 15 App Router with RSC-first rendering uses ISR (5-minute revalidation) for feed pages and dynamic RSC for user-specific pages. Neon Postgres (serverless) stores all structured data and embeddings via pgvector; Drizzle ORM is preferred over Prisma due to its edge-native execution and absence of cold-start penalty. Upstash Redis handles feed caching, rate limiting, and session storage. Auth.js v5 with Drizzle adapter manages authentication.

**Core technologies:**
- **Next.js 15 App Router (TypeScript)**: Full-stack framework — RSC-first with ISR for feed pages, zero client JS for timeline/cards
- **Neon Postgres + pgvector**: Primary database and vector store — serverless-native, avoids a separate vector DB (pgvector handles <1M vectors adequately)
- **Drizzle ORM**: Type-safe SQL — edge-compatible, no Rust binary, no cold-start penalty vs. Prisma
- **Trigger.dev v4**: Background workers — dedicated long-running compute, no Vercel timeout, designed for AI agent workloads; preferred over Inngest (see Disagreement Resolution)
- **Upstash Redis**: Feed cache + rate limiting — HTTP-first, serverless-safe, Vercel KV replacement after Dec 2024 sunset
- **Auth.js v5 (NextAuth) + Drizzle adapter**: Authentication — self-hosted, PIPL-safer than Clerk, supports GitHub + email magic link (China-accessible)
- **Claude Haiku 4.5** (claude-haiku-4-5-20251001): Translation + scoring + summarization + tagging — $1/$5 per MTok; prompt caching drops effective cost ~60%
- **Claude Sonnet 4.6** (claude-sonnet-4-6): Cluster boundary disambiguation only — used for embedding similarity grey zone (0.80–0.87), not for every item
- **Voyage AI voyage-3.5**: Text embeddings — Anthropic's official recommendation; strong Chinese-English multilingual MTEB performance; 1024 dimensions (see Disagreement Resolution)
- **shadcn/ui + Tailwind v4**: UI — dark-theme default, green accent, no tailwind.config.js needed
- **Langfuse**: LLM observability — trace every Claude call, cost per item, cache hit rate; free tier covers 50k events/month
- **RSSHub (Docker on Railway or Hetzner VPS)**: RSS normalization — unified endpoint for Twitter/X, 微博, 公众号, HN, Reddit, lab blogs

**Monthly cost estimate (moderate traffic):** ~$90–140/mo total; Claude API is the dominant variable; prompt caching reduces it ~60%.

### Expected Features

**Must have (table stakes) — v1:**
- Timeline feed (精选 + 全部 AI 动态 views) — primary product surface
- Per-item card: source, title, Chinese summary, hotness score, 推荐理由, tags, cluster count
- LLM pipeline: translation + Chinese summary + hotness score (0–100) + 推荐理由 + auto-tags
- Cross-source event clustering with "另有 N 个源也报道了此事件" count — the core differentiator; must ship at launch
- RSSHub ingestion with hourly polling + deduplication (GUID + normalized URL hash)
- Anonymous read; GitHub OAuth + email magic link login (Google OAuth optional, not primary)
- 收藏 (favorites) — first retention feature
- Like/dislike signal collection (with explicit UI copy that personalization is forthcoming)
- Admin: 信源 CRUD + source weight + health monitoring
- Admin: user list + ban capability
- OG tags on item pages (critical for WeChat share card rendering)
- Source health tracking (last fetched, consecutive failures, error count)
- Per-item article detail page with cluster member list

**Should have (competitive differentiators) — v1.x after validation:**
- Admin-editable scoring prompt with version history
- Full-text keyword search (add after >500 items)
- Sitemap.xml + RSS output feed for Feedly subscribers
- Per-source weight tuning UI

**Defer (v2+):**
- 低粉爆文 detection — requires social platform engagement APIs
- Per-user curation strategies — requires ML and proven retention data
- 信源提报 (user-submitted sources) — requires moderation workflow
- WeChat OAuth — requires Chinese business entity and review cycles
- Analytics/token cost dashboard — logs first, dashboard later
- Multi-language UI, native mobile apps

**China-specific specifics:**
- 公众号 sources via WeWe RSS sidecar (RSSHub 公众号 routes unreliable); add slowly (5–10 accounts/day)
- Self-host CJK fonts (Noto Sans SC, subsets: chinese-simplified, max 2 weights) — never load from Google Fonts
- Google OAuth optional/later; GitHub + email are primary China-accessible providers
- OG tags with og:image are critical — WeChat share cards break without them

### Architecture Approach

The system separates concerns into three tiers: (1) a read-only Vercel/Next.js layer serving pre-rendered RSC pages with Redis-cached feed API responses, (2) a Trigger.dev worker layer handling all async, long-running ingestion and LLM processing outside Vercel's timeout constraints, and (3) a managed data layer (Neon Postgres + pgvector + Upstash Redis) as the sole shared state. Items flow through a strict status machine (pending -> processing -> published | failed) with a dead-letter state for pipeline failures. All LLM calls are server-side only in Trigger.dev tasks — never in Next.js API routes.

**Major components:**
1. **Next.js App (Vercel)** — Feed rendering (RSC + ISR), admin UI, auth UI, user interactions; read-only DB access; cache-aside via Redis
2. **Trigger.dev Ingestion Task** — Hourly cron; polls RSSHub; deduplicates by normalized URL hash; enqueues per-item LLM tasks; idempotent
3. **Trigger.dev LLM Pipeline Task** — Per-item: full-text extraction -> translate (if English) -> summarize + score + tags + 推荐理由 (Claude Haiku) -> embed (Voyage AI) -> signal cluster refresh
4. **Trigger.dev Cluster Refresh Task** — Debounced batch; runs once after each LLM wave; assigns items to existing clusters (cosine >= threshold) or creates new cluster; increments cluster_count
5. **Neon Postgres + pgvector** — Source of truth; all items, clusters, embeddings, users, votes, favorites; HNSW index on item embeddings for ANN search
6. **Upstash Redis** — Feed cache (5-min TTL, invalidated on cluster refresh), rate limiting, session storage
7. **RSSHub (VPS)** — Unified RSS normalization; Docker on Railway or Hetzner (HK/SG region); ACCESS_KEY-protected

**Key architectural patterns:**
- Status machine on items (prevents double-processing, enables dead-letter recovery)
- Debounced cluster refresh (coalesces N LLM completions into one clustering run)
- Cache-aside feed with explicit invalidation after each publish cycle
- All LLM calls in Trigger.dev tasks — never in Vercel API routes (timeout protection)

### Critical Pitfalls

1. **Vercel function timeout kills the LLM pipeline** — Never run LLM work in a Next.js API route or Vercel Cron function body. The cron endpoint must only enqueue a Trigger.dev task. Address in Phase 1.

2. **Missing prompt caching causes 5–10x cost overrun** — Enable cache_control ephemeral on system prompts from the first pipeline implementation. Verify via cache_read_input_tokens > 0 in API responses. Address in Phase 1.

3. **Indirect prompt injection via ingested content** — Wrap all article text in untrusted_content tags. Validate Claude output structure before writing to DB. Address in Phase 1.

4. **RSSHub source degradation without detection** — Track consecutive_empty_count and consecutive_error_count per source. Alert when a source returns 0 items for 3+ consecutive polls. Address in Phase 1 (health modeling) and Phase 2 (admin visibility).

5. **Google/Gmail inaccessible in mainland China** — Never make Google OAuth the only login option. GitHub OAuth + email magic link (Resend) are primary. Do not use Google Fonts or Gmail SMTP. Address in Phase 3.

6. **Duplicate item processing** — Normalize URLs (strip UTM params, resolve shortlinks, normalize protocol). Use SHA-256 of normalized URL as url_fingerprint with a UNIQUE index. Address in Phase 1.

7. **No cost monitoring leads to runaway Claude bill** — Log token usage (including cache read/write tokens) per pipeline run from day one. Expose daily cost in admin dashboard. Set Anthropic hard billing alert at 50% of monthly budget.

---

## Disagreement Resolution

The four research agents diverged on five points. Here are the explicit resolutions:

### 1. Worker Platform: Trigger.dev v4 (chosen over Inngest)

**Recommendation: Trigger.dev v4.**

Inngest (STACK.md) uses step functions that call back into Vercel-hosted API routes, meaning each step is still subject to Vercel's per-function timeout. A single slow Claude call (translate + embed sequentially) can approach 30 seconds, leaving no margin for 50–200 items per run. Trigger.dev v4 (ARCHITECTURE.md) runs tasks on dedicated long-running compute with no per-step timeout constraint, built specifically for AI agent and LLM workloads. Trigger.dev eliminates this class of failure at equivalent cost. Choose Trigger.dev v4.

### 2. Embedding Provider: Voyage AI voyage-3.5 (chosen over OpenAI text-embedding-3-small)

**Recommendation: Voyage AI voyage-3.5.**

STACK.md recommends text-embedding-3-small (OpenAI); ARCHITECTURE.md recommends voyage-3.5 as Anthropic's official partner. This corpus is Chinese + English mixed — Voyage's multilingual training gives materially better cross-lingual clustering (an English announcement and a Chinese 公众号 repost should cluster together). Anthropic explicitly recommends Voyage when Claude embeddings are needed, making it the lower-surprise dependency in an Anthropic-first stack. Cost is identical ($0.02/MTok). Use voyage-3.5 (1024 dimensions, stored as vector(1024) in pgvector).

### 3. Clustering Similarity Threshold: Start at 0.82, treat as empirical config

**Recommendation: Start at 0.82 cosine similarity; store as DB-level config; tune after first two weeks of production data.**

STACK.md says 0.88; ARCHITECTURE.md says 0.82. Neither is authoritative without production data. Start at 0.82 (less likely to split legitimate cross-source reports into false singletons), enforce a +-24-hour time window for clustering (reduces false positives from topic vocabulary overlap), and review the first two weeks of cluster assignments manually. Store the threshold in a settings table row so it can be adjusted without redeployment.

### 4. Full-text extraction step: Required in LLM pipeline; missing from ARCHITECTURE.md

**Recommendation: Add an explicit full-text extraction step before the Claude summarization call.**

FEATURES.md correctly flags that many RSS feeds provide only excerpts. ARCHITECTURE.md's pipeline omits this step, which means Claude would summarize the excerpt rather than the article — producing low-quality summaries. The pipeline must include a readability extraction step (using @mozilla/readability or unfluff) that fetches the full article URL and extracts clean body text before passing content to Claude. Skip extraction if the RSS item already contains sufficient body text (>500 characters). Handle paywalled content gracefully (fall back to excerpt with a flag). This is a Phase 1 LLM pipeline concern.

### 5. Google OAuth: GitHub + email as primary; Google optional/later

**Recommendation: Implement GitHub OAuth + email magic link (Resend) as primary auth. Add Google OAuth as optional secondary.**

PROJECT.md lists "Email + OAuth (Google, GitHub)" without prioritization. PITFALLS.md correctly notes Google is blocked by the GFW for mainland Chinese users. For a product targeting Chinese AI practitioners, making Google OAuth prominent risks locking out a large fraction of the core audience. GitHub is the natural identity for the technical AI audience and is accessible from mainland China. Email magic link via Resend is universally accessible. Configure Auth.js v5 with GitHub + Resend as primary providers; add Google OAuth but do not present it as the default option in the UI.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md, a 4-phase structure is recommended. The ordering is strict: the LLM pipeline cannot be tested without ingestion, the feed UI cannot be built without enriched items, and auth/interactions add no value before the feed is working.

### Phase 0: Infrastructure Foundation
**Rationale:** All services must be provisioned before any code is written. RSSHub location (HK/SG VPS, not mainland China) and the worker platform choice (Trigger.dev, not Vercel Cron) are irreversible architectural decisions.
**Delivers:** Neon Postgres with pgvector enabled + initial schema migration; Upstash Redis; Trigger.dev project linked to Vercel; RSSHub deployed on Railway or Hetzner (HK/SG region); Vercel project initialized; env vars wired across all services.
**Avoids:** ICP 备案 enforcement (Pitfall 11); Vercel function timeout architecture trap (Pitfall 1).

### Phase 1: Ingestion + LLM Pipeline
**Rationale:** This is the core value-generating layer. Everything downstream depends on having enriched items in the DB. The most dangerous pitfalls (timeout, cost runaway, prompt injection, dedup failures, timezone bugs) all belong here and must be addressed in this phase, not retrofitted.
**Delivers:** Trigger.dev hourly ingestion task (polls RSSHub, normalizes URLs, deduplicates, writes pending items); full-text extraction step; LLM pipeline (translate -> summarize + score + tags + 推荐理由, prompt caching enabled from first call, temperature: 0); Voyage AI embedding; cluster refresh task; dead-letter state for failed items; token cost logging per pipeline run.
**Addresses:** LLM translation, Chinese summary, hotness score, 推荐理由, auto-tags, cross-source clustering, source health tracking, item deduplication.
**Avoids:** Vercel timeout (Pitfall 1), cost overrun (Pitfall 2), prompt injection (Pitfall 3), source degradation (Pitfall 4), duplicate processing (Pitfall 5), score non-determinism (Pitfall 7), silent pipeline failures (Pitfall 8), timezone bugs (Pitfall 9).
**Research flag:** Full-text extraction library selection (@mozilla/readability vs. unfluff vs. Jina.ai) needs a brief spike. Trigger.dev v4 specific fan-out API changed between v3 and v4 — verify current batch.triggerByTaskAndWait patterns before implementation.

### Phase 2: Feed UI + Admin Backend
**Rationale:** Once items are enriched and in the DB, the feed UI can be built against real data. The admin backend (source CRUD, health monitoring) is operationally necessary before the system runs unattended. CJK font strategy must be decided at design system setup.
**Delivers:** Timeline pages (精选 + 全部 AI 动态) with ISR; per-item card (source, summary, tags, score, 推荐理由, cluster badge); per-item article detail page with cluster member list; OG tags; Redis feed cache with on-demand invalidation; admin 信源 CRUD + health dashboard; daily Claude cost visible in admin dashboard.
**Addresses:** Timeline feed, 精选/全部 views, cluster count display, OG tags for WeChat sharing, source health monitoring, admin cost monitoring.
**Avoids:** CJK font loading CLS (Pitfall 12), no cost monitoring (Pitfall 14), clustering threshold chaos (Pitfall 6 — admin can view cluster groupings for manual review).
**Research flag:** No additional research needed — shadcn/ui dark theme with Tailwind v4 CSS variables is well-documented.

### Phase 3: Auth + User Interactions
**Rationale:** Auth adds no value before there is a feed worth interacting with. Building auth last avoids over-investing in login flows before the core product is validated.
**Delivers:** Auth.js v5 with GitHub OAuth + email magic link (Resend) as primary; Google OAuth as optional secondary; AUTH_REDIRECT_PROXY_URL configured for Vercel preview URLs; anonymous read enforced; favorites (收藏); like/dislike with UI copy explicitly stating personalization is forthcoming; admin user list + ban capability.
**Addresses:** Email + GitHub/Google login, 收藏, like/dislike signals, admin user management.
**Avoids:** China auth inaccessibility (Pitfall 13), preview URL OAuth failures (Pitfall 10), personalization expectation debt (Pitfall 15).
**Research flag:** No additional research needed — Auth.js v5 OAuth proxy pattern is documented.

### Phase 4: Polish + Operational Hardening
**Rationale:** After the core loop is validated with real users, invest in reliability and discoverability improvements.
**Delivers:** Sitemap.xml; on-demand ISR revalidation after each pipeline run; source health alerting (webhook/email when consecutive_empty_count > 3); dead-letter replay UI in admin; Langfuse dashboard review; Sentry error monitoring setup.
**Addresses:** RSS output feed (v1.x), sitemap, source alerting, dead-letter visibility.

### Phase Ordering Rationale

- Phase 0 -> Phase 1: No pipeline can run without provisioned services. Trigger.dev and RSSHub must exist before any ingestion code is written.
- Phase 1 -> Phase 2: Feed UI needs enriched items with scores, summaries, and cluster assignments to render meaningfully. Building UI against placeholder data creates throwaway work.
- Phase 2 -> Phase 3: Auth is gated on having a feed worth bookmarking. Favorites and like features require knowing which items exist.
- Phase 3 -> Phase 4: Operational hardening (alerting, dead-letter replay, sitemaps) is highest value after real users are present and real failures have been observed.

### Research Flags

Phases needing targeted research during planning:
- **Phase 1:** Full-text extraction strategy for paywalled/excerpt-only RSS feeds — brief spike to evaluate @mozilla/readability vs. unfluff vs. Jina.ai extraction API. Also: RSSHub route authentication specifics for Twitter/X (cookie rotation) and WeWe RSS configuration for 公众号.
- **Phase 1:** Trigger.dev v4 specific APIs for debounced event signaling and batch fan-out — verify batch.triggerByTaskAndWait patterns against current v4 docs before implementation.

Phases with well-documented standard patterns (skip research-phase):
- **Phase 0:** Service provisioning is mechanical (Neon, Upstash, Vercel, Railway all have documented one-click setups).
- **Phase 2:** shadcn/ui + Tailwind v4 + next-themes dark mode is the documented default path for new projects.
- **Phase 3:** Auth.js v5 with Drizzle adapter + Resend email provider and OAuth proxy for Vercel previews has a known, documented solution.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All choices verified against official docs (Anthropic, Auth.js, Neon, Trigger.dev, Voyage AI, shadcn/ui). Cost estimates modeled from official pricing. |
| Features | HIGH | Table stakes and differentiators grounded in competitor analysis (Techmeme, Feedly, Particle, buzzing.cc) and domain-specific Chinese market constraints. |
| Architecture | HIGH | Deployment topology, data model, and pipeline flow are consistent across sources. Clustering threshold is the only empirically uncertain element. |
| Pitfalls | HIGH | All critical pitfalls verified against official docs or established community patterns. ICP, GFW, and RSSHub instability are well-documented real risks. |

**Overall confidence: HIGH**

### Gaps to Address

- **Clustering threshold (0.82 starting point):** No production data exists yet. Reserve 2 weeks of manual cluster review post-launch to calibrate. Store threshold in settings table for zero-downtime adjustment.
- **Full-text extraction coverage:** Unknown what percentage of sources will provide full text vs. excerpts. Instrument the extraction step to log success/failure rate per source. Expect 30–60% of sources to require extraction.
- **X/Twitter RSSHub route stability:** X's API changes and scraping countermeasures make this the highest-volatility source. Treat X sources as best-effort in v1; prioritize HN, Reddit, and official lab blogs for reliability.
- **WeWe RSS 公众号 rate limits:** Adding 公众号 sources too quickly triggers 24-hour lockouts. Document the 5–10 accounts/day limit and enforce it operationally, not in code.
- **Langfuse cost at scale:** At 3 traces/item x 144k items/month, Langfuse exceeds the free tier (50k events/month) and moves to $29/mo. Budget for this from launch.

---

## Sources

### Primary (HIGH confidence)
- Anthropic Models Overview + Pricing (official) — model IDs, prompt caching pricing, Haiku vs. Sonnet cost comparison
- Voyage AI blog (official) — voyage-3.5 multilingual MTEB benchmarks, pricing
- Trigger.dev v4 docs + announcement (official) — long-running compute, AI workload design
- Auth.js v5 docs (official) — App Router setup, Drizzle adapter, OAuth proxy for preview URLs
- Neon pgvector docs (official) — pgvector version, HNSW index support
- Upstash Redis docs (official) — Vercel KV sunset Dec 2024, canonical replacement
- shadcn/ui Tailwind v4 docs (official) — v4 as current default
- RSSHub deployment docs (official) — Docker config, env vars, route stability notes
- OWASP LLM01:2025 Prompt Injection (official) — indirect prompt injection risk classification

### Secondary (MEDIUM confidence)
- Drizzle vs. Prisma 2026 (bytebase.com, makerkit.dev) — cold-start benchmarks, bundle size comparison
- Neon vs. Supabase 2026 (devpick.io, bytebase.com) — pricing and architecture tradeoffs
- Vercel China access guide (Vercel KB) — HK/SG edge nodes for mainland access
- WeWe RSS GitHub (cooderl/wewe-rss) — 公众号 RSS alternative, rate limit behavior
- Particle.news TechCrunch coverage — cross-source clustering in competitor products
- LLM-enhanced news clustering research (arxiv 2406.10552) — semantic clustering validation

### Tertiary (LOW confidence)
- Better Auth / Auth.js merger discussion (GitHub discussion #13252) — noted but not acted on for v1 scope
- Embedding model pricing aggregator (awesomeagents.ai) — used for secondary cost validation only

---

*Research completed: 2026-04-17*
*Ready for roadmap: yes*
