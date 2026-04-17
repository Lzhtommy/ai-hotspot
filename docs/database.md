# Database

Neon Postgres with pgvector extension, schema defined in Drizzle, migrated via `drizzle-kit`.

## Schema

Eleven tables, all defined in `src/lib/db/schema.ts`:

- `sources` — RSSHub routes / raw RSS feeds
- `items` — ingested RSS entries (with `embedding vector(1024)`)
- `clusters` — event groupings (with `centroid vector(1024)`)
- `item_clusters` — join table
- `tags`, `item_tags` — tagging normalization
- `users` — accounts (Auth.js adapter compatible)
- `favorites`, `votes` — user-item interactions
- `settings` — admin-tunable config (seed: `cluster_threshold=0.82`)
- `pipeline_runs` — LLM token/cost audit trail per item per run

## Migrations

Two files, ordered lexicographically:

- `drizzle/0000_enable_pgvector.sql` — hand-authored: `CREATE EXTENSION IF NOT EXISTS vector;`
- `drizzle/0001_initial_schema.sql` — generated from `schema.ts` via `drizzle-kit generate`

## Workflows

### Local development (your Neon dev branch or local Postgres)

```bash
# Option A: push (fast, skips SQL files) — wraps `drizzle-kit push`
pnpm db:push

# Option B: generate + migrate (matches CI flow) — wraps `drizzle-kit generate` + `drizzle-kit migrate`
pnpm db:generate         # produces a new numbered SQL file if schema.ts changed
pnpm db:migrate          # applies pending migrations
```

The `pnpm db:*` scripts are thin wrappers around `drizzle-kit` subcommands (see `package.json`). Never run `db:push` in CI — no audit trail.

### CI (per-PR Neon branch)

`.github/workflows/ci.yml`:

1. `neondatabase/create-branch-action@v6` → new branch `pr-<N>`
2. `pnpm db:migrate` with `DATABASE_URL=${{ steps.neon-branch.outputs.db_url }}`

Migration failure blocks PR merge.

### Production (on merge to main)

Same `pnpm db:migrate` — uses `secrets.DATABASE_URL_MAIN`.

## Adding a Migration

1. Edit `src/lib/db/schema.ts`
2. `pnpm db:generate` — produces `drizzle/000N_<name>.sql`
3. Inspect the SQL for correctness (pgvector columns, FK cascades, etc.)
4. Commit both the schema change AND the SQL file
5. `pnpm db:check` — must pass (no drift)
6. CI applies it on PR, and production-migrates on merge

## pgvector Notes

- Extension enabled in `0000_enable_pgvector.sql` (hand-authored) — must come before any schema referencing `vector()`
- Column type: `vector('embedding', { dimensions: 1024 })` from `drizzle-orm/pg-core`
- HNSW index on `items.embedding` is intentionally deferred to Phase 3 (D-10) — not needed until clustering ships

## Anti-Patterns

- `drizzle-kit push` in CI (no audit trail)
- Putting `CREATE EXTENSION` inside `drizzle-kit generate` output (it may reorder statements)
- Editing generated SQL files by hand (re-run `db:generate` instead)
- Using `sql.raw(userInput)` (SQL injection — always use tagged-template `` sql`SELECT ... ${param}` ``)
