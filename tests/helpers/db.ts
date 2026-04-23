/**
 * Test DB helpers — Phase 5 Wave 0.
 *
 * Provides two factories:
 *   - makeTestDb():  real Drizzle+Neon HTTP connection (integration tests on a Neon branch)
 *   - makeMockDb():  typed stub with chainable vi.fn() for unit tests
 *
 * Threat-model guard (T-5-W0-01): `makeTestDb` fail-closes when DATABASE_URL
 * appears to point at a production Neon branch. Integration tests MUST run
 * against a non-prod branch (set DATABASE_URL to a branch-scoped connection
 * string in CI / local dev).
 *
 * Consumed by:
 *   - tests/integration/*.test.ts (real DB path)
 *   - tests/unit/*.test.ts (mock path)
 */
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { vi } from 'vitest';
import * as schema from '@/lib/db/schema';

/**
 * Returns a Drizzle client bound to the DATABASE_URL env var.
 *
 * Throws when:
 *   - DATABASE_URL is unset (integration tests require a branch DB)
 *   - DATABASE_URL looks like a production branch (fail-closed per T-5-W0-01)
 */
export function makeTestDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL required for integration tests. Set it to a Neon branch connection string.',
    );
  }
  // Fail-closed heuristic: reject obvious production-branch URLs.
  const lowered = url.toLowerCase();
  if (lowered.includes('prod') || /ep-[a-z0-9-]+-prod/.test(lowered)) {
    throw new Error(
      'DATABASE_URL appears to reference a production branch. Integration tests MUST run against a non-prod Neon branch.',
    );
  }
  return drizzle(neon(url), { schema });
}

/**
 * Minimal chainable Drizzle-like mock for unit tests. Each method returns
 * `this` so arbitrary chain shapes (.from().leftJoin().where().orderBy().limit().offset())
 * resolve; terminal calls must be overridden per-test via `.mockResolvedValueOnce()`.
 *
 * Mirrors the manual-mock pattern used in src/lib/feed/get-feed.test.ts.
 */
export function makeMockDb() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const self: Record<string, unknown> = {};
  for (const method of [
    'from',
    'leftJoin',
    'innerJoin',
    'rightJoin',
    'where',
    'orderBy',
    'groupBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ]) {
    chainable[method] = vi.fn().mockReturnValue(self);
  }
  Object.assign(self, chainable);

  return {
    select: vi.fn().mockReturnValue(self),
    insert: vi.fn().mockReturnValue(self),
    update: vi.fn().mockReturnValue(self),
    delete: vi.fn().mockReturnValue(self),
    execute: vi.fn(),
    _chain: self,
  };
}

export type MockDb = ReturnType<typeof makeMockDb>;
