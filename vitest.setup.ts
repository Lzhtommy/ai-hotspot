/**
 * Vitest setup — runs before any test module is loaded.
 *
 * Sets a placeholder DATABASE_URL so that src/lib/db/client.ts can be imported
 * transitively without throwing. Unit tests that exercise DB logic inject a
 * mocked `db` via the `deps` parameter; the real Postgres client is never used
 * in tests. Setting the env var here is strictly to satisfy the eager
 * `new Pool(...)` call in src/lib/db/client.ts at module-load time (node-postgres
 * Pool is lazy — it does not connect until the first query).
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?sslmode=require';
process.env.ANTHROPIC_API_KEY ??= 'sk-ant-test-dummy';
process.env.VOYAGE_API_KEY ??= 'pa-test-dummy';
process.env.LANGFUSE_PUBLIC_KEY ??= 'pk-lf-test-dummy';
process.env.LANGFUSE_SECRET_KEY ??= 'sk-lf-test-dummy';
process.env.LANGFUSE_BASE_URL ??= 'https://cloud.langfuse.com';
