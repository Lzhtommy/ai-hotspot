---
phase: 03-llm-pipeline-clustering
plan: "02"
subsystem: llm
tags: [llm, anthropic, voyage, extract, enrich, embed, core, prompt-caching, zod-v4]
dependency_graph:
  requires: [03-01]
  provides: [src/lib/llm/client.ts, src/lib/llm/schema.ts, src/lib/llm/prompt.ts, src/lib/llm/extract.ts, src/lib/llm/enrich.ts, src/lib/llm/embed.ts, src/lib/llm/pricing.ts, src/lib/llm/process-item-core.ts]
  affects: [src/trigger/process-item.ts (Plan 04), src/lib/llm/cluster.ts (Plan 03)]
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.90.0"
    - "voyageai@0.2.1"
    - "zod@3.25.76 (zod/v4 subpath used for EnrichmentSchema)"
    - "@mozilla/readability@0.6.0"
    - "jsdom@29.0.2"
    - "@types/jsdom@28.0.1"
  patterns:
    - "DI-friendly orchestrator pattern (fetch-source-core.ts template)"
    - "Named error class + secret scrub (RSSHubError pattern)"
    - "prompt caching: cache_control ephemeral on static system prompt block"
    - "zod/v4 subpath for SDK 0.90 zodOutputFormat compatibility"
    - "deps.inline voyageai in vitest.config.ts for bare ESM directory import"
key_files:
  created:
    - src/lib/llm/client.ts
    - src/lib/llm/schema.ts
    - src/lib/llm/prompt.ts
    - src/lib/llm/prompt.test.ts
    - src/lib/llm/prompts/rubric.md
    - src/lib/llm/prompts/tag-taxonomy.md
    - src/lib/llm/prompts/few-shot.md
    - src/lib/llm/pricing.ts
    - src/lib/llm/pricing.test.ts
    - src/lib/llm/extract.ts
    - src/lib/llm/extract.test.ts
    - src/lib/llm/enrich.ts
    - src/lib/llm/enrich.test.ts
    - src/lib/llm/embed.ts
    - src/lib/llm/embed.test.ts
    - src/lib/llm/process-item-core.ts
    - src/lib/llm/process-item-core.test.ts
  modified:
    - package.json (5 new deps + @types/jsdom)
    - pnpm-lock.yaml
    - vitest.config.ts (deps.inline voyageai)
decisions:
  - "A1 (zodOutputFormat): FOUND in @anthropic-ai/sdk@0.90.0 at helpers/zod but requires zod/v4 subpath. SDK internally calls require('zod/v4') for z.toJSONSchema() which is v4-only. EnrichmentSchema switched to import { z } from 'zod/v4' and type-cast via 'as never' to satisfy the d.ts that still types ZodType from zod v3."
  - "A2 (VoyageAI embed): CONFIRMED. VoyageAIClient.embed({ input: string[], model: string, inputType: string }) returns { data: Array<{ embedding?: number[] }> }. Exact match to plan docs. EmbedResponse.data[0].embedding is optional in type but present in practice; added undefined guard."
  - "voyageai ESM resolution: voyageai@0.2.1 ESM bundle uses bare directory import (export * from '../api') which Node ESM does not support. Fixed by adding deps.inline: ['voyageai'] in vitest.config.ts. Deprecated in vitest 2.x but functional; TODO upgrade path when vitest 3.x ships."
  - "zod/v4 subpath: zod@3.25 ships both v3 and v4 APIs. Used 'zod/v4' for EnrichmentSchema only (not changing other schemas). ZodError imported from 'zod/v4' in enrich.test.ts and process-item-core.ts."
  - "Secret scrub test: plan case 5 requires retryCount=2 (exhausted) to reach the dead_letter code path that writes failureReason to DB. Test updated to use retryCount:2."
  - "prompt file expansion: original verbatim prompt content (~9KB) produced only 2912 estimated tokens vs 4096 floor. Added scoring guides, calibration tables, tag usage rules, decision flowchart, and additional few-shot examples to reach 16389 chars = 4098 estimated tokens."
metrics:
  duration: "~35 minutes"
  completed: "2026-04-21"
  tasks: 3
  files: 17
