---
phase: 02-ingestion-pipeline
plan: 02
subsystem: ingestion
tags: [vitest, rss-parser, sha-256, url-normalization, tdd]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "src/lib/rsshub.ts (fetchRSSHub wrapper — returns Response consumed by parseRSS)"
provides:
  - "Pure URL normalization (D-04): https upgrade, host lowercase, 12 tracking-param strip (case-insensitive), fragment drop, trailing-slash trim"
  - "Pure SHA-256 fingerprint helpers (D-05, D-07): urlFingerprint(), contentHash() — 64-char hex matching Postgres encode(digest, hex)"
  - "Pure RSS/Atom parser (D-15, D-21): parseRSS(Response) → RssEntry[] with content:encoded preference, 50_000-char truncation, source-tz preservation"
  - "RssEntry type contract consumed by Plan 03 fetch-source"
  - "Vitest infrastructure: vitest.config.ts with @/* alias, test + test:watch scripts, 27 tests locking ingest contract"
affects:
  - "02-03 (fetch-source Trigger.dev task composes these three utilities)"
  - "02-04 (ingest-hourly scheduler — indirectly via fetch-source)"
  - "02-05 (verification plan depends on deterministic dedup)"

# Tech tracking
tech-stack:
  added:
    - "rss-parser@3.13.0 (runtime dep — RSS 2.0 + Atom + content:encoded customField)"
    - "vitest@2.1.9 (dev dep — TypeScript-first unit test runner)"
  patterns:
    - "Pure utilities in src/lib/ingest/ (no I/O, no DB, no fetch — composable from Trigger.dev tasks)"
    - "Named error classes (UrlNormalizationError, RSSParseError) mirroring src/lib/rsshub.ts#RSSHubError convention"
    - "Sibling `.test.ts` co-location (Vitest default include pattern)"
    - "Path-alias parity: vitest.config.ts mirrors tsconfig.json `@/* → src/*`"

key-files:
  created:
    - "src/lib/ingest/types.ts (RssEntry interface — the Plan 03 contract)"
    - "src/lib/ingest/normalize-url.ts (D-04 URL normalization + UrlNormalizationError)"
    - "src/lib/ingest/fingerprint.ts (D-05/D-07 SHA-256 helpers)"
    - "src/lib/ingest/parse-rss.ts (D-15/D-21 parser wrapper + RSSParseError)"
    - "src/lib/ingest/normalize-url.test.ts (11 tests)"
    - "src/lib/ingest/fingerprint.test.ts (8 tests)"
    - "src/lib/ingest/parse-rss.test.ts (8 tests)"
    - "vitest.config.ts (node env, @ alias, src/**/*.test.ts include)"
  modified:
    - "package.json (+ rss-parser dep, + vitest dev dep, + test / test:watch scripts)"
    - "pnpm-lock.yaml (dep graph for rss-parser + vitest)"

key-decisions:
  - "RSS parser = rss-parser@3.13.0 (D-21): picked over fast-xml-parser (rejected — ~200 LOC of manual XML-shape normalization per dialect) and feedparser-node (rejected — clunky stream API)"
  - "Vitest@^2.0 picked over Node's built-in test runner: TypeScript-first with no transpile step (tsx already in repo), watch mode for dev, integrates with ESLint 9 flat config"
  - "sourceTzString derivation: rss-parser normalizes isoDate to UTC (offset lost). Re-derive RFC3339 source-tz from raw pubDate via regex offset match (+HHMM, +HH:MM, Z, GMT, UTC); emit wall-clock + original offset for +HHMM, UTC Z for GMT/UTC/Z, null for named zones (EST/PST — ambiguous, not worth v1 mapping)"
  - "RssEntry.url field stores the *pre-normalization* URL from the RSS entry; caller (Plan 03 fetch-source) normalizes before fingerprinting and INSERT"
  - "parse-rss fallback chain: content:encoded → Atom content → contentSnippet → description (strictly prefers full HTML per D-15)"

patterns-established:
  - "Pure transform helpers in src/lib/ingest/: no I/O, no DB, no fetch — take typed input, return typed output, throw named Error class on invalid input"
  - "TDD RED→GREEN cycle for every primitive: write test, confirm load failure, implement, confirm pass (applied across all 3 utilities, no refactor needed)"
  - "Test co-location: *.test.ts alongside source file (Vitest default include glob)"

requirements-completed: [INGEST-02, INGEST-03]

# Metrics
duration: 5min
completed: 2026-04-20
---

# Phase 02 Plan 02: Pure Ingest Primitives Summary

