/**
 * Vitest setup — runs before any test module is loaded.
 *
 * Sets a placeholder DATABASE_URL so that src/lib/db/client.ts can be imported
 * transitively without throwing. Unit tests that exercise DB logic inject a
 * mocked `db` via the `deps` parameter; the real Neon client is never used in
 * tests. Setting the env var here is strictly to satisfy the eager `neon()`
 * call in src/lib/db/client.ts at module-load time.
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?sslmode=require';
