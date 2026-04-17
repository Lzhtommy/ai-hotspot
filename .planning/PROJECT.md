# AI Hotspot

## What This Is

A public-facing Chinese-language webpage that aggregates AI news from across the internet — official lab blogs (Anthropic/OpenAI/DeepMind), social (X/Twitter), forums (Hacker News, Reddit), and Chinese sources (公众号, 微博, buzzing.cc 等) — all ingested via a self-hosted RSSHub. Claude (Anthropic) scores each item's "hotness," summarizes into Chinese, clusters duplicate events across sources ("另有 10 个源也报道了此事件"), and writes a one-line 推荐理由. The feed is presented timeline-style per the "AI HOT" reference design.

## Core Value

**A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.**

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward v1. -->

**Ingestion & Sources**
- [ ] Self-hosted RSSHub instance provides unified RSS feed across heterogeneous sources
- [ ] Admin can add/edit/remove sources (RSSHub routes or raw RSS URLs) with per-source weight
- [ ] Hourly polling of all active sources; new items enqueued for processing
- [ ] Sources cover: official AI lab blogs, X/Twitter, Hacker News, Reddit, Chinese 公众号/微博

**LLM Processing Pipeline**
- [ ] English source items auto-translated to Chinese
- [ ] Each item receives an LLM-generated Chinese summary (~2–4 sentences)
- [ ] Each item receives a 0–100 hotness score from Claude
- [ ] Each item receives a one-line 推荐理由 (recommendation reasoning, visible on card)
- [ ] Each item receives auto-assigned tags (e.g., Agent, 模型发布, 编码, Anthropic)
- [ ] Cross-source event clustering: items covering the same event are grouped; primary item shows "另有 N 个源也报道了此事件"

**Feed UI**
- [ ] Timeline view grouped by time (matches reference screenshot)
- [ ] "精选" view: top-scoring items filtered by admin-managed global strategies
- [ ] "全部 AI 动态" view: full chronological feed
- [ ] Per-item card: source, title, Chinese summary, tags, score, 推荐理由, cluster count
- [ ] Chinese-only UI (English sources translated in-pipeline)
- [ ] Responsive dark-theme design matching reference

**User Accounts & Interactions**
- [ ] Email + OAuth (Google, GitHub) login
- [ ] Anonymous read; login required for 收藏/like/dislike
- [ ] 收藏 (favorites) view per user
- [ ] Like / dislike per item (feeds future personalization signal)

**Admin Backend**
- [ ] 信源 management: CRUD + weight + health status
- [ ] 用户 management: list, search, ban, role

### Out of Scope

<!-- Explicit v1 boundaries with reasoning. -->

- **低粉爆文 section** — defer to v2; needs social-platform engagement APIs beyond RSSHub and separate ranking logic
- **User-custom curation strategies** — v1 is admin-managed global strategies only; per-user prompts add complexity without proven demand
- **信源提报 (user-submitted source reporting)** — defer; requires moderation workflow and abuse protection
- **策略迭代 tooling** — offline/manual in v1; formal A/B and iteration UI is a v2 concern
- **Analytics / token-usage dashboard** — logs first, dashboards later
- **Multi-language UI** — Chinese-only; English toggle is v2
- **Mobile native apps** — responsive web only
- **Monetization (ads, subscriptions)** — validate the product first
- **Real-time (<5 min) ingestion** — hourly polling is sufficient for AI news cadence; lower cost

## Context

- **Reference design**: Screenshot of an "AI HOT" timeline with sidebar (精选 / 全部 AI 动态 / 低粉爆文 / 收藏 / 信源 / 信源提报 / 策略 / 后台 / 用户). Project mirrors this layout and interaction model but scopes v1 tighter.
- **Why RSSHub**: Normalizes heterogeneous sources (Twitter, 微博, 公众号, forums) into a uniform RSS shape, so the ingestion pipeline stays a single code path and new sources are declarative config, not new crawlers.
- **Why LLM-heavy**: AI news volume is high and noisy across many sources. Rules-based filtering fails at "what matters" — LLM hotness scoring + clustering is the product's differentiator.
- **Claude for Chinese**: Claude produces strong Chinese summaries/reasoning and is the chosen default provider. Cost model assumes Sonnet-class for hot-item scoring and summaries at hourly cadence.
- **Event clustering is the signal**: A story covered by 10 sources is an important story. Cluster count doubles as an implicit popularity signal layered on top of LLM hotness.
- **Greenfield**: No existing code. Next.js App Router chosen for the frontend + API routes + server actions.

## Constraints

- **Tech stack**: Next.js (App Router, TypeScript) — specified by user
- **UI language**: Chinese only in v1
- **LLM provider**: Claude (Anthropic) for scoring, summarization, clustering, 推荐理由
- **Hosting**: Vercel for Next.js app + managed services for DB / cache / cron. Self-hosted RSSHub on a VPS (RSSHub's deployment model precludes Vercel)
- **Ingestion cadence**: Hourly polling (not real-time), to balance freshness and LLM cost
- **Design anchor**: Reference screenshot — dark theme, green accent, timeline layout, source+score+tags+推荐理由 card structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RSSHub as ingestion backbone | Unifies all source types into one code path; adding sources is config not code | — Pending |
| Claude as default LLM | Strong Chinese output; user preference; product is LLM-curation-first so quality matters | — Pending |
| Vercel + managed services | Greenfield, small team — avoid self-hosting the web app. Self-host only RSSHub (Vercel-incompatible) | — Pending |
| Admin-managed global strategies (defer per-user) | v1 simplicity; validate curation with shared strategies before personalization | — Pending |
| Anonymous read, login for interactions | Remove friction for discovery; capture users at the moment of intent (favorite/like) | — Pending |
| Hourly polling over real-time | AI news cadence doesn't need sub-hour freshness; real-time multiplies LLM + infra cost | — Pending |
| 低粉爆文 / user-submitted sources / 策略迭代 UI → v2 | Keep v1 shippable; these add moderation/engagement-API complexity without validating core loop | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after initialization*
