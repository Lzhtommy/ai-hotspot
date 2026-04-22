# Phase 4: Feed UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 04-feed-ui
**Areas discussed:** Design authority (user pointed at an external Claude Design bundle)

---

## Gray area selection

The agent presented four candidate gray areas for discussion:

| Option | Description | Selected |
|--------|-------------|----------|
| Design-system foundation & shell | shadcn/ui vs plain Tailwind; left sidebar vs top nav vs minimal; dark-only lock strategy; green accent token. | |
| Card anatomy & timeline grouping | Per-item card layout (score/summary/推荐理由/tags/cluster-badge placement); timeline HH:MM grouping; source badge + cluster count rendering. | |
| List behavior: /all filters + pagination | Infinite scroll vs numbered pagination vs load-more for /all (FEED-02); source/tag filter UI (sidebar vs chips vs URL via nuqs) (FEED-12); sort options. | |
| Perf boundary: fonts, cache, OG share | Noto Sans SC self-hosting strategy (FEED-08); Redis feed-cache key/shape/invalidation (FEED-10); static vs dynamic OG image for WeChat share cards (FEED-09). | |

**User's choice:** Bypassed all four options with a directive:

> "Fetch this design file, read its readme, and implement the relevant aspects of the design.
> https://api.anthropic.com/v1/design/h/Gnl68f9I-jvh1_hVQfHJvw?open_file=index.html
> Implement: index.html."

**Interpretation:** The design bundle at that URL is the authoritative answer to every gray area the agent raised. Rather than iterating over four Q&A rounds, the user supplied the pre-iterated design artifact.

**Notes:** The user's phrasing "implement the relevant aspects" is scoped by `/gsd-discuss-phase` — i.e., capture the design's implications in CONTEXT.md so the downstream planner and executor can implement it, not build it immediately in this turn.

---

## Design bundle — what was fetched

- URL returned a gzipped tar archive (37.4 KB) from Claude Design (claude.ai/design).
- Archive contents extracted to `.design/feed-ui/` in the repo:
  - `README.md` — handoff instructions to coding agents
  - `chats/chat1.md` — the designer's reasoning transcript
  - `project/index.html` — the HTML entry point (light theme + data-theme="dark" override block)
  - `project/src/*.jsx` — 7 component files (`app.jsx`, `data.jsx`, `primitives.jsx`, `sidebar.jsx`, `feed_card.jsx`, `feed_views.jsx`, `admin_views.jsx`, `tweaks.jsx`)
  - `project/ds/colors_and_type.css` — design tokens (CSS custom properties)
  - `project/ds/fonts/README.md` — self-hosted Geist + JetBrains Mono strategy
  - `project/ds/icons/` — 46 feather-style SVG icons + README
  - `project/ds/logo-mark.svg`

## Key design decisions extracted from the bundle

| Design decision | Source | Mapped to CONTEXT.md |
|-----------------|--------|----------------------|
| Paper + honey-amber (`#D4911C`) palette, dark mode as toggle-only | `index.html`, `colors_and_type.css`, `chats/chat1.md` line 29 | D-02, D-03 |
| 224px fixed left sidebar + top bar + main scroll column | `sidebar.jsx` line 76; `feed_views.jsx` lines 6–68 | D-08 |
| Reader nav: 精选 / 全部 AI 动态 / 低粉爆文(V2) / 收藏 | `sidebar.jsx` `NAV_READER` | D-09 |
| Admin nav: 信源 / 信源提报(V2) / 策略 / 用户 / 后台 | `sidebar.jsx` `NAV_ADMIN` | D-10 |
| Hour-bucket grouping with 今天/昨天/M月D日 labels | `feed_views.jsx` `groupByHour`, `hourLabel` | D-20, D-21 |
| Card: source-dot + meta row → title → summary → amber 推荐理由 callout → tags → cluster trigger → actions | `feed_card.jsx` lines 86–233 | D-17 |
| Score badge: numeric 18px mono + HOT chip ≥80 | `primitives.jsx` `ScoreBadge` | D-19 |
| Cluster trigger: dashed button with stacked monograms + "另有 N 个源也报道了此事件" | `feed_card.jsx` `ClusterTrigger` | D-17 step 6 |
| Cluster siblings: expand inline with bordered list | `feed_card.jsx` `ClusterSiblings` | D-17 step 7 |
| Self-hosted Geist + JetBrains Mono (no Google Fonts) | `ds/fonts/README.md` | D-05 |
| Feather-style SVG icon set (46 icons) | `ds/icons/` | D-06 |
| Source visual identity via colored-monogram `SourceDot` (not logos) | `primitives.jsx` `SourceDot` | D-07 |
| Tag tones: accent / success / info / danger / neutral | `primitives.jsx` `Tag` | D-17 step 5 |
| Pipeline status card in sidebar footer | `sidebar.jsx` lines 148–172 | D-11 |
| Tweaks panel with density / badge-style / show-reason (not user-facing) | `tweaks.jsx`, `app.jsx` TWEAK_DEFAULTS | D-18, D-19 (preserved in code, not exposed) |

## Conflicts with REQUIREMENTS.md and how they resolved

| Conflict | REQUIREMENTS text | Design | Resolution |
|----------|-------------------|--------|------------|
| Theme | FEED-06: "Dark-theme design matches reference screenshot (green accent...)" | Paper+amber, dark-as-toggle | Design wins (D-02, D-03). CONTEXT.md documents the override so future audits don't read it as a bug. |
| Fonts | FEED-08: "CJK fonts self-hosted (Noto Sans SC subset); never loaded from Google Fonts" | Design uses Geist + system CJK fallback; no Noto Sans SC | Resolved in D-05: self-host both Geist (design's primary) AND Noto Sans SC (requirement satisfier). Remove `next/font/google` Geist import. |
| Pagination for /all | FEED-02: "pagination or infinite scroll" | Design shows no pagination control — a single scrolling timeline | Resolved in D-14: pick numbered pagination for RSC+ISR composition. Design is silent on the choice; spec permits either. |

## Claude's Discretion (not asked of the user)

See CONTEXT.md `<decisions>` Claude's Discretion block — items like Tailwind v4 @theme adaptation, icon sprite vs individual files, exact Chinese copy for the login modal, and mobile responsive tactic were not surfaced for user input; the planner decides.

## Deferred Ideas

See CONTEXT.md `<deferred>` for the full list. Summary: runtime theme toggle, featured-strategy bar, infinite scroll, user-exposed tweaks, source logos, ⌘K search, 信源提报, 低粉爆文, detail-page drawer, realtime updates, English UI.