---

# Phase 03 Plan 02: LLM-Core Library Modules Summary

Built the complete LLM-core library under `src/lib/llm/` processing one item end-to-end: SSRF-safe full-text extraction, Haiku 4.5 structured-output enrichment (Chinese title/summary/score/推荐理由/tags) with prompt caching, Voyage voyage-3.5 1024-dim embedding, and pipeline_runs audit trail — orchestrated by `runProcessItem` which follows the Phase 2 DI+test template verbatim.

## Open Questions Resolution

### A1: zodOutputFormat — FOUND with caveat

`zodOutputFormat` is exported from `@anthropic-ai/sdk@0.90.0/helpers/zod` as expected. However, the SDK implementation calls `require('zod/v4')` internally (not `require('zod')`), meaning it requires a zod v4-compatible schema for `z.toJSONSchema()` to work.

**Resolution**: `EnrichmentSchema` switched to `import { z } from 'zod/v4'` (the v4 subpath bundled inside zod@3.25+). TypeScript type mismatch between zod v4 `ZodObject` and zod v3 `ZodType` (the d.ts still types against v3) resolved via `EnrichmentSchema as never` cast in two places. Runtime behavior is fully correct.

### A2: VoyageAIClient.embed signature — CONFIRMED

Signature matches plan docs exactly:
```typescript
client.embed({ input: string[], model: string, inputType: 'document' | 'query' })
// returns: { data?: Array<{ embedding?: number[], object?: string, index?: number }> }
```

`VoyageAIClient` class name confirmed in `node_modules/voyageai/dist/esm/Client.d.mts`.

## Actual Token Count

`buildSystemPrompt()[0].text` estimated token count: **4098 tokens** (combined chars: 16,389 / 4 = 4098). Clears the 4096 LLM-08 Haiku 4.5 cache minimum.

## Final Package Versions

| Package | Resolved Version |
|---------|-----------------|
| `@anthropic-ai/sdk` | 0.90.0 |
| `voyageai` | 0.2.1 |
| `zod` | 3.25.76 (zod/v4 subpath used) |
| `@mozilla/readability` | 0.6.0 |
| `jsdom` | 29.0.2 |
| `@types/jsdom` | 28.0.1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zodOutputFormat requires zod/v4, not zod v3**
- **Found during:** Task 1 verification (test failure: TypeError in zodOutputFormat)
- **Issue:** SDK 0.90.0 `zodOutputFormat` calls `z.toJSONSchema()` from `zod/v4` subpath, which fails on zod v3 schemas (`schema._zod.def` is undefined on v3 objects)
- **Fix:** Changed `schema.ts` to `import { z } from 'zod/v4'`; added `as never` cast in `enrich.ts` and `enrich.test.ts` to bridge TypeScript type mismatch between zod v3 d.ts and v4 runtime
- **Files modified:** `src/lib/llm/schema.ts`, `src/lib/llm/enrich.ts`, `src/lib/llm/enrich.test.ts`
- **Commits:** 9069933

**2. [Rule 3 - Blocking] voyageai ESM bare directory import**
- **Found during:** Task 2 test execution (embed/enrich tests fail: "Directory import not supported")
- **Issue:** `voyageai@0.2.1` ESM bundle uses `export * from '../api'` — a bare directory import that Node ESM resolver doesn't handle
- **Fix:** Added `deps: { inline: ['voyageai'] }` to `vitest.config.ts` so Vite bundler resolves the directory imports during tests
- **Files modified:** `vitest.config.ts`
- **Commits:** 9069933

**3. [Rule 1 - Bug] Prompt files token count below 4096 floor**
- **Found during:** Task 1 test (`buildSystemPrompt` ≥4096 token assertion fails with 2912 estimated tokens)
- **Issue:** The verbatim prompt content from the plan totaled only ~9.3KB (9338 bytes, 11646 chars), yielding 2912 estimated tokens vs the 4096 floor required for Haiku 4.5 prompt caching
- **Fix:** Expanded all three prompt files with additional scoring guidance, calibration tables, detailed tag usage rules, tag combination patterns, evaluation decision flowchart, and 4 additional few-shot examples. Final total: 16,389 chars = 4,098 estimated tokens
- **Files modified:** `src/lib/llm/prompts/rubric.md`, `src/lib/llm/prompts/tag-taxonomy.md`, `src/lib/llm/prompts/few-shot.md`
- **Commits:** 1502076

