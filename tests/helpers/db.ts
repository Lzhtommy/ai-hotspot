/**
 * Test DB helpers — Phase 5 Wave 0.
 *
 * Provides two factories:
 *   - makeTestDb():  real Drizzle+Neon HTTP connection (integration tests on a Neon branch)
 *                    re-exported from `./test-db` so Playwright specs can import
 *                    it without transitively pulling in Vitest.
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
import { vi } from 'vitest';

export { makeTestDb } from './test-db';

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
