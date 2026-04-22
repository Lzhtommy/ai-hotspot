# Phase 2: Ingestion Pipeline - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 10
**Analogs found:** 8 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/trigger/ingest-hourly.ts` | Trigger.dev scheduled task | event-driven (cron) + fan-out | `src/trigger/health-probe.ts` | role-match (schedule variant) |
| `src/trigger/fetch-source.ts` | Trigger.dev triggered task | request-response (per-source) | `src/trigger/health-probe.ts` | role-match |
| `src/trigger/index.ts` (modify) | barrel export | — | `src/trigger/index.ts` (existing) | exact |
| `trigger.config.ts` (possibly modify) | config | — | `trigger.config.ts` (existing) | exact |
| `src/lib/ingest/normalize-url.ts` | utility (pure fn) | transform | *(no close analog — pure string transform)* | none |
| `src/lib/ingest/fingerprint.ts` | utility (pure fn) | transform (SHA-256) | *(no close analog)* | none |
| `src/lib/ingest/parse-rss.ts` | ingestion helper | transform (XML→entries) | `src/lib/rsshub.ts` (same concern layer) | partial (same module, different shape) |
| `src/lib/ingest/fetch-source.ts` (core logic, called by task) | ingestion helper | CRUD (insert items + update source) | `src/lib/rsshub.ts` + `src/lib/db/client.ts` | role-split |
| `drizzle/0002_add_published_at_source_tz.sql` + `drizzle/meta/_journal.json` + `drizzle/meta/0002_snapshot.json` | migration + Drizzle Kit meta | schema change | `drizzle/0001_initial_schema.sql` + `drizzle/meta/_journal.json` | exact |
| `src/lib/db/schema.ts` (modify — add column) | schema definition | — | existing file | exact |
| `drizzle/seed-sources.ts` (or `scripts/seed-sources.ts`) | dev-only CLI seed | CRUD (idempotent insert) | `scripts/verify-schema.ts` | role-match (CLI tsx script, DB access shape) |
| `package.json` (modify — add `db:seed` script) | config | — | `package.json` (existing scripts block) | exact |

## Pattern Assignments

### `src/trigger/ingest-hourly.ts` (scheduled task, fan-out)

**Analog:** `src/trigger/health-probe.ts:1-20` — only existing Trigger.dev v4 task in the repo.

**Imports + task-definition shape** (copy verbatim, swap `task` for `schedules.task`):
```typescript
// existing (health-probe.ts:1,15-20)
import { task } from '@trigger.dev/sdk';

export const healthProbe = task({
  id: 'health-probe',
  run: async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  },
});
```

**New shape (research-confirm v4 surface at plan time):**
```typescript
import { schedules, batch } from '@trigger.dev/sdk';
import { fetchSource } from './fetch-source';

export const ingestHourly = schedules.task({
  id: 'ingest-hourly',
  cron: '0 * * * *',
  run: async (payload, { ctx }) => {
    // 1) enumerate active sources via db (see src/lib/db/client.ts pattern)
    // 2) batch.triggerAndWait on fetchSource, one run per source (D-01)
    // 3) return aggregate summary for logs (D-02)
  },
});
```

**Research flag:** planner MUST verify `schedules.task` + `batch.triggerAndWait` v4 import paths against `@trigger.dev/sdk@4.4.4` node_modules before writing the plan (STATE.md Research Flag 1). The `v3` path is explicitly deprecated per `trigger.config.ts:14-15`.

**JSDoc header conventions** (copy shape from `health-probe.ts:3-14`): short block describing satisfies-which-requirement (INGEST-01/07/08), consumed-by, and "phase N replaces / extends this" forward pointer.

---

### `src/trigger/fetch-source.ts` (triggered task, per-source)

**Analog:** `src/trigger/health-probe.ts` + `trigger.config.ts:22-25` (task-level `maxDuration` comment).

**Per-task `maxDuration` pattern** — D-03 requires 90s on this task. `trigger.config.ts:22-24` already documents the override pattern:
```typescript
// trigger.config.ts:22-24
// individual tasks can override via `maxDuration` on their `task({...})` definition.
```

**Shape:**
```typescript
import { task } from '@trigger.dev/sdk';
import { fetchRSSHub } from '@/lib/rsshub';
import { db, schema } from '@/lib/db/client';
// + ingest helpers

