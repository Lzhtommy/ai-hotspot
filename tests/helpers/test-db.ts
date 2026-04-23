/**
 * Vitest-free factory for a real Drizzle+Neon HTTP connection.
 *
 * Split out from `tests/helpers/db.ts` (Plan 05-00) so Playwright E2E
 * specs — which cannot import `vitest` at runtime — can still reach a
 * branch DB via seedSession(). `db.ts` re-exports `makeTestDb` so all
 * existing Vitest callers keep working.
 *
 * Threat-model guard (T-5-W0-01 / T-5-E2E-01): fail-closed when
 * DATABASE_URL appears to point at a production Neon branch.
 */
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/lib/db/schema';

/**
 * Returns a Drizzle client bound to the DATABASE_URL env var.
 *
 * Throws when:
 *   - DATABASE_URL is unset (integration tests require a branch DB)
 *   - DATABASE_URL looks like a production branch (fail-closed)
 */
export function makeTestDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL required for integration tests. Set it to a Neon branch connection string.',
    );
  }
  const lowered = url.toLowerCase();
  if (lowered.includes('prod') || /ep-[a-z0-9-]+-prod/.test(lowered)) {
    throw new Error(
      'DATABASE_URL appears to reference a production branch. Integration tests MUST run against a non-prod Neon branch.',
    );
  }
  return drizzle(neon(url), { schema });
}
