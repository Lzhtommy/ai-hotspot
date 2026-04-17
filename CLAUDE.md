<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI Hotspot**

A public-facing Chinese-language webpage that aggregates AI news from across the internet — official lab blogs (Anthropic/OpenAI/DeepMind), social (X/Twitter), forums (Hacker News, Reddit), and Chinese sources (公众号, 微博, buzzing.cc 等) — all ingested via a self-hosted RSSHub. Claude (Anthropic) scores each item's "hotness," summarizes into Chinese, clusters duplicate events across sources ("另有 10 个源也报道了此事件"), and writes a one-line 推荐理由. The feed is presented timeline-style per the "AI HOT" reference design.

**Core Value:** **A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.**

### Constraints

- **Tech stack**: Next.js (App Router, TypeScript) — specified by user
- **UI language**: Chinese only in v1
- **LLM provider**: Claude (Anthropic) for scoring, summarization, clustering, 推荐理由
- **Hosting**: Vercel for Next.js app + managed services for DB / cache / cron. Self-hosted RSSHub on a VPS (RSSHub's deployment model precludes Vercel)
- **Ingestion cadence**: Hourly polling (not real-time), to balance freshness and LLM cost
- **Design anchor**: Reference screenshot — dark theme, green accent, timeline layout, source+score+tags+推荐理由 card structure
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version / ID | Purpose | Why Recommended |
|------------|-------------|---------|-----------------|
| Next.js App Router | 15.x | Full-stack framework, RSC, routing | Already decided; ISR + RSC-first is the correct model for this product |
| TypeScript | 5.x | Type safety | Already decided |
| Neon Postgres | Serverless (managed) | Primary database + pgvector | Serverless-native, native Drizzle driver, pgvector built-in, Vercel integration, database branching for CI |
| Drizzle ORM | `drizzle-orm` latest | Type-safe SQL ORM | Edge-native, tiny bundle, no cold-start penalty, SQL-close API matches pgvector usage well |
| Inngest | Latest | Hourly ingestion cron + background job orchestration | Vercel Marketplace integration, step functions with retries, scheduled cron, no separate worker infra |
| Upstash Redis | Serverless (managed) | Rate limiting, feed caching, dedup lock | HTTP-first, edge-compatible, pay-per-request — no connection pool pain |
| Auth.js v5 (NextAuth) | `next-auth@5` | Email + OAuth (Google, GitHub) login | 2.5M weekly downloads, native App Router support, self-hosted (no user-data vendor lock-in), Drizzle adapter available |
| `@anthropic-ai/sdk` | `^0.26.0+` | Claude API — scoring, summary, tags, clustering | Official SDK; prompt caching supported since 0.26.0 |
| shadcn/ui + Tailwind v4 | shadcn latest, Tailwind 4.x | UI components, dark theme | Tailwind v4 is now the shadcn default; CSS variable theming matches the reference dark-green design |
| Langfuse | Cloud (self-hostable) | LLM cost tracking + trace observability | Open-source, generous free tier (50k events/mo), per-trace cost breakdown by model, prompt versioning |
| Sentry | Latest | Error monitoring | Native Next.js App Router support via `npx @sentry/wizard -i nextjs`; one command setup |
| RSSHub | `diygod/rsshub:latest` | Self-hosted RSS feed normalizer | Official recommendation; Docker on VPS; Railway one-click deploy |
## 1. Next.js Rendering Strategy
- **Feed pages** (`/`, `/精选`, `/全部`): Use ISR with `revalidate = 300` (5 minutes). Feed updates hourly from ingestion; 5-minute revalidation balances SEO freshness with CDN performance. Vercel Pro plan required for sub-hourly Vercel cron; ISR is independent and works on all plans.
- **Item detail page** (`/item/[id]`): ISR with `revalidate = 3600`. Item data is immutable after processing.
- **User pages** (`/favorites`, `/profile`): Dynamic RSC (`no-store`) — user-specific, cannot be cached at CDN layer.
- **Admin pages**: Dynamic RSC behind auth check.
- **Home/landing**: Static (`export const dynamic = 'force-static'`).
- Cards, timeline, sidebar: Server Components (zero JS shipped).
- Like/favorite buttons, infinite scroll triggers, search input: Client Components (`'use client'`).
- State management: **None needed beyond RSC + URL state** (`nuqs` for URL query params if needed). React Context only for theme toggle.
## 2. Database: Neon + Drizzle ORM
- **vs Supabase**: Supabase bundles auth, storage, realtime — we don't need those (using Auth.js + Inngest + no realtime). Supabase's bundled features add $25+/mo overhead for unused services. Neon's pure-Postgres model at $19/mo (or free tier with auto-suspend) is the right fit when you own your own auth.
- **vs Vercel Postgres**: Vercel Postgres *is* Neon under the hood, but with a Vercel pricing markup. Use Neon directly for lower cost and access to Neon's database branching feature (invaluable for CI/CD preview deployments).
- **pgvector**: Neon supports pgvector v0.8.1+ natively — just `CREATE EXTENSION vector;`. No separate vector DB needed.
- Drizzle has no native binary / Rust engine. Bundle size is ~90% smaller. Vercel serverless cold starts are under 500ms vs 1-3s for Prisma.
- Edge-runtime compatible out of the box (needed for potential Vercel Edge Middleware rate limiting).
- `drizzle-orm/neon-http` driver is purpose-built for Neon's serverless HTTP transport — single roundtrip per query, no TCP connection pool management.
- Schema is TypeScript-first; types update instantly without a code generation step.
- Prisma 7 narrowed the gap but Drizzle remains the better default for Vercel/serverless.
## 3. Queue / Cron: Inngest
- **vs Vercel native cron**: Vercel Hobby = 1 cron/day max. Vercel Pro = 40 crons, hourly possible — but cron only triggers a route; no retry logic, no step functions, no fan-out. If the ingestion job times out (Vercel has 5-min function limit on Pro) with no retry, items are silently dropped.
- **vs QStash**: QStash is purely HTTP delivery — good for simple fire-and-forget but no orchestration primitives (steps, sleep, fan-out, concurrency limits). Hourly ingestion that calls Claude per item needs fan-out and per-item retry, which QStash cannot express cleanly.
- **vs Trigger.dev**: Trigger.dev v3 runs on dedicated compute (no serverless timeouts), which is better for very long jobs. But it's a separate infra layer. For this product at hourly cadence with ~50-200 items per run, Inngest calling Vercel serverless functions is sufficient, simpler, and has Vercel Marketplace one-click integration.
## 4. Event Clustering: pgvector + Embedding API
- **`text-embedding-3-small` (OpenAI)** — $0.02/MTok, 1536 dimensions, strong multilingual (Chinese + English). Batch API gives 50% discount ($0.01/MTok). At 200 items/hour × ~300 tokens = 60k tokens/hour = 1.44M tokens/month → ~$0.03/month. Effectively free.
- **`voyage-4-lite` (Voyage AI)** — $0.02/MTok, same cost, slightly better MTEB on retrieval benchmarks. Reasonable alternative.
## 5. Auth: Auth.js v5 (NextAuth)
- **vs Clerk**: Clerk is managed SaaS — user PII lives in Clerk's US infrastructure. For a Chinese-user product, this creates potential data-residency concerns (PIPL compliance risk). Clerk charges $0.02/MAU after 10k free MAUs — at moderate traffic this adds meaningful cost. Clerk's prebuilt UI is English-first and not easily localizable to Chinese.
- **vs Supabase Auth**: We're not using Supabase as DB, so pulling in Supabase Auth just for auth creates an extra managed dependency with no benefit.
- **vs Better Auth**: Better Auth is newer (2024) and more feature-rich (built-in 2FA, passkeys), but Auth.js v5 now has Better Auth team maintenance per the Sept 2025 announcement. For v1 of this product (email + Google + GitHub only, no 2FA), Auth.js v5 is simpler to set up and has mature documentation. Migrate to Better Auth in v2 if RBAC/2FA is needed.
- Providers: `Google`, `GitHub`, `Resend` (email magic link — no password complexity)
- Adapter: `@auth/drizzle-adapter` — sessions stored in Neon Postgres
- Strategy: database sessions (revocable, supports server-side session invalidation on ban)
- Anonymous read: middleware allows unauthenticated access to feed routes; auth gate only on `/favorites`, `/profile`, POST actions
## 6. RSSHub Deployment
- The constraint says "self-hosted RSSHub on a VPS." Railway is technically a PaaS, but it runs Docker containers on dedicated compute and is what "self-hosted via Docker" means in practice for a small team. It removes OS/Nginx/SSL/uptime management burden.
- Railway has a one-click RSSHub deploy template (verified March 2026).
- Alternative if true bare-metal VPS is required: Hetzner CAX11 (ARM, €3.29/mo) or CX22 (AMD, €3.79/mo) + Docker Compose + Nginx + Certbot. Use `watchtower` for auto-updates. Set `ALLOW_USER_HOTLINK=false` to prevent public abuse.
## 7. Anthropic SDK: Model Selection + Prompt Caching
| Task | Model | API ID | Cost (input/output per MTok) | Rationale |
|------|-------|--------|------------------------------|-----------|
| Hotness scoring (0–100) + 推荐理由 (1 line) | **Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 / $5 | Structured output (JSON score + one-liner); fast; low reasoning complexity |
| Chinese summary (2–4 sentences) + auto-tagging | **Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 / $5 | Chinese generation quality is good at Haiku 4.5; tagging is classification, not reasoning |
| Translation (English → Chinese) | **Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 / $5 | MT quality sufficient; dedicated MT API (DeepL/Google) is not needed — Claude is already in the pipeline |
| Cluster boundary decisions (ambiguous items) | **Sonnet 4.6** | `claude-sonnet-4-6` | $3 / $15 | Used rarely — only when embedding similarity is in the 0.80–0.88 grey zone; Haiku makes mistakes here |
## 8. Chinese Translation
- Claude Haiku 4.5 produces publication-quality Chinese for AI domain content; it understands technical jargon better than generic MT APIs.
- Adding DeepL or Google Translate adds a second API dependency, a second billing relationship, and a second failure mode.
- The translation is already in the pipeline (same API call as scoring) — no extra latency.
- Cost: Haiku 4.5 at $1/MTok input handles a 500-token English article for ~$0.0005. Negligible.
## 9. Observability
| Layer | Tool | Purpose | Cost |
|-------|------|---------|------|
| Error monitoring | Sentry | Exceptions, stack traces, session replay | Free tier (5k errors/mo); paid from $26/mo |
| LLM observability | Langfuse | Trace every Claude call: latency, token count, cost, cache hit rate | Free tier: 50k events/mo; paid from $29/mo |
| Web analytics | Vercel Analytics | Page views, Web Vitals, geography | Free tier included with Vercel; no cookie banner needed |
## 10. Styling: Tailwind v4 + shadcn/ui
- Tailwind v4 is the current shadcn/ui default as of early 2025. New projects init with v4 automatically.
- No `tailwind.config.js` needed in v4 — config lives in CSS via `@theme` directive.
- Dark mode: `next-themes` library + `suppressHydrationWarning` on `<html>`. Set dark as default and only theme (UI is dark-only in v1).
- Green accent: define `--color-accent: oklch(...)` in `@theme` to match reference design's green (#00ff41 / similar terminal green). shadcn/ui components inherit via CSS variable.
- `tailwindcss-animate` was deprecated March 2025 — use `tw-animate-css` or inline animations.
## 11. State Management
- Feed data: fetched server-side in RSC, no client state required.
- Auth session: accessed via `auth()` server-side or `useSession()` client-side (Auth.js built-in).
- URL state (active tab, filters): `nuqs` for type-safe URL search params — avoid `useState` for shareable state.
- Like/favorite optimistic state: React `useOptimistic` hook (built into React 18+) — no Redux/Zustand needed.
- Theme: `next-themes` context (single provider, no external state library).
## 12. Image / Avatar Handling for Source Logos
- Source logos (RSS feed favicons, platform logos) are small, change infrequently, and number fewer than 50 in v1.
- Store as `public/logos/<source-slug>.svg` or `.png`. Commit to repo.
- Use `next/image` with `width/height` to avoid CLS; set `unoptimized` for SVGs.
- Do **not** use Cloudinary or S3 for logos — unnecessary complexity at this scale.
- For user avatars (Google/GitHub OAuth): use the OAuth provider avatar URL directly via `next/image` with the provider domain added to `next.config.js` `remotePatterns`. No upload needed.
## Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@neondatabase/serverless` | latest | Neon HTTP driver for Drizzle | Always — replaces `pg` in serverless |
| `drizzle-kit` | latest (0.31.x+) | Schema migrations | Dev time; `drizzle-kit push` for schema sync |
| `@auth/drizzle-adapter` | latest | Auth.js + Drizzle sessions/users table | Auth setup |
| `resend` | latest | Transactional email (magic links) | Auth.js email provider |
| `@upstash/redis` | latest | Redis client (HTTP) | Rate limiting, feed-level caching |
| `@upstash/ratelimit` | latest | Sliding window rate limiting | API routes + Edge Middleware |
| `openai` | latest | OpenAI embedding API client | Item embedding generation |
| `nuqs` | latest | URL search param state management | Feed filters, tab state |
| `langfuse` | latest | LLM observability SDK | Every Claude API call |
| `zod` | 3.x | Runtime schema validation | API route inputs, LLM JSON output parsing |
| `date-fns` | 4.x | Date formatting | Timeline grouping by time |
## Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `drizzle-kit` | Schema migrations + introspection | `drizzle-kit push` for dev, `drizzle-kit migrate` for prod |
| Neon branching | Per-PR database isolation | Create branch per preview deploy in CI |
| `@sentry/wizard` | Sentry auto-setup | `npx @sentry/wizard -i nextjs` — creates all config files |
| ESLint + Prettier | Linting + formatting | Use `eslint-config-next` |
| Biome | Optional faster alternative to ESLint+Prettier | If ESLint config becomes unwieldy |
## Installation
# Core framework (already decided)
# UI components
# Database
# Auth
# Background jobs
# Cache / rate limiting
# LLM + observability
# Utilities
# Error monitoring
## Alternatives Considered
| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Database | Neon | Supabase | Supabase bundles unused services; higher cost; auth overlap with Auth.js |
| Database | Neon | Vercel Postgres | Vercel Postgres = Neon with markup; lose direct Neon branching feature |
| ORM | Drizzle | Prisma | Prisma binary causes cold-start penalty; larger bundle; edge-runtime friction |
| Queue/cron | Inngest | Vercel native cron | No retry/step/fan-out; 5-min timeout kills LLM pipeline; Hobby = 1/day limit |
| Queue/cron | Inngest | QStash | No orchestration primitives for multi-step fan-out |
| Queue/cron | Inngest | Trigger.dev | Separate infra layer unnecessary for hourly cadence; same cost complexity |
| Auth | Auth.js v5 | Clerk | User PII in US infra (PIPL risk); $0.02/MAU; English-first prebuilt UI |
| Auth | Auth.js v5 | Better Auth | Newer/less mature docs; overkill for v1 email+OAuth scope |
| Auth | Auth.js v5 | Supabase Auth | Adds Supabase dependency for no benefit (DB is Neon) |
| LLM observability | Langfuse | Helicone | Helicone proxy-based (extra hop); Langfuse traces are richer; both are free at launch scale |
| State management | None (RSC) | Zustand | No global state needed; RSC eliminates client-side data fetching overhead |
| RSSHub hosting | Railway Docker | Bare VPS (Hetzner) | Railway removes OS/SSL/uptime overhead; Hetzner valid if budget is critical |
| Embedding | text-embedding-3-small | Cohere Embed 4 | Cohere $0.10/MTok vs $0.02; no advantage for this use case |
| Translation | Claude Haiku | DeepL / Google Translate | Extra API + billing; Claude quality is sufficient; already in pipeline |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma (v6 or earlier) | Large bundle, cold-start penalty, Rust binary friction on Vercel | Drizzle ORM |
| Supabase for everything | Unnecessary bundling of auth+storage+realtime we don't need; higher base cost | Neon (DB) + Auth.js (auth) + Inngest (async) |
| Clerk | US-hosted user PII, per-MAU cost, English-first prebuilt UI not suitable for Chinese-only product | Auth.js v5 |
| Vercel native cron alone | 5-min timeout, no retry, no fan-out, Hobby plan = 1/day | Inngest (with optional Vercel cron as Inngest trigger backup) |
| Redux / Zustand / Jotai | Zero justification in RSC-first app | React `useOptimistic` + `nuqs` for URL state |
| Separate vector DB (Pinecone, Qdrant, Weaviate) | pgvector in Neon handles <1M vectors comfortably with HNSW index; no separate infra needed | pgvector extension on Neon |
| WeChat OAuth in v1 | Requires ICP registration or routing through a Chinese server; substantial compliance overhead | Email magic link (Resend) as universal fallback |
| MinHash for clustering | Detects near-duplicate text (exact), not semantic duplicates across sources | pgvector cosine similarity |
| `tailwindcss-animate` | Deprecated March 2025 | `tw-animate-css` or custom keyframes |
| Real-time subscriptions (Supabase realtime, Pusher) | Hourly polling is sufficient; real-time multiplies infra+LLM cost | ISR revalidation + client-side polling at low frequency |
## Cost Model (Monthly Estimates at Moderate Traffic)
| Line Item | Estimate | Notes |
|-----------|----------|-------|
| Neon Postgres | $19/mo | Launch plan; auto-suspend on idle |
| Vercel (Pro) | $20/mo | Required for hourly Vercel cron (if used as Inngest trigger) or >10 GB bandwidth |
| Inngest | $20/mo | ~144k runs/month (200 items × 24h × 30d) |
| Upstash Redis | ~$0–5/mo | Pay-per-request; very low at this scale |
| Anthropic (Claude) | ~$15–40/mo | 200 items/hr × 24 × 30 = 144k items/mo; Haiku 4.5 at ~500 input + 150 output tokens each = ~94M tokens; at $1 input + $5 output → ~$15–20/mo; with prompt caching ~60% reduction → ~$8–12/mo |
| OpenAI embeddings | ~$0.10/mo | 144k items × ~300 tokens = 43M tokens × $0.02/MTok |
| Langfuse | $0 | Free tier covers 50k events/mo; at 3 traces/item × 144k = 432k traces → paid ($29/mo) |
| Sentry | $0–26/mo | Free tier if <5k errors/mo |
| Railway (RSSHub) | ~$5/mo | Hobby plan |
| Resend (email) | $0 | Free tier: 3k emails/mo |
| **Total** | **~$90–140/mo** | Before growth; Langfuse main variable |
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next-auth@5` | Next.js 14+ App Router | v5 is stable for production as of 2025 |
| `@auth/drizzle-adapter` | `drizzle-orm` latest | Must use same Drizzle version |
| `drizzle-orm/neon-http` | `@neondatabase/serverless` latest | Pinned to Neon serverless driver |
| Tailwind v4 | shadcn/ui latest | shadcn switched to v4 default in early 2025; older shadcn components need updating |
| `@anthropic-ai/sdk` >=0.26.0 | `cache_control` on content blocks | Versions below 0.26 lack prompt caching support |
| `inngest` v3 | Next.js App Router Route Handlers | v3 required for Standard Schema support (Zod 4 compat) |
## Sources
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — model IDs, pricing, context windows (HIGH confidence, official)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — token pricing, batch API, prompt caching multipliers (HIGH confidence, official)
- [Anthropic SDK TypeScript — Context7](/anthropics/anthropic-sdk-typescript) — prompt caching API, batch API examples (HIGH confidence)
- [Drizzle ORM Docs — Context7](/drizzle-team/drizzle-orm-docs) — Neon driver integration, serverless patterns (HIGH confidence)
- [NextAuth / Auth.js — Context7](/nextauthjs/next-auth) — App Router setup, provider config (HIGH confidence)
- [Neon pgvector docs](https://neon.com/docs/extensions/pgvector) — pgvector support confirmed in Neon (HIGH confidence)
- [Inngest Vercel integration](https://vercel.com/marketplace/inngest) — Marketplace availability, step function patterns (HIGH confidence)
- [RSSHub Deployment](https://docs.rsshub.app/deploy/) — Docker config, env vars (HIGH confidence, official)
- [Railway RSSHub deploy](https://railway.com/deploy/rsshub) — one-click template (HIGH confidence, verified March 2026)
- [Vercel Cron pricing/limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby = 1/day, Pro = 40/plan (HIGH confidence, official)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — v4 is current default (HIGH confidence, official)
- [Better Auth / Auth.js merger discussion](https://github.com/nextauthjs/next-auth/discussions/13252) — Auth.js team recommends Better Auth for new projects (MEDIUM confidence — community discussion)
- Drizzle vs Prisma 2026: [bytebase.com](https://www.bytebase.com/blog/drizzle-vs-prisma/), [makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — cold start benchmarks, bundle size comparison (MEDIUM confidence — third-party, consistent across sources)
- Neon vs Supabase 2026: [devpick.io](https://www.devpick.io/compare/neon-vs-supabase), [bytebase.com](https://www.bytebase.com/blog/neon-vs-supabase/) — pricing, architecture tradeoffs (MEDIUM confidence — third-party)
- Langfuse vs Helicone: [firecrawl.dev](https://www.firecrawl.dev/blog/best-llm-observability-tools), [helicone.ai](https://www.helicone.ai/blog/the-complete-guide-to-LLM-observability-platforms) — feature comparison (MEDIUM confidence)
- Embedding model pricing March 2026: [awesomeagents.ai](https://awesomeagents.ai/pricing/embedding-models-pricing/) (MEDIUM confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