export const fetchSource = task({
  id: 'fetch-source',
  maxDuration: 90, // D-03: 60s RSSHub cold-start budget + 30s parse/dedup/insert
  run: async (payload: { sourceId: number; rssUrl: string }) => {
    // try { fetchRSSHub → parse → normalize+fingerprint → INSERT ON CONFLICT → update source row }
    // catch { increment consecutive_error_count; do NOT update last_fetched_at }  ← D-08
  },
});
```

**Error-handling pattern** (mirror `src/lib/rsshub.ts:68-71`): never re-throw raw fetch error — wrap / scrub. `fetchRSSHub` already scrubs the access key; Phase 2 must not `console.log` the authenticated URL or key.

---

### `src/trigger/index.ts` (barrel export — modify)

**Analog:** `src/trigger/index.ts:1-3` (itself — extend).

**Pattern (extend the existing comment intent):**
```typescript
// src/trigger/index.ts (existing)
// Barrel export — add new task exports here as phases grow.
export * from './health-probe';
// Phase 2 additions:
export * from './ingest-hourly';
export * from './fetch-source';
```

---

### `src/lib/ingest/normalize-url.ts` (pure utility)

**Analog:** *(none — no existing pure string-transform utility in `src/lib/`)*.

**Follow conventions from `src/lib/rsshub.ts:1-25`:**
- File-top JSDoc block describing purpose + source decision IDs (D-04, D-05)
- No imports beyond Node built-ins (pure)
- Named export (not default)
- Throw a named Error class if input is invalid (mirrors `RSSHubError` pattern at `src/lib/rsshub.ts:17-25`)

**Algorithm (D-04):**
```typescript
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'source', 'spm',
]);

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  if (u.protocol === 'http:') u.protocol = 'https:';
  u.host = u.host.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}
```

---

### `src/lib/ingest/fingerprint.ts` (pure utility)

**Analog:** *(none)*.

**Pattern (Node `crypto` per D-05 + canonical_refs):**
```typescript
import { createHash } from 'node:crypto';

export function urlFingerprint(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl, 'utf8').digest('hex');
}

export function contentHash(normalizedUrl: string, title: string): string {
  return createHash('sha256').update(`${normalizedUrl}\n${title}`, 'utf8').digest('hex');
}
```

Hex-encoded SHA-256 string fits the existing `items.url_fingerprint TEXT UNIQUE` + `items.content_hash TEXT` columns (`src/lib/db/schema.ts:44-45`).

---

### `src/lib/ingest/parse-rss.ts` (RSS parser wrapper)

**Analog:** `src/lib/rsshub.ts:38-78` — same I/O-wrapper layer, different concern.

**Pattern to replicate (from rsshub.ts):**

1. **Top-of-file JSDoc citing consumed-by + decision IDs** (rsshub.ts:1-15).
2. **Named error class** (rsshub.ts:17-25):
   ```typescript
   export class RSSParseError extends Error {
     constructor(message: string) { super(message); this.name = 'RSSParseError'; }
   }
   ```
3. **Accept `Response`** (not raw URL — `fetchRSSHub` already returns `Response`), so this helper is test-friendly and composes with the existing wrapper:
   ```typescript
   export async function parseRSS(res: Response): Promise<RssEntry[]> { ... }
   ```
4. **Output shape**: produce the minimum fields Phase 2 persists per D-14 — `{ url, title, publishedAtSourceTz: string | null, publishedAtUtc: Date, bodyRaw: string }`. Prefer `content:encoded` over `description` (D-15). Truncate `bodyRaw` at 50,000 chars with `<!-- truncated -->` sentinel.

**D-21 (Claude's discretion):** parser library choice is the planner's. `rss-parser` is the lowest-friction default; if chosen, pin version in `package.json` and document in the plan's `<research_findings>` block.

---

### `drizzle/0002_add_published_at_source_tz.sql` (+ meta) — additive migration

**Analog:** `drizzle/0001_initial_schema.sql:31-56` (the `items` table block) + `drizzle/meta/_journal.json:12-18` (journal entry shape).

**Migration SQL (D-11 — single additive column, nullable):**
```sql
-- Phase 2 D-11: preserve RSS entry's original offset string alongside UTC instant.
ALTER TABLE "items" ADD COLUMN "published_at_source_tz" text;
```

**Generation path:** modify `src/lib/db/schema.ts` `items` table (add `publishedAtSourceTz: text('published_at_source_tz')` — nullable, no `.notNull()`), then run `pnpm db:generate` to produce `0002_*.sql` + `drizzle/meta/0002_snapshot.json` + updated `_journal.json`. Do **not** hand-edit the generated snapshot.

**Journal entry shape (copy from `drizzle/meta/_journal.json:12-17`):**
```json
{
  "idx": 2,
  "version": "7",
  "when": <epoch_ms>,
  "tag": "0002_add_published_at_source_tz",
  "breakpoints": true
}
```

**Apply path:** CI workflow already runs `pnpm db:migrate` on preview Neon branches (Phase 1 SC1 / `.github/workflows/ci.yml`). Phase 2 adds **zero** new CI steps.

---

### `src/lib/db/schema.ts` (modify — add column)

**Analog:** existing file, `items` block at `src/lib/db/schema.ts:36-73`.

**Exact insertion point:** between line 58 (`publishedAt`) and line 59 (`ingestedAt`) — keeps timestamp columns grouped.

```typescript
// NEW — D-11
publishedAtSourceTz: text('published_at_source_tz'), // nullable: some RSS entries have no tz info
```

Uses existing `text` import already on line 6. No new imports.

---

### `drizzle/seed-sources.ts` (dev-only CLI seed)

**Analog:** `scripts/verify-schema.ts:1-94` — the only existing CLI script using the Neon driver pattern. Directly copy its bootstrap shape.

**Imports + env bootstrap (scripts/verify-schema.ts:13-17):**
```typescript
import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
```

**Adapt for Drizzle (reuse `db` from `src/lib/db/client.ts:1-8` instead of raw `neon(...)`), so the seed uses typed inserts:**
```typescript
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';