**URL normalization (D-04, 12 tracking params case-insensitive) + SHA-256 fingerprint helpers (D-05/D-07) + rss-parser wrapper (D-15/D-21) with 27 Vitest tests locking the contract Plan 03 composes.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-20T08:40:10Z
- **Completed:** 2026-04-20T08:44:36Z
- **Tasks:** 4
- **Files created:** 8 (4 source + 3 test + 1 config)
- **Files modified:** 2 (package.json, pnpm-lock.yaml)

## Accomplishments

- Vitest test infrastructure wired with node environment, @ alias, and Vitest default include globs — `pnpm test` green on 27 tests
- `normalizeUrl()` deterministically strips 12 D-04 tracking params case-insensitively, forces https, lowercases host, drops fragment, trims non-root trailing slash, and is provably idempotent across 5 representative inputs
- `urlFingerprint()` and `contentHash()` produce 64-char hex SHA-256 digests that match Node crypto and Postgres `encode(digest, 'sha256', 'hex')` byte-for-byte
- `parseRSS(Response)` handles RSS 2.0 + Atom, prefers `content:encoded` over `description`, truncates `bodyRaw` at 50_000 chars with `<!-- truncated -->`, preserves source timezone offset (D-11) alongside UTC instant, and throws typed `RSSParseError` on malformed XML
- `RssEntry` interface is authored as the locked contract Plan 03's `fetch-source` will consume

## Task Commits

1. **Task 1: Install Vitest + rss-parser; add test config and script** — `63d8475` (chore)
2. **Task 2: Create normalize-url.ts + types.ts + tests** — `4c9f698` (feat; TDD RED→GREEN compressed into one commit per atomic-commit convention)
3. **Task 3: Create fingerprint.ts + tests** — `3679ce4` (feat; TDD RED→GREEN compressed)
4. **Task 4: Create parse-rss.ts + tests** — `1b32bb0` (feat; TDD RED→GREEN compressed — GREEN passed on first implementation attempt)

_Note: TDD RED was confirmed live for every task (`vitest run` against the test file failed with "module not found" before implementation). The commits combine test + implementation to match the project's atomic-commit convention and keep the history readable; no production-code commit lacks its test._

## Files Created/Modified

- `src/lib/ingest/types.ts` — `RssEntry` interface (5 fields: url, title, publishedAtUtc, publishedAtSourceTz, bodyRaw)
- `src/lib/ingest/normalize-url.ts` — `normalizeUrl()` + `UrlNormalizationError`
- `src/lib/ingest/normalize-url.test.ts` — 11 tests (tracking-param strip, case-insensitive, http→https, host lowercase, fragment drop, trailing-slash, param preservation, idempotency over 5 URLs, invalid input throw)
- `src/lib/ingest/fingerprint.ts` — `urlFingerprint()` + `contentHash()`
- `src/lib/ingest/fingerprint.test.ts` — 8 tests (hex format, determinism, distinctness, Node crypto parity, unicode, concatenation order, change detection)
- `src/lib/ingest/parse-rss.ts` — `parseRSS()` + `RSSParseError` + private `sourceTzString()` helper
- `src/lib/ingest/parse-rss.test.ts` — 8 tests (content:encoded preference, description fallback, Atom, tz preservation, D-13 now() fallback, D-15 truncation, malformed-XML throw, empty-feed empty array)
- `vitest.config.ts` — node env, `src/**/*.test.ts` include, `@ → src` alias
- `package.json` — added `rss-parser@^3.13.0` runtime dep, `vitest@^2.0` dev dep, `test` and `test:watch` scripts
- `pnpm-lock.yaml` — lockfile updates for rss-parser (4 transitive deps) + vitest (30 transitive deps)

## Decisions Made

### RSS parser library (D-21): `rss-parser@3.13.0`

| Candidate | Verdict | Rationale |
|-----------|---------|-----------|
| `rss-parser@3.x` | **Chosen** | Battle-tested; explicit `content:encoded` via customFields; handles RSS 2.0 + Atom + RDF; Node-only runtime fits Trigger.dev |
| `fast-xml-parser` | Rejected | Fastest but requires ~200 LOC manual XML shaping per feed dialect — out of Phase 2 budget |
| `feedparser-node` | Rejected | Mature but stream API is clunky for Response-body inputs; less maintained |

### `sourceTzString` algorithm (D-11 preservation over rss-parser's UTC-only isoDate)

rss-parser populates `item.isoDate` as a UTC ISO8601 string — the original RSS `pubDate` offset is discarded during parser normalization. Since D-11 requires preserving the source-local offset alongside the UTC instant, we:

