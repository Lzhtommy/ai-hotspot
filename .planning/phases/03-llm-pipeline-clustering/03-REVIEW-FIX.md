---
phase: 03-llm-pipeline-clustering
fixed_at: 2026-04-22T01:53:36Z
review_path: .planning/phases/03-llm-pipeline-clustering/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-22T01:53:36Z
**Source review:** .planning/phases/03-llm-pipeline-clustering/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 Critical + 5 Warning; Info excluded per fix_scope)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: SSRF blocklist misses `0.0.0.0`, IPv4-mapped IPv6, and AWS/GCP metadata endpoint

**Files modified:** `src/lib/llm/extract.ts`, `src/lib/llm/extract.test.ts`
**Commit:** d18d871
**Applied fix:** Extended `isPrivateHost` to block `0.0.0.0` (routes to loopback on Linux) and IPv4-mapped IPv6 addresses. Node 18+ normalizes `[::ffff:169.254.169.254]` to bracketed hex form `[::ffff:a9fe:a9fe]` in `parsed.hostname` — the fix strips brackets, detects `::ffff:` prefix, converts two hex groups to dotted-decimal, and recurses. Also handles dotted-decimal form (e.g., `::ffff:169.254.169.254`) for runtime portability. Added 4 new SSRF test cases (0.0.0.0, IPv4-mapped metadata endpoint, IPv4-mapped RFC1918) raising total tests from 111 to 114.

### CR-02: Centroid string from DB interpolated directly into `sql` template — not parameterized

**Files modified:** `src/lib/cluster/refresh.ts`
**Commit:** bcc1f91
**Applied fix:** Changed `${centroidStr}` to `${sql.param(centroidStr)}` in the centroid UPDATE statement. Drizzle's `sql` tagged template treats plain string interpolations as raw SQL literal substitutions; `sql.param()` forces a parameterized bind value. Added explanatory comment documenting the Drizzle behavior for future maintainers.

### WR-01: `row.sourceLang` null default — no alerting when source row missing

**Files modified:** `src/lib/llm/process-item-core.ts`
**Commit:** 3ed0b6f
**Applied fix:** Extracted `sourceLang` into a local variable with `?? 'en'` fallback, added a `console.warn` log when `row.sourceLang` is null. The warn message includes the `itemId` so orphaned items can be correlated in Sentry/Langfuse logs.

### WR-02: `retriesExhausted` threshold fires one attempt too early

**Files modified:** `src/lib/llm/process-item-core.ts`, `src/lib/llm/process-item-core.test.ts`
**Commit:** 4daafb2
**Applied fix:** Changed `retryCount >= MAX_RETRIES - 1` to `retryCount >= MAX_RETRIES`. With `MAX_RETRIES = 3` this means dead-lettering fires after 3 retryable failures (at `retryCount = 3`) rather than 2, aligning with the `maxAttempts: 3` Trigger.dev budget. Updated two tests that used `retryCount: 2` (the "retriesExhausted" terminal test and the "secret scrub" test) to `retryCount: 3` to match corrected semantics.

### WR-03: `flushOtel` calls `sdk.shutdown()` without resetting `started` — warm workers silently lose spans

**Files modified:** `src/lib/llm/otel.ts`, `src/lib/llm/otel.test.ts`
**Commit:** be61269
**Applied fix:** Added `started = false` after `sdk.shutdown()` in `flushOtel`. This allows warm Trigger.dev workers that reuse the same process across multiple task invocations to re-start the SDK on the next run. Without the reset, `startOtel()` would silently no-op (started=true) while the SDK was shut down, dropping all subsequent Anthropic spans. Added a new test verifying that `startOtel` calls `sdk.start()` a second time after a flush cycle, raising total tests from 114 to 115.

### WR-04: `params.title` interpolated outside the `<untrusted_content>` fence

**Files modified:** `src/lib/llm/prompt.ts`, `src/lib/llm/prompt.test.ts`
**Commit:** 73ed649
**Applied fix:** Moved `Title: ${params.title}` inside the `<untrusted_content>` fence. RSS titles come from the same untrusted source as the body; placing the title outside the XML boundary could let a crafted title influence the model's score/recommendation fields while bypassing the declared injection boundary. Also moved `sourceLang` to its own line before the fence (it is trusted metadata, not user content). Updated the existing test to assert title is inside the fence and sourceLang remains outside it.

### WR-05: `EnrichError('api')` and `ClusterError` missing from error-path classification comment

**Files modified:** `src/lib/llm/process-item-core.ts`
**Commit:** c0c5cbb
**Applied fix:** Replaced the terse "ERROR PATH" comment with a structured classification table distinguishing TERMINAL from RETRYABLE error kinds. Explicitly lists `EnrichError kind='api'`, `EmbedError (non-malformed)`, and `ClusterError` as retryable, and documents the `retryCount >= MAX_RETRIES` budget rule. Added a maintenance note instructing future developers to update both the comment and the `isTerminal` predicate when adding new error kinds.

---

_Fixed: 2026-04-22T01:53:36Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