const SEEDS = [
  { name: 'Anthropic Blog',  rssUrl: '<confirmed-route>', language: 'en', weight: '1.0' },
  { name: 'Hacker News AI',  rssUrl: '<confirmed-route>', language: 'en', weight: '0.8' },
  { name: 'buzzing.cc',      rssUrl: '<confirmed-route>', language: 'zh', weight: '1.0' },
];

async function main() {
  // D-19: idempotent — ON CONFLICT DO NOTHING on rss_url UNIQUE
  for (const s of SEEDS) {
    await db.insert(sources).values(s).onConflictDoNothing({ target: sources.rssUrl });
  }
  console.log('Seeded sources (idempotent).');
}

main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
```

**Error-reporting style (scripts/verify-schema.ts:90-93):**
```typescript
main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
```

**Run via `tsx` (`package.json:52` already includes `tsx`).** Add `package.json` script per next entry.

---

### `package.json` (modify — add `db:seed` script)

**Analog:** `package.json:17-24` existing db/trigger scripts block.

**Existing precedent:**
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:check": "drizzle-kit check",
"db:studio": "drizzle-kit studio",
```

**Add (follow same `db:*` naming):**
```json
"db:seed": "tsx drizzle/seed-sources.ts",
```

Lives next to other `db:*` scripts for discoverability. Not invoked by CI (D-19).

---

## Shared Patterns

### Drizzle + Neon HTTP reads/writes
**Source:** `src/lib/db/client.ts:1-8`
**Apply to:** every Phase 2 file that touches the DB (both Trigger.dev tasks, the seed script, any ingest helper).
```typescript
// src/lib/db/client.ts (full file)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
export { schema };
```
Always import `{ db }` from `@/lib/db/client` — never instantiate a second `neon()` client. Trigger.dev Cloud has `DATABASE_URL` set per Phase 1 D-06.

### RSSHub fetch (never bypass)
**Source:** `src/lib/rsshub.ts:38-78`
**Apply to:** `src/trigger/fetch-source.ts` only.
```typescript
import { fetchRSSHub, RSSHubError } from '@/lib/rsshub';
const res = await fetchRSSHub(source.rssUrl); // 60s warmed timeout, access-key-scrubbed errors
```
Do NOT call raw `fetch()` against the HF Space. The wrapper owns the warmup, the 60s timeout budget (D-05 Phase 1), and the error-message scrubbing that keeps the ACCESS_KEY out of logs.