**4. [Rule 2 - Missing critical functionality] W5 zodOutputFormat test: function identity vs structural comparison**
- **Found during:** Task 2 test — W5 regression gate `toEqual(zodOutputFormat(EnrichmentSchema))` fails with "no visual difference" because two calls produce different `parse` function closures
- **Fix:** Changed the W5 gate assertion to compare `format.type` and `format.schema` structurally rather than using `toEqual` on the full object (which compares function references)
- **Files modified:** `src/lib/llm/enrich.test.ts`
- **Commits:** 9069933

**5. [Rule 1 - Bug] Secret scrub test needs retryCount=2 to reach dead_letter path**
- **Found during:** Task 3 test — secret scrub test fails because retryCount=0 causes rethrow (retryable), not dead_letter; test expected dead_letter to check DB failureReason
- **Fix:** Updated test to use `retryCount: 2` (exhausted) so the retriesExhausted branch is taken
- **Files modified:** `src/lib/llm/process-item-core.test.ts`
- **Commits:** 7a20cbd

## Test Coverage

| File | Tests | Key Assertions |
|------|-------|---------------|
| `prompt.test.ts` | 4 | cache_control ephemeral, ≥4096 tokens, untrusted_content delimiters |
| `pricing.test.ts` | 9 | Haiku input/output/cache costs, Voyage cost arithmetic |
| `extract.test.ts` | 14 | SSRF guard (localhost, 10.x, 192.168.x, 172.16-31.x), timeout, 2MB cap, Readability null |
| `enrich.test.ts` | 5 | happy path, ZodError propagation, EnrichError scrub, usage propagation, W5 cache gate |
| `embed.test.ts` | 5 | 1024-dim vector, wrong-length EmbedError, network error scrub, voyage-3.5 model/inputType |
| `process-item-core.test.ts` | 8 | happy path, ZodError dead_letter, retry exhaustion, retryable rethrow, secret scrub, embed input, LLM-12 pipeline_runs fields, embedding dims |
| **Total** | **45** | All 45 pass |

## Threat Mitigations Implemented

| Threat | Control | Test |
|--------|---------|------|
| T-03-01 SSRF | isPrivateHost blocklist + scheme whitelist + 15s timeout + 2MB cap | extract.test.ts: 9 SSRF tests |
| T-03-02 Prompt injection | `<untrusted_content>` delimiters + `zodOutputFormat` schema constraints | prompt.test.ts: untrusted_content test |
| T-03-03 PII in error paths | err.name only (slice 500) in failure_reason + error_message | process-item-core.test.ts: case 5 |
| T-03-10 Response manipulation | zodOutputFormat schema constraint + belt-and-suspenders EnrichmentSchema.parse() | enrich.test.ts: schema-fail path |
| T-03-11 Runaway generation | max_tokens: 800 hard cap | enrich.ts line 48 |

## Self-Check: PASSED

Files exist:
- `src/lib/llm/client.ts` — FOUND
- `src/lib/llm/schema.ts` — FOUND
- `src/lib/llm/prompt.ts` — FOUND
- `src/lib/llm/extract.ts` — FOUND
- `src/lib/llm/enrich.ts` — FOUND
- `src/lib/llm/embed.ts` — FOUND
- `src/lib/llm/pricing.ts` — FOUND
- `src/lib/llm/process-item-core.ts` — FOUND

Commits exist:
- 1502076 feat(03-02): install LLM deps + client singleton + schema + prompt + pricing — FOUND
- 9069933 feat(03-02): extract + enrich + embed wrappers with SSRF guard and secret scrub — FOUND
- 7a20cbd feat(03-02): process-item-core orchestrator (STEPS A-G) with DI and dead_letter handling — FOUND

pnpm test --run src/lib/llm: 45/45 PASS
pnpm typecheck: EXIT 0
