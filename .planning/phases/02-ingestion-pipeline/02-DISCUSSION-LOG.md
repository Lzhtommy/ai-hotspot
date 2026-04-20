# Phase 2: Ingestion Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 02-ingestion-pipeline
**Areas discussed:** Cron topology, URL normalization, Source health accounting, Fields + seeding, Source-local timezone storage, RSS body shape, LLM handoff, Per-source budget

---

## Cron topology

| Option | Description | Selected |
|--------|-------------|----------|
| Fan-out to per-source tasks | Scheduled parent enumerates active sources and triggers a child `fetchSource` task per source via `batch.trigger`. Isolation is structural. | ✓ |
| Single task, Promise.allSettled internally | One scheduled task loops sources in one run; isolation via try/catch per source. Cheaper; coarser retry. | |
| Hybrid queue table | Scheduled task writes ingest rows; second task drains them per-source. Most moving parts. | |

**User's choice:** Fan-out to per-source tasks.
**Notes:** Drives INGEST-07 isolation by structure rather than by discipline. Each source has its own run record, retry budget, and timeout → easier debugging + better admin/health observability later.

---

## URL normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Medium: strip UTM/fbclid/gclid, drop fragment, trailing slash, force https + lowercase host | Pure string transform. Catches most cross-source duplicates. | ✓ |
| Aggressive: medium + resolve shortlinks (t.co, bit.ly) via HEAD | Catches more Twitter duplicates but adds HTTP I/O, latency, and a failure mode. | |
| Minimal: drop fragment + trailing slash only | Safest but leaves UTM-variant duplicates for clustering (Phase 3) to resolve. | |

**User's choice:** Medium.
**Notes:** Shortlink resolution was noted as a Phase 3 cluster-time retry path if Twitter-sourced items show cross-source clustering misses.

---

## Source health accounting

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: empty = zero NEW items after dedup | error_count ++ on exception; empty_count ++ when fetch succeeds but yields zero new items after fingerprint dedup; both reset when ≥ 1 new item. | ✓ |
| Lenient: empty = zero ENTRIES in feed | A steady-state source that returns the same 20 items every hour never trips empty_count. | |
| Error-only tracking | Drops INGEST-06's empty_count requirement. | |

**User's choice:** Strict.
**Notes:** Required for ADMIN-06 red-indicator semantics to accurately surface stale sources (not just broken ones).

---

## Fields persisted + seeding

| Option | Description | Selected |
|--------|-------------|----------|
| title + URL + published_at + body_raw (HTML from RSS description); seed 3 canary sources via migration | Phase 2 persists enough for Phase 3 to do LLM work; canary seed enables end-to-end cron verification. | ✓ |
| title + URL + published_at only; body_raw deferred to Phase 3 LLM-02 | Minimal Phase 2; Phase 3 re-fetches article body via Readability. | |
| Minimal fields + no seeding (user inserts sources manually) | Cleanest separation but blocks end-to-end testing until user SQLs rows in. | |

**User's choice:** body_raw from RSS + seed 3 canary sources.
**Notes:** Canary sources chosen: Anthropic Blog, HN AI front-page (via RSSHub), buzzing.cc. Exact RSSHub routes confirmed by planner at research time.

---

## Source-local timezone storage

| Option | Description | Selected |
|--------|-------------|----------|
| Add migration: `published_at_source_tz TEXT` with RFC3339 + offset | Additive schema change; literal satisfaction of INGEST-05 "preserved separately". | ✓ |
| TIMESTAMPTZ alone is sufficient | Postgres stores UTC instant; tz offset is reproducible at read time. Risk of auditor reading INGEST-05 strictly. | |
| Drop the source-local requirement from REQUIREMENTS.md | Avoid schema change by rewriting spec. | |

**User's choice:** Add TEXT column.
**Notes:** Nullable — not all RSS entries carry an explicit offset. Planner adds migration `0002_*`.

---

## RSS body shape

| Option | Description | Selected |
|--------|-------------|----------|
| Store raw HTML verbatim (50KB cap) | Full fidelity; Phase 3's LLM-02 does its own cleaning. | ✓ |
| Strip to plain text at ingest | Smaller rows but irreversible; loses link/heading structure. | |
| Store both body_raw and body_text | Schema-invasive, duplicates Phase 3's responsibility. | |

**User's choice:** Raw HTML with 50KB truncation sentinel.
**Notes:** Truncation appends `<!-- truncated -->`.

---

## LLM handoff mechanism (INGEST-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Status-only: write `status='pending'`; Phase 3 defines pickup | Decouples Phase 2 from Phase 3's unknown design. `pending` IS the queue. | ✓ |
| Phase 2 triggers Phase 3 task explicitly via batch.trigger after insert | Tighter coupling; forces per-item pickup shape onto Phase 3. | |
| Write separate `ingest_queue` table row | Duplicates what `items.status` already encodes. | |

**User's choice:** Status-only handoff.
**Notes:** Interpretation of "enqueued for LLM processing" in INGEST-04 — `pending` is the enqueued state; Phase 3 owns consumption.

---

## Per-source time budget

| Option | Description | Selected |
|--------|-------------|----------|
| 90s hard budget per source | Covers 60s cold-start + ~30s parse/dedup/insert. | ✓ |
| 180s budget per source | More generous; slower to detect stuck sources. | |
| No explicit budget | Relies on fetchRSSHub's 60s + DB defaults. Harder to reason about. | |

**User's choice:** 90s.
**Notes:** Enforced via per-task Trigger.dev `maxDuration`.

---

## Claude's Discretion

- File/folder layout under `src/trigger/` and `src/lib/ingest/` (normalizer, parser, dedup helpers).
- RSS parser library choice (rss-parser / fast-xml-parser / feedparser-node) — planner documents in the plan's research findings.
- Exact Trigger.dev v4 `batch.trigger` vs `batch.triggerAndWait` API shape — resolved at planner research time against live Trigger.dev v4 docs.
- Whether to write `pipeline_runs` rows for ingest runs — default NO; add later if observability demands it.
- Error log structure — any format acceptable as long as RSSHub access key is scrubbed.

## Deferred Ideas

- Shortlink resolution (Phase 3 cluster-time if needed).
- `pipeline_runs` rows for ingestion runs (can be added with Phase 6 OPS work).
- "Skip recently polled" optimization via `last_fetched_at` (not needed; UNIQUE handles idempotency).
- Dead-source auto-deactivation (Phase 6 admin feature).
- `body_text` (HTML-stripped) column (Phase 3 LLM-02 derives text as needed).
- Multi-poll-per-hour / burst handling (out of scope for v1 hourly cadence).
- HF Space keep-alive ping (still deferred from Phase 1).