### Dedup via ON CONFLICT DO NOTHING
**Source (Drizzle idiom, referenced in canonical_refs):** https://orm.drizzle.team/docs/insert#on-conflict-do-nothing
**Apply to:** `src/trigger/fetch-source.ts` items insert + `drizzle/seed-sources.ts` sources insert.
```typescript
const inserted = await db
  .insert(items)
  .values({ sourceId, url, urlFingerprint, contentHash, title, bodyRaw,
            publishedAt, publishedAtSourceTz, status: 'pending', retryCount: 0 })
  .onConflictDoNothing({ target: items.urlFingerprint })
  .returning({ id: items.id });
const isNew = inserted.length === 1; // D-06: drives counter logic
```

### JSDoc file-header convention
**Source:** `src/lib/rsshub.ts:1-15`, `src/trigger/health-probe.ts:3-14`, `scripts/verify-schema.ts:1-12`
**Apply to:** every new file.
- Purpose sentence
- Cite decision IDs (D-nn) satisfied
- "Consumed by:" bullet list
- "Phase N replaces / augments this" forward pointer where relevant

### Secret hygiene
**Source:** Phase 1 D-08 + `.husky/pre-commit` UUID regex + `src/lib/rsshub.ts:68-71` error scrubbing
**Apply to:** every Phase 2 log/error path.
- Never log `source.rssUrl` with a `?key=` query fragment — `fetchRSSHub` already strips it by accepting a **path** (not a full URL), but if any helper handles raw URLs, it must scrub.
- Never log `process.env.RSSHUB_ACCESS_KEY`.
- Trigger.dev task logs go to Trigger.dev Cloud; treat them as production-visible.

### UTC-by-default timestamps
**Source:** every existing timestamp in `src/lib/db/schema.ts` uses `withTimezone: true` + `defaultNow()`.
**Apply to:** Phase 2 item insert — `publishedAt` is the UTC instant; the **new** `publishedAtSourceTz` is the deliberate documented exception (D-11: plain `text` preserving offset).

---

## No Analog Found

Files where no sufficiently close existing pattern exists; planner should rely on canonical_refs + D-nn for specification:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/ingest/normalize-url.ts` | utility | transform | No prior string-transform utility in `src/lib/`; pattern must be authored. Spec fully in D-04. |
| `src/lib/ingest/fingerprint.ts` | utility | transform | No prior crypto helper. Spec fully in D-05, D-07. |

Both are tiny, pure, and easily testable — "no analog" here is acceptable, not a risk.

---

## Metadata

**Analog search scope:**
- `/Users/r25477/Project/ai-hotspot/src/trigger/` (3 files — health-probe, index, no others)
- `/Users/r25477/Project/ai-hotspot/src/lib/` (rsshub.ts, db/*, redis/*)
- `/Users/r25477/Project/ai-hotspot/drizzle/` (2 existing migrations + meta)
- `/Users/r25477/Project/ai-hotspot/scripts/` (only `verify-schema.ts` — CLI tsx analog for seed)
- `/Users/r25477/Project/ai-hotspot/trigger.config.ts`, `/drizzle.config.ts`, `/package.json`

**Files scanned:** 15

**Key observations that shape planning:**
1. The **only** Trigger.dev task in the repo is the 20-line `health-probe.ts`. Phase 2 doubles Trigger.dev task count from 1 → 3 and introduces the first scheduled + fan-out tasks. Planner must confirm the v4 scheduled-task + batch-trigger API shape before writing plans (STATE.md Research Flag 1).
2. No seed script exists yet; `scripts/verify-schema.ts` is the template for dotenv + neon CLI bootstrap.
3. Drizzle migration process is **generator-driven** — Phase 2 modifies `schema.ts` then runs `pnpm db:generate`. The only hand-authored migration to date is `0000_enable_pgvector.sql`; Phase 2's column-add should go through the generator (not hand-authored) to keep `_journal.json` + `0002_snapshot.json` in sync.
4. `src/lib/` has no nested utility pattern — Phase 2 introduces `src/lib/ingest/` as a new subfolder. Mirror the flat style of `src/lib/redis/client.ts` (single `client.ts`) and `src/lib/db/{client,schema}.ts` (multi-file by concern).
5. `trigger.config.ts` already declares `maxDuration: 3600` project-level; Phase 2 sets per-task override on `fetch-source` only (D-03 = 90s). No change to `trigger.config.ts` is required unless the planner wants to tighten the project-level default.
6. No new env vars needed (Phase 2 D from `<code_context>` — `RSSHUB_*` + `DATABASE_URL` already in all three vaults per Phase 1 D-06).

**Pattern extraction date:** 2026-04-20
