---
id: 260423-e6n
kind: quick
status: complete
date: 2026-04-23
commit: a2afa86
---

# Quick Task 260423-e6n: Summary

## What changed

- `src/lib/llm/enrich.ts`
  - Added `APIError` import from `@anthropic-ai/sdk`.
  - Replaced the catch block's name-only redaction with a `describeAnthropicError(err)` helper:
    - `APIError` → `${name} status=${status} type=${type} ${message.slice(0,300)}`
    - `Error` → `${name}: ${message.slice(0,300)}`
    - else → `'unknown'`
  - Emits `console.error('[enrich] Anthropic call failed', detail)` so the Trigger.dev run panel surfaces the real cause instead of `Error`.
  - `EnrichError` message carries the same detail string so downstream logs / dead-letter metadata also show it.
- `src/lib/llm/enrich.test.ts`
  - Updated the API-failure assertion to reflect the new detail policy (`err.message` now included, length bounded to <=400 chars).

## Why this policy is safe

- Anthropic SDK redacts credentials in exception messages.
- API URLs that may appear in messages are the public endpoint, not sensitive.
- 300-char slice preserves T-03-19's spirit (no runaway payloads) while restoring triage information.

## Verification

- `pnpm exec tsc --noEmit` — clean (exit 0).
- `pnpm exec vitest run src/lib/llm/enrich.test.ts` — 5/5 passing, including the updated API-failure assertion.

## Follow-up

Next time a `process-item` run fails, the Trigger.dev log will show the concrete Anthropic failure (e.g. `APIError status=400 type=invalid_request_error Input tokens exceed...`) rather than the opaque `Error`. Use that to decide whether the underlying fix is `max_tokens`, zod/v4 helper compat, or env-var / network.
