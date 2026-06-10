/**
 * Vitest-free factory for a real Drizzle + node-postgres connection.
 *
 * Split out from `tests/helpers/db.ts` (Plan 05-00) so Playwright E2E
 * specs — which cannot import `vitest` at runtime — can still reach a
 * test DB via seedSession(). `db.ts` re-exports `makeTestDb` so all
 * existing Vitest callers keep working.
 *
 * node-postgres (Pool) supports `db.transaction()`, so callers that need
 * transactional behaviour can use this client directly.
 *
 * Threat-model guard (T-5-W0-01 / T-5-E2E-01): fail-closed when
 * DATABASE_URL appears to point at the production database.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/lib/db/schema';

/**
 * Returns a Drizzle client bound to the DATABASE_URL env var.
 *
 * Throws when:
 *   - DATABASE_URL is unset (integration tests require a test DB)
 *   - DATABASE_URL looks like a production database (fail-closed)
 */
export function makeTestDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL required for integration tests. Set it to a Supabase test connection string.',
    );
  }
  const lowered = url.toLowerCase();
  if (lowered.includes('prod')) {
    throw new Error(
      'DATABASE_URL appears to reference a production database. Integration tests MUST run against a non-prod database.',
    );
  }
  const pool = new Pool({ connectionString: url });
  return drizzle({ client: pool, schema });
}
