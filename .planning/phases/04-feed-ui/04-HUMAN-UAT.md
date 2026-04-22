---
status: partial
phase: 04-feed-ui
source: [04-VERIFICATION.md]
started: 2026-04-22T07:30:00.000Z
updated: 2026-04-22T07:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WeChat share-card rendering
expected: Pasting a `/items/[id]` URL into WeChat renders preview with title, description, and thumbnail.
result: [pending — requires Vercel preview deploy + real WeChat client]

### 2. Full FeedCard anatomy with ingested data
expected: On `/` and `/all`, feed cards display all 8 anatomy steps including amber recommendation callout and "cluster" expand button when cluster siblings exist.
result: [pending — requires ingested items in DB]

### 3. Visual palette inspection
expected: Paper (#f6f1e8) background, amber (#ca8a04) accents, ink text; matches reference design at 1440x900 and 375x812 breakpoints.
result: [pending — requires browser]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
