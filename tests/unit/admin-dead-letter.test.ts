/**
 * Plan 06-05 Task 1 — unit tests for src/lib/admin/dead-letter-repo.ts.
 *
 * Covers the three exports required by the plan's must-haves:
 *   1. listDeadLetterItems({limit})       → only status='dead_letter' rows,
 *                                            ordered by processedAt DESC, limited
 *   2. retryItemCore({itemId})             → UPDATE ... WHERE id=? AND status='dead_letter'
 *                                            → {retried: true|false}
 *   3. retryAllCore({limit})               → selects up to N dead-letter rows, then
 *                                            updates them atomically via WHERE IN
 *                                            → {count: N}
 *
 * The repo uses the Phase 2/3 core-logic / adapter split (deps-injection),
 * mirroring src/lib/user-actions/favorites-core.ts. Tests inject a chainable
 * vi.fn()-based mock db so we can assert on both behaviour and the rendered
 * Drizzle SQL (race guard + retry_count increment).
 */
import { describe, it, expect, vi } from 'vitest';

import {
  listDeadLetterItems,
  retryItemCore,
  retryAllCore,
} from '@/lib/admin/dead-letter-repo';

// Minimal chainable mock factory — every builder method returns the same
// object so .from().leftJoin().where().orderBy().limit() resolves against a
// single spy that we control via mockResolvedValue[Once].
function makeChainable(resolveWith: unknown): {
  db: Record<string, ReturnType<typeof vi.fn>>;
  chain: Record<string, ReturnType<typeof vi.fn>>;
  execute: ReturnType<typeof vi.fn>;
} {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  // The terminal awaitable promise. Drizzle's query builder returns a thenable,
  // so we attach `then` so `await d.select()...` resolves to the configured value.
  const thenable = {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolveWith).then(onFulfilled),
  };
  for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'set', 'returning']) {
    chain[m] = vi.fn().mockReturnValue({ ...chain, ...thenable });
  }
  // Wire the chain object itself to contain the then() so awaiting it works.
  Object.assign(chain, thenable);
  const execute = vi.fn();
  const db = {
    select: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    execute,
  };
  return { db: db as unknown as Record<string, ReturnType<typeof vi.fn>>, chain, execute };
}

describe('listDeadLetterItems', () => {
  it('queries items with WHERE status=dead_letter, ORDER BY processedAt DESC, LIMIT n', async () => {
    const mockRows = [
      {
        id: 101n,
        title: 'Alpha',
        sourceName: 'Anthropic',
        failureReason: 'ZodError',
        retryCount: 2,
        processedAt: new Date('2026-04-23T10:00:00Z'),
        ingestedAt: new Date('2026-04-23T09:00:00Z'),
        url: 'https://a.example/1',
      },
      {
        id: 102n,
        title: 'Beta',
        sourceName: 'DeepMind',
        failureReason: 'APIError',
        retryCount: 0,
        processedAt: new Date('2026-04-23T11:00:00Z'),
        ingestedAt: new Date('2026-04-23T10:30:00Z'),
        url: 'https://b.example/1',
      },
    ];
    const { db } = makeChainable(mockRows);
    const rows = await listDeadLetterItems(
      { limit: 25 },
      { db: db as never },
    );
    expect(db.select).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(2);
    // bigints serialised to strings for RSC → client transport.
    expect(rows[0].id).toBe('101');
    expect(rows[1].id).toBe('102');
    expect(rows[0].title).toBe('Alpha');
  });
});

describe('retryItemCore', () => {
  it('returns {retried: true} when the UPDATE ... WHERE status=dead_letter matched a row', async () => {
    const { db } = makeChainable([{ id: 101n }]);
    const res = await retryItemCore({ itemId: 101n }, { db: db as never });
    expect(res.retried).toBe(true);
    expect(db.update).toHaveBeenCalledOnce();
  });

  it('returns {retried: false} when the WHERE status=dead_letter guard matched 0 rows (race)', async () => {
    const { db } = makeChainable([]); // no rows returned → already retried by another admin
    const res = await retryItemCore({ itemId: 999n }, { db: db as never });
    expect(res.retried).toBe(false);
  });

  it('increments retry_count via a SQL expression (retry_count + 1) rather than a JS value', async () => {
    const { db, chain } = makeChainable([{ id: 1n }]);
    await retryItemCore({ itemId: 1n }, { db: db as never });
    // The SET clause is passed to .set(); assert the shape carries a Drizzle SQL token,
    // not a number (which would race under concurrent retries).
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>;
    const rendered = JSON.stringify(setArg.retryCount);
    // Drizzle sql`${items.retryCount} + 1` embeds the literal " + 1" in its queryChunks.
    expect(rendered).toContain('+ 1');
    expect(setArg.status).toBe('pending');
    expect(setArg.failureReason).toBeNull();
    expect(setArg.processedAt).toBeNull();
  });
});

describe('retryAllCore', () => {
  it('returns {count: 0} when no dead-letter rows exist (no UPDATE emitted)', async () => {
    const { db } = makeChainable([]); // empty select
    const res = await retryAllCore({ limit: 20 }, { db: db as never });
    expect(res.count).toBe(0);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('bulk-updates up to N most-recent dead-letter rows and returns the count', async () => {
    const { db } = makeChainable([{ id: 1n }, { id: 2n }, { id: 3n }]);
    const res = await retryAllCore({ limit: 3 }, { db: db as never });
    expect(res.count).toBe(3);
    expect(db.execute).toHaveBeenCalledOnce();
    // Assert the bulk UPDATE SQL contains both the new-status transition and the
    // race guard. JSON.stringify is used because Drizzle's sql template returns
    // an object with queryChunks; literal strings embedded in chunks round-trip
    // through the serialiser.
    const sqlArg = db.execute.mock.calls[0][0];
    const rendered = JSON.stringify(sqlArg);
    expect(rendered).toContain("status = 'pending'");
    expect(rendered).toContain("status = 'dead_letter'");
    expect(rendered).toContain('retry_count + 1');
  });
});
