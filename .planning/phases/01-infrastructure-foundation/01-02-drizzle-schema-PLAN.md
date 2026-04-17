---
phase: 01-infrastructure-foundation
plan: 02
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - package.json
  - drizzle.config.ts
  - src/lib/db/client.ts
  - src/lib/db/schema.ts
  - drizzle/0000_enable_pgvector.sql
  - drizzle/0001_initial_schema.sql
  - drizzle/meta/_journal.json
  - drizzle/meta/0000_snapshot.json
  - drizzle/meta/0001_snapshot.json
  - .env.local
autonomous: false
requirements: [INFRA-02, INFRA-03]
tags: [drizzle, neon, pgvector, schema, migration, database]
user_setup:
  - service: neon
    why: "Primary Postgres with pgvector for embeddings (D-09, D-10, D-11, D-12)"
    env_vars:
      - name: DATABASE_URL
        source: "Neon Console → Project → Connection Details → Pooled connection string"
      - name: NEON_API_KEY
        source: "Neon Console → Account settings → API keys (used in Plan 05 CI, NOT this plan)"
      - name: NEON_PROJECT_ID
        source: "Neon Console → Project settings → General (used in Plan 05 CI, NOT this plan)"
    dashboard_config:
      - task: "Create Neon project in HK/SG/Singapore region (closest to target users)"
        location: "https://console.neon.tech/app/projects"
      - task: "Create a long-lived `dev` branch (D-12) and copy its connection string into .env.local for local dev"
        location: "Neon Console → Project → Branches"
      - task: "Enable pgvector: run `CREATE EXTENSION IF NOT EXISTS vector;` in the Neon SQL Editor against the main branch (one-time — later phases inherit)"
        location: "Neon Console → SQL Editor"

must_haves:
  truths:
    - "Running `pnpm drizzle-kit migrate` against a Neon branch creates all 11 tables + pgvector extension in that branch"
    - "A `SELECT extname FROM pg_extension WHERE extname='vector'` returns one row after migration"
    - "The `items.embedding` column is `vector(1024)` (matches Voyage AI voyage-3.5 dimensionality per D-10)"
    - "All 11 tables defined in `src/lib/db/schema.ts`: sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs"
    - "`pnpm drizzle-kit check` exits 0 (no schema drift)"
    - "Migration 0000 runs BEFORE 0001 (pgvector extension enabled before schema references `vector()`)"
  artifacts:
    - path: "src/lib/db/schema.ts"
      provides: "All 11 table definitions, FKs, indexes"
      min_lines: 150
      contains: "vector('embedding', { dimensions: 1024 })"
    - path: "src/lib/db/client.ts"
      provides: "Neon HTTP-driven Drizzle client singleton"
      exports: ["db"]
    - path: "drizzle.config.ts"
      provides: "Drizzle Kit config — dialect postgresql, schema path, out path, credentials"
      contains: "dialect: 'postgresql'"
    - path: "drizzle/0000_enable_pgvector.sql"
      provides: "Manually authored extension migration"
      contains: "CREATE EXTENSION IF NOT EXISTS vector"
    - path: "drizzle/0001_initial_schema.sql"
      provides: "Generated initial schema migration with 11 tables"
      contains: "CREATE TABLE \"items\""
  key_links:
    - from: "src/lib/db/schema.ts"
      to: "drizzle/0001_initial_schema.sql"
      via: "drizzle-kit generate"
      pattern: "drizzle-kit generate"
    - from: "drizzle/0000_enable_pgvector.sql"
      to: "drizzle/0001_initial_schema.sql"
      via: "lexicographic migration ordering"
      pattern: "0000.*pgvector.*0001.*schema"
    - from: "src/lib/db/client.ts"
      to: "process.env.DATABASE_URL"
      via: "neon() HTTP driver"
      pattern: "neon\\(process.env.DATABASE_URL"
---

<objective>
Stand up the full database layer: install Drizzle ORM + Neon HTTP driver, author all 11 schema tables in TypeScript, hand-craft the pgvector extension migration `0000_enable_pgvector.sql`, generate the initial schema migration `0001_initial_schema.sql`, and **apply the migrations to a live Neon dev branch** so Plan 04's `/api/health` can query them in Wave 3.

Purpose: This plan satisfies INFRA-02 (pgvector-enabled Neon) and INFRA-03 (all 11 tables). The `[BLOCKING]` drizzle-kit migrate task is the only way to prove the schema is actually live — type checks alone would false-positive.
Output: A migrated Neon dev branch + committed schema file + committed migration SQL + working `src/lib/db/client.ts` that later plans import.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@.planning/phases/01-infrastructure-foundation/01-VALIDATION.md
@.planning/REQUIREMENTS.md

