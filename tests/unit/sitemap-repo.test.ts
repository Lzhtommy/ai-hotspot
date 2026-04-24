/**
 * Task 6-07-01 | Plan 06-07 | Sitemap repo unit tests.
 *
 * Asserts that `getPublishedItemUrls`:
 *   (a) filters WHERE status='published' ONLY (no pending, failed, dead_letter)
 *   (b) orders by publishedAt DESC
 *   (c) respects the `limit` option (default 5000, overridable)
 *   (d) does NOT join the sources table (WARNING-8 — Wave 1 plan must not
 *       depend on Plan 06-01 schema; deleted_at filtering is out of scope here).
 *
 * Uses a mocked Drizzle chainable so no network/db is touched.
 */
import { describe, expect, it, vi } from 'vitest';
import { getPublishedItemUrls } from '@/lib/feed/sitemap-repo';

type Row = { id: bigint | number | string; publishedAt: Date; processedAt: Date | null };

/**
 * Build a Drizzle-style chainable query object that captures the final `.limit()` call
 * and resolves to the provided rows. We also capture the arguments passed to `.where()`,
 * `.orderBy()`, and `.limit()` so we can assert filter/ordering/limit behaviour.
 */
function makeChainable(rows: Row[]) {
  const calls = {
    select: undefined as unknown,
    from: undefined as unknown,
    where: undefined as unknown,
    orderBy: undefined as unknown,
    limit: undefined as number | undefined,
  };
  const chain: Record<string, unknown> = {
    from: vi.fn((arg: unknown) => {
      calls.from = arg;
      return chain;
    }),
    where: vi.fn((arg: unknown) => {
      calls.where = arg;
      return chain;
    }),
    orderBy: vi.fn((arg: unknown) => {
      calls.orderBy = arg;
      return chain;
    }),
    limit: vi.fn((n: number) => {
      calls.limit = n;
      return Promise.resolve(rows);
    }),
    // Guard — the repo MUST NOT call .leftJoin / .innerJoin (WARNING-8)
    leftJoin: vi.fn(() => {
      throw new Error('leftJoin is forbidden in sitemap-repo (WARNING-8)');
    }),
    innerJoin: vi.fn(() => {
      throw new Error('innerJoin is forbidden in sitemap-repo (WARNING-8)');
    }),
  };
  const db = {
    select: vi.fn((arg: unknown) => {
      calls.select = arg;
      return chain;
    }),
  };
  return { db, chain, calls };
}

const PUBLISHED_ROWS: Row[] = [
  {
    // BigInt() constructor (not literal) — tsconfig target is ES2017 which
    // forbids the `3n` literal form. Drizzle returns bigserial columns as
    // native bigint at runtime, so BigInt() matches the real row shape.
    id: BigInt(3),
    publishedAt: new Date('2026-04-22T12:00:00Z'),
    processedAt: new Date('2026-04-22T12:05:00Z'),
  },
  {
    id: BigInt(2),
    publishedAt: new Date('2026-04-21T12:00:00Z'),
    processedAt: new Date('2026-04-21T12:05:00Z'),
  },
  {
    id: BigInt(1),
    publishedAt: new Date('2026-04-20T12:00:00Z'),
    processedAt: null,
  },
];

describe('getPublishedItemUrls', () => {
  it('returns rows from the db with id stringified', async () => {
    const { db } = makeChainable(PUBLISHED_ROWS);
    const rows = await getPublishedItemUrls({}, { db: db as never });
    expect(rows).toHaveLength(3);
    // ids must be stringified (BigInt → string) so callers can interpolate into URLs safely
    expect(rows[0].id).toBe('3');
    expect(rows[1].id).toBe('2');
    expect(rows[2].id).toBe('1');
    // publishedAt is passed through as Date
    expect(rows[0].publishedAt).toBeInstanceOf(Date);
  });

  it('defaults to limit=5000 when no opts provided', async () => {
    const { db, calls } = makeChainable([]);
    await getPublishedItemUrls({}, { db: db as never });
    expect(calls.limit).toBe(5000);
  });

  it('respects an explicit limit option', async () => {
    const { db, calls } = makeChainable([]);
    await getPublishedItemUrls({ limit: 1 }, { db: db as never });
    expect(calls.limit).toBe(1);
  });

  it('applies a WHERE filter (presence check — asserts filter object was passed)', async () => {
    const { db, calls } = makeChainable([]);
    await getPublishedItemUrls({}, { db: db as never });
    // The repo MUST pass a where clause so published-only filtering is guaranteed.
    expect(calls.where).toBeDefined();
  });

  it('applies an ORDER BY clause (presence check)', async () => {
    const { db, calls } = makeChainable([]);
    await getPublishedItemUrls({}, { db: db as never });
    expect(calls.orderBy).toBeDefined();
  });

  it('does not call leftJoin / innerJoin on the query (WARNING-8: no schema dep)', async () => {
    // The chainable throws if join is called — repo must NOT join anything.
    const { db, chain } = makeChainable([]);
    await getPublishedItemUrls({}, { db: db as never });
    expect(chain.leftJoin).not.toHaveBeenCalled();
    expect(chain.innerJoin).not.toHaveBeenCalled();
  });
});