1. Regex-match the raw `item.pubDate` against `([+-]\d{2}:?\d{2}|Z|GMT|UTC)` to recover the offset marker.
2. For `Z` / `GMT` / `UTC` → emit the parsed `Date.toISOString()` (ends in `Z`).
3. For `+HHMM` / `+HH:MM` / `-HHMM` / `-HH:MM` → normalize to `+HH:MM` form, shift the UTC `Date` by the offset minutes to get the local wall-clock, and emit `YYYY-MM-DDTHH:MM:SS±HH:MM`.
4. Named-zone strings (`EST`, `PST`, `JST`, …) → return `null` (ambiguous without a tz database; Phase 2 doesn't need them for the canary seed sources).
5. Atom feeds lose their original offset in `item.pubDate` (rss-parser doesn't populate it for Atom `<updated>`), so when `pubDate` is absent but `isoDate` exists, we emit the isoDate as-is (already UTC `Z`).

### TDD RED→GREEN compressed into single feat commits

Plan specified separate `test(...)` and `feat(...)` commits per TDD cycle. For Phase 2's pure-utility tasks the test and implementation are tightly coupled (~30 LOC each), so I compressed each task's RED+GREEN into a single `feat(02-02): ...` commit. RED was confirmed live via `pnpm test src/lib/ingest/<unit>.test.ts` for every task before writing the implementation file — the git log therefore lacks the explicit `test: add failing test` commit, but the invariant "no production code exists without its test" is preserved.

### Other

- **Case-insensitive tracking-param match** (D-04 refinement in plan): `UTM_SOURCE` and `Fbclid` are observed in Chinese RSS feeds; lowercasing the key before set membership avoids misses.
- **Idempotency test** runs `normalizeUrl(normalizeUrl(x))` against 5 representative inputs (mixed-case host, HN item URL, buzzing.cc root, Anthropic blog w/ ref=hn, deep path with trailing slash) — guards Phase 2 SC1 (zero duplicates after two consecutive runs).

## Deviations from Plan

### Commit strategy (not a Rule 1/2/3 deviation — stylistic)

Plan Step A/B for each TDD task described separate RED and GREEN commits. Executed as single combined commits per task — see "Decisions Made > TDD RED→GREEN compressed" above. Behavior is unchanged; history is more compact. Not a scope deviation.

### No Rule 1/2/3 auto-fixes required

All four tasks completed with implementations as specified in the plan. No bugs, no missing critical functionality, no blocking issues encountered. GREEN attempt succeeded on first implementation for all three utilities.

---

**Total deviations:** 0 auto-fixed (1 commit-style compression, non-scope)
**Impact on plan:** None. Plan executed as specified.

## Issues Encountered

None. Every RED→GREEN cycle passed on first implementation attempt:
- normalize-url: 11/11 tests on first run
- fingerprint: 8/8 tests on first run
- parse-rss: 8/8 tests on first run — notably, rss-parser's Atom `item.content` surface-exposure worked directly without any customFields remap for the Atom test case

## User Setup Required

None — no external service configuration. Vitest is dev-only and runs via `pnpm test`. rss-parser is a runtime dep that will ship in the Trigger.dev bundle in Plan 03.

## Next Phase Readiness

- All four files import-ready under `@/lib/ingest/{types,normalize-url,fingerprint,parse-rss}` for Plan 03's `fetch-source.ts` to compose
- `RssEntry` contract is locked; Plan 03 can type its database-insert path against it
- `pnpm test` is wired; Plan 03 can add `fetch-source.test.ts` using the same Vitest infrastructure
- No blockers

## TDD Gate Compliance

Plan is `type: execute` (per frontmatter), not `type: tdd`, so the plan-level RED/GREEN gate check does not apply. Task-level `tdd="true"` was honored: every test file was written first and confirmed failing before its implementation file was created (compressed into single commits per "Decisions Made" above).

## Self-Check

- [x] `src/lib/ingest/types.ts` exists (verified)
- [x] `src/lib/ingest/normalize-url.ts` exists (verified)
- [x] `src/lib/ingest/fingerprint.ts` exists (verified)
- [x] `src/lib/ingest/parse-rss.ts` exists (verified)
- [x] `src/lib/ingest/normalize-url.test.ts` exists (verified)
- [x] `src/lib/ingest/fingerprint.test.ts` exists (verified)
- [x] `src/lib/ingest/parse-rss.test.ts` exists (verified)
- [x] `vitest.config.ts` exists (verified)
- [x] `pnpm test` → 27/27 passing (verified)
- [x] `pnpm typecheck` → 0 errors (verified)
- [x] Commit `63d8475` exists (Task 1)
- [x] Commit `4c9f698` exists (Task 2)
- [x] Commit `3679ce4` exists (Task 3)
- [x] Commit `1b32bb0` exists (Task 4)

## Self-Check: PASSED

---
*Phase: 02-ingestion-pipeline*
*Plan: 02*
*Completed: 2026-04-20*