<!-- Summaries only needed if they change this plan's contract -->
<interfaces>
<!-- Schema contract consumed by Plans 04 (health check: db.execute(sql\`SELECT 1\`)) and Phases 2-6 -->

From `src/lib/db/client.ts` (this plan creates):
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
export const db: ReturnType<typeof drizzle<typeof schema>>;
```

From `src/lib/db/schema.ts` (this plan creates — all 11 tables below are exported):
- `sources`, `items`, `clusters`, `itemClusters`, `tags`, `itemTags`, `users`, `favorites`, `votes`, `settings`, `pipelineRuns`

Key column pins (D-09, D-10):
- `items.embedding = vector('embedding', { dimensions: 1024 })`
- `clusters.centroid = vector('centroid', { dimensions: 1024 })`
- `items.urlFingerprint` UNIQUE (SHA-256 of normalized URL — Phase 2 dedup)
- `items.status DEFAULT 'pending'` in {pending|processing|published|failed|dead_letter}
- `settings` seeded with one row: `('cluster_threshold', '0.82')`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Drizzle + Neon driver, author schema.ts + client.ts + drizzle.config.ts</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 1 (client), §Pattern 2 (config), §Pattern 3 (all 11 table definitions — COPY VERBATIM), §Don't Hand-Roll (Drizzle native pgvector column, Neon HTTP driver)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-09 all 11 tables, D-10 pgvector + vector(1024), D-12 dev branch)
    - package.json (current scripts — so new `db:*` scripts are consistent with existing ones)
    - .env.example (canonical env var names — DATABASE_URL is already there from Plan 01)
  </read_first>
  <files>package.json, drizzle.config.ts, src/lib/db/client.ts, src/lib/db/schema.ts</files>
  <action>
    1. Install runtime deps: `pnpm add drizzle-orm@^0.45 @neondatabase/serverless@^1`.
    2. Install dev deps: `pnpm add -D drizzle-kit@^0.31 tsx@^4` (tsx lets us run the seed script later if needed).
    3. Add these scripts to `package.json`:
       ```json
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:push": "drizzle-kit push",
       "db:check": "drizzle-kit check",
       "db:studio": "drizzle-kit studio"
       ```
    4. Create `drizzle.config.ts` at repo root with this EXACT content (per RESEARCH.md §Pattern 2):
       ```typescript
       import 'dotenv/config';
       import { defineConfig } from 'drizzle-kit';

       export default defineConfig({
         dialect: 'postgresql',
         schema: './src/lib/db/schema.ts',
         out: './drizzle',
         dbCredentials: {
           url: process.env.DATABASE_URL!,
         },
         verbose: true,
         strict: true,
       });
       ```
       Also install `pnpm add -D dotenv` so `drizzle-kit` can load `.env.local` during local dev.
    5. Create `src/lib/db/client.ts` with this EXACT content (per RESEARCH.md §Pattern 1):
       ```typescript
       import { neon } from '@neondatabase/serverless';
       import { drizzle } from 'drizzle-orm/neon-http';
       import * as schema from './schema';

       const sql = neon(process.env.DATABASE_URL!);
       export const db = drizzle({ client: sql, schema });
       export { schema };
       ```
    6. Create `src/lib/db/schema.ts` by copying the full schema block VERBATIM from RESEARCH.md §Pattern 3 (lines defining `sources`, `items`, `clusters`, `itemClusters`, `tags`, `itemTags`, `users`, `favorites`, `votes`, `settings`, `pipelineRuns`). Preserve all column types, FKs, indexes, and defaults — in particular:
       - `items.embedding = vector('embedding', { dimensions: 1024 })` (D-10)
       - `clusters.centroid = vector('centroid', { dimensions: 1024 })`
       - `items.urlFingerprint` UNIQUE
       - `items.status.default('pending')`
       - `sources.weight = numeric('weight', { precision: 3, scale: 1 }).default('1.0')`
       - All timestamps `withTimezone: true`
       - `itemClusters` composite PK on `(itemId, clusterId)`
       - `itemTags` composite PK on `(itemId, tagId)`
       - `favorites`, `votes` composite PK on `(userId, itemId)`
       - `pipelineRuns.itemId` references `items.id` with `onDelete: 'set null'`
       - Indexes: `items_status_published_at_idx`, `items_cluster_id_idx`, `items_source_id_idx`, `items_tags_idx` (gin), `pipeline_runs_item_id_idx`, `pipeline_runs_created_at_idx`
    7. Run `pnpm typecheck` — it must exit 0. If `drizzle-orm/pg-core` doesn't export `vector`, upgrade drizzle-orm to latest and re-run (pgvector column support landed in drizzle 0.31+).
  </action>
  <verify>
    <automated>test -f drizzle.config.ts && test -f src/lib/db/client.ts && test -f src/lib/db/schema.ts && grep -q "dialect: 'postgresql'" drizzle.config.ts && grep -q "vector('embedding', { dimensions: 1024 })" src/lib/db/schema.ts && grep -q "export const db" src/lib/db/client.ts && grep -c "^export const" src/lib/db/schema.ts | awk '$1 >= 11 { exit 0 } { exit 1 }' && grep -q "\"db:migrate\"" package.json && grep -q "\"db:check\"" package.json && pnpm typecheck</automated>
  </verify>
  <done>
    - `drizzle-orm@^0.45`, `@neondatabase/serverless@^1`, `drizzle-kit@^0.31`, `dotenv` all in package.json
    - `drizzle.config.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts` all exist
    - Schema file exports all 11 tables (grep `^export const` ≥ 11)
    - `items.embedding` column is `vector('embedding', { dimensions: 1024 })` — literal string match
    - `pnpm typecheck` exits 0
    - package.json has `db:generate`, `db:migrate`, `db:push`, `db:check`, `db:studio` scripts
  </done>
</task>

<task type="auto">
  <name>Task 2: Hand-author 0000_enable_pgvector.sql and generate 0001_initial_schema.sql</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 4 (extension migration), §Pitfall 2 (Drizzle does not auto-emit CREATE EXTENSION — must be hand-authored and numbered 0000)
    - src/lib/db/schema.ts (the source of truth drizzle-kit will diff against)
    - drizzle.config.ts (confirm `out: './drizzle'`)
  </read_first>
  <files>drizzle/0000_enable_pgvector.sql, drizzle/0001_initial_schema.sql, drizzle/meta/_journal.json, drizzle/meta/0000_snapshot.json, drizzle/meta/0001_snapshot.json</files>
  <action>
    1. Create `drizzle/0000_enable_pgvector.sql` with this exact content:
       ```sql
       -- Enable pgvector extension for the Voyage voyage-3.5 1024-dim embedding column.
       -- Must run before 0001_initial_schema.sql because items.embedding = vector(1024).
       -- Source: D-10 / RESEARCH.md §Pattern 4 / neon.com/docs/extensions/pgvector
       CREATE EXTENSION IF NOT EXISTS vector;
       ```
    2. Manually seed the journal so drizzle-kit accepts the custom 0000 file. Create `drizzle/meta/_journal.json`:
       ```json
       {
         "version": "7",
         "dialect": "postgresql",
         "entries": [
           {
             "idx": 0,
             "version": "7",
             "when": 1745000000000,
             "tag": "0000_enable_pgvector",
             "breakpoints": true
           }
         ]
       }
       ```
       Also create an empty snapshot `drizzle/meta/0000_snapshot.json`:
       ```json
       {
         "id": "00000000-0000-0000-0000-000000000000",
         "prevId": "00000000-0000-0000-0000-000000000000",
         "version": "7",
         "dialect": "postgresql",
         "tables": {},
         "enums": {},
         "schemas": {},
         "sequences": {},
         "views": {},
         "_meta": { "columns": {}, "schemas": {}, "tables": {} }
       }
       ```
       (If this hand-seeded journal causes drizzle-kit conflicts, fall back to the alternative: move `0000_enable_pgvector.sql` content into a separate raw SQL hook executed before `drizzle-kit migrate` via a small shell step. Document the fallback in the SUMMARY.)
    3. Export `DATABASE_URL` pointing at the Neon **dev** branch (D-12). If the developer has not yet populated `.env.local`, STOP and ask them to add `DATABASE_URL=postgres://...neon.tech/...` to `.env.local` with the dev branch connection string — this is a user_setup item from the frontmatter.
    4. Run `pnpm db:generate` (alias for `drizzle-kit generate`). This should produce `drizzle/0001_initial_schema.sql` and update `drizzle/meta/_journal.json` + `drizzle/meta/0001_snapshot.json`.
    5. Inspect the generated `0001_initial_schema.sql` — confirm:
       - Contains `CREATE TABLE "sources"`, `"items"`, `"clusters"`, `"item_clusters"`, `"tags"`, `"item_tags"`, `"users"`, `"favorites"`, `"votes"`, `"settings"`, `"pipeline_runs"` (11 CREATE TABLE statements)
       - Contains `"embedding" vector(1024)` on the items table
       - Contains `"centroid" vector(1024)` on the clusters table
       - Does NOT contain `CREATE EXTENSION` (that belongs in 0000)
       - If it DOES contain a `CREATE EXTENSION` line, delete it from this file — the 0000 file owns extension creation.
    6. Run `pnpm db:check` — must exit 0 (no drift between schema.ts and generated SQL).
  </action>
  <verify>
    <automated>test -f drizzle/0000_enable_pgvector.sql && test -f drizzle/0001_initial_schema.sql && grep -q "CREATE EXTENSION IF NOT EXISTS vector" drizzle/0000_enable_pgvector.sql && grep -c "CREATE TABLE" drizzle/0001_initial_schema.sql | awk '$1 == 11 { exit 0 } { exit 1 }' && grep -q "vector(1024)" drizzle/0001_initial_schema.sql && ! grep -q "CREATE EXTENSION" drizzle/0001_initial_schema.sql && test -f drizzle/meta/_journal.json && pnpm db:check</automated>
  </verify>
  <done>
    - `drizzle/0000_enable_pgvector.sql` exists with `CREATE EXTENSION IF NOT EXISTS vector;`
    - `drizzle/0001_initial_schema.sql` exists with 11 CREATE TABLE statements
    - `vector(1024)` appears on `items.embedding` AND `clusters.centroid`
    - `CREATE EXTENSION` does NOT appear in 0001 (only 0000)
    - `drizzle/meta/_journal.json` lists both 0000 and 0001 entries
    - `pnpm db:check` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 3: [BLOCKING] Apply migrations to live Neon dev branch via drizzle-kit migrate</name>
  <read_first>
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-11 branch-per-PR for CI, D-12 long-lived dev branch for local)
    - .planning/phases/01-infrastructure-foundation/01-RESEARCH.md §Pattern 2 (migrate vs push — migrate in CI, push for dev), §Pitfall 2 (ordering), §Pitfall 5 (frozen-lockfile)
    - drizzle/0000_enable_pgvector.sql, drizzle/0001_initial_schema.sql (the files to be applied)
    - .env.local (DATABASE_URL source)
  </read_first>
  <files>drizzle/meta/_journal.json (updated post-migrate), Neon dev branch state (live)</files>
  <action>
    **This is a `[BLOCKING]` task per the phase frontmatter schema_push_requirement.** The phase CANNOT be verified complete without a live, migrated database. Build and type checks will PASS without this task (types come from config, not the live DB) creating a false-positive.

    1. Confirm `.env.local` has `DATABASE_URL` pointing at the Neon **dev** branch (not production). If unset, STOP — this is a human-required setup step (frontmatter `user_setup`). Surface the exact error: `DATABASE_URL missing — paste Neon dev branch connection string into .env.local`.
    2. Confirm connectivity: `pnpm dlx @neondatabase/cli@latest connection-string` is not strictly required, but you can run `node -e "require('@neondatabase/serverless').neon(process.env.DATABASE_URL)('SELECT 1').then(r => console.log(r))"` (with `DATABASE_URL` exported) to prove the URL is reachable. Abort on any error.
    3. Run the migration: `pnpm db:migrate`. This runs `drizzle-kit migrate` which applies 0000 then 0001 in order against the URL in `DATABASE_URL`.
    4. On success, verify against the live DB:
       ```bash
       node -e "
         const { neon } = require('@neondatabase/serverless');
         const sql = neon(process.env.DATABASE_URL);
         (async () => {
           const ext = await sql\`SELECT extname FROM pg_extension WHERE extname = 'vector'\`;
           console.log('pgvector:', ext.length ? 'OK' : 'MISSING');
           const tables = await sql\`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\`;
           console.log('tables:', tables.map(t => t.tablename).join(','));
           const expected = ['clusters','favorites','item_clusters','item_tags','items','pipeline_runs','settings','sources','tags','users','votes'];
           const actual = tables.map(t => t.tablename).sort();
           console.log('match:', expected.every(t => actual.includes(t)) ? 'OK' : 'MISSING: ' + expected.filter(t => !actual.includes(t)).join(','));
         })();
       "
       ```
       All three lines must print `OK` (and `tables:` must list exactly the 11 tables).
    5. If the migrate command is non-interactive (drizzle-kit migrate is), this task is `type: auto`. If it prompts at any point (it shouldn't for generated SQL), flag the task `autonomous: false` at the plan level — already set.
    6. Commit `drizzle/` directory including `meta/_journal.json` so CI in Plan 05 applies the same migrations against per-PR branches.

    **If this task fails** (e.g., "type vector does not exist"): the 0000 extension migration ordering is wrong. Do NOT proceed to `/api/health` in Plan 04 until this task succeeds.
  </action>
  <verify>
    <automated>node -e "const { neon } = require('@neondatabase/serverless'); const sql = neon(process.env.DATABASE_URL); (async () => { const ext = await sql\`SELECT extname FROM pg_extension WHERE extname = 'vector'\`; if (!ext.length) process.exit(1); const tables = await sql\`SELECT tablename FROM pg_tables WHERE schemaname='public'\`; const expected = ['clusters','favorites','item_clusters','item_tags','items','pipeline_runs','settings','sources','tags','users','votes']; const actual = tables.map(t => t.tablename); if (!expected.every(t => actual.includes(t))) process.exit(1); })().catch(() => process.exit(1))"</automated>
  </verify>
  <done>
    - `pnpm db:migrate` exited 0
    - Neon dev branch has `vector` extension enabled (pg_extension query returns 1 row)
    - Neon dev branch has all 11 public tables (sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs)
    - `items.embedding` column type is `vector(1024)` verified via `\d items` or `information_schema.columns`
    - `drizzle/meta/_journal.json` updated and committed
    - Phase 1 Success Criterion #2 (Neon + pgvector + all tables) fulfilled for dev env — production env lands in Plan 05 CI
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Next.js API route → Neon HTTP | TLS via neon() driver; DATABASE_URL is server-only, never client-exposed |
| drizzle-kit CLI → Neon | TLS; DATABASE_URL provided via environment, never committed |
| schema.ts → generated SQL | Trust the generator; hand-inspect 0001 for correctness |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-03 | Tampering (SQL injection) | Future API routes querying Drizzle | mitigate | Drizzle query builder exclusively; no `sql.raw()` in Phase 1; health route uses only tagged-template `sql\`SELECT 1\`` with no user input |
| T-1-04 | Tampering (migration drift) | Production vs CI vs local schemas | mitigate | `drizzle-kit check` enforced in CI (Plan 05); hand-authored 0000 extension migration numbered first; `_journal.json` committed; `autonomous: false` on migrate task so a human observes the apply step |
| T-1-01 | Information Disclosure | `DATABASE_URL` handling | mitigate | `.env.local` in `.gitignore` (Plan 01); pre-commit UUID hook blocks Neon connection-string tokens (UUID-shaped); no DB URL logged in health route error output (Plan 04) |
| T-1-11 | Denial of Service (pgvector ops) | `items.embedding` without HNSW index | accept | HNSW index intentionally deferred to Phase 3 per D-10; Phase 1 has no vector queries, only column existence |
</threat_model>

<verification>
```bash
pnpm typecheck
pnpm db:check
pnpm db:migrate            # against .env.local DATABASE_URL (dev Neon branch)
# Then the inline node verification in Task 3 to prove extension + 11 tables live
```

ROADMAP Phase 1 Success Criterion #2 covered (Neon + pgvector + all tables reachable) — fully verified only when Plan 04's `/api/health` returns neon:"ok" from Vercel preview.
</verification>

<success_criteria>
- All 11 tables defined in `src/lib/db/schema.ts` and present in `drizzle/0001_initial_schema.sql`
- pgvector extension migration numbered `0000_enable_pgvector.sql` and applied before `0001_initial_schema.sql`
- `items.embedding vector(1024)` confirmed live on Neon dev branch
- `pnpm db:check` exits 0 (no drift)
- `src/lib/db/client.ts` exports a Drizzle `db` instance using the Neon HTTP driver — consumed by Plans 04+
- `.env.example` still the canonical env var registry (unchanged from Plan 01)
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-02-SUMMARY.md` with:
- Drizzle + drizzle-kit + @neondatabase/serverless versions installed
- Whether the hand-seeded `_journal.json` worked or the fallback (raw SQL hook) was used
- Neon dev branch name + region (NOT the connection string)
- Output of the verify query proving 11 tables + pgvector
- Any schema adjustments made for Phase 2/3 readiness (e.g., if `item_clusters` nullability was tweaked)
</output>
</content>
</invoke>