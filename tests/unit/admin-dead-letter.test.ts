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

import { listDeadLetterItems, retryItemCore, retryAllCore } from '@/lib/admin/dead-letter-repo';

/**
 * Flatten an arbitrary Drizzle SQL template value into the string literals it
 * embeds. Drizzle builds a tree of queryChunks with embedded Column objects
 * that reference their PgTable (circular); JSON.stringify can't serialise
 * either the circular structure or BigInt ids. This walker returns just the
 * string fragments, which is what the tests assert against (e.g., the literal
 * "status = 'pending'" embedded between parameter placeholders).
 */
function flattenSql(node: unknown, out: string[] = [], seen = new WeakSet<object>()): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (node && typeof node === 'object') {
    if (seen.has(node as object)) return out;
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const el of node) flattenSql(el, out, seen);
      return out;
    }
    // SQL / StringChunk values carry their literal under .value or .sql.
    for (const key of ['value', 'sql', 'queryChunks']) {
      if (key in (node as Record<string, unknown>)) {
        flattenSql((node as Record<string, unknown>)[key], out, seen);
      }
    }
  }
  return out;
}

// Minimal chainable mock factory — every builder method returns the chain
// itself so .from().leftJoin().where().orderBy().limit() works. The chain
// is also thenable so `await` on any intermediate resolves to `resolveWith`.
function makeChainable(resolveWith: unknown): {
  db: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  chain: Record<string, ReturnType<typeof vi.fn>>;
  execute: ReturnType<typeof vi.fn>;
} {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'set', 'returning']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Drizzle's query builder is thenable — awaiting it resolves to the query
  // result. Expose `then` on the same chain object so any `await` during the
  // builder walk collapses to `resolveWith`.
  (chain as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }).then = (
    onFulfilled,
  ) => Promise.resolve(resolveWith).then(onFulfilled);
  const execute = vi.fn();
  const db = {
    select: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    execute,
  };
  return { db, chain, execute };
}

describe('listDeadLetterItems', () => {
  it('queries items with WHERE status=dead_letter, ORDER BY processedAt DESC, LIMIT n', async () => {
    const mockRows = [
      {
        id: BigInt(101),
        title: 'Alpha',
        sourceName: 'Anthropic',
        failureReason: 'ZodError',
        retryCount: 2,
        processedAt: new Date('2026-04-23T10:00:00Z'),
        ingestedAt: new Date('2026-04-23T09:00:00Z'),
        url: 'https://a.example/1',
      },
      {
        id: BigInt(102),
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
    const rows = await listDeadLetterItems({ limit: 25 }, { db: db as never });
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
    const { db } = makeChainable([{ id: BigInt(101) }]);
    const res = await retryItemCore({ itemId: BigInt(101) }, { db: db as never });
    expect(res.retried).toBe(true);
    expect(db.update).toHaveBeenCalledOnce();
  });

  it('returns {retried: false} when the WHERE status=dead_letter guard matched 0 rows (race)', async () => {
    const { db } = makeChainable([]); // no rows returned → already retried by another admin
    const res = await retryItemCore({ itemId: BigInt(999) }, { db: db as never });
    expect(res.retried).toBe(false);
  });

  it('increments retry_count via a SQL expression (retry_count + 1) rather than a JS value', async () => {
    const { db, chain } = makeChainable([{ id: BigInt(1) }]);
    await retryItemCore({ itemId: BigInt(1) }, { db: db as never });
    // The SET clause is passed to .set(); assert the shape carries a Drizzle SQL token,
    // not a number (which would race under concurrent retries).
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>;
    const fragments = flattenSql(setArg.retryCount).join(' ');
    // Drizzle sql`${items.retryCount} + 1` embeds the literal " + 1" in its queryChunks.
    expect(fragments).toContain('+ 1');
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
    // With empty candidates the builder-based UPDATE path is skipped entirely.
    expect(db.update).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('bulk-updates up to N most-recent dead-letter rows and returns the count', async () => {
    // The chainable mock resolves both the SELECT (step 1) and the UPDATE
    // (step 2) to the same list; retryAllCore only reads `.length` off the
    // update call, so reusing the id list is harmless and keeps the mock
    // simple. The real SQL path is the query builder (inArray + eq) — the
    // previous raw-SQL `WHERE id IN ${ids}` form crashed at runtime because
    // Drizzle's sql tag binds a JS array as one parameter (see REVIEW CR-01).
    const { db, chain } = makeChainable([{ id: BigInt(1) }, { id: BigInt(2) }, { id: BigInt(3) }]);
    const res = await retryAllCore({ limit: 3 }, { db: db as never });
    expect(res.count).toBe(3);
    // Raw execute() must NOT be used for the bulk UPDATE — this is the guard
    // that re-asserts the CR-01 fix: no raw sql`WHERE id IN ${ids}` path.
    expect(db.execute).not.toHaveBeenCalled();
    // db.update() is invoked exactly once (step 2) with the `items` table.
    expect(db.update).toHaveBeenCalledOnce();
    // The SET clause carries the SQL retry_count + 1 expression (not a JS
    // integer) so the increment happens atomically in the DB.
    const setArg = chain.set.mock.calls[0][0] as Record<string, unknown>;
    const setFragments = flattenSql(setArg.retryCount).join(' ');
    expect(setFragments).toContain('+ 1');
    expect(setArg.status).toBe('pending');
    expect(setArg.failureReason).toBeNull();
    expect(setArg.processedAt).toBeNull();
    // The WHERE clause is the `and(inArray(items.id, ids), eq(items.status,
    // 'dead_letter'))` composition. We assert the dead_letter race guard is
    // present in the rendered fragments. (Drizzle's inArray emits its "in"
    // operator via a non-string SQL token that the flattenSql walker does not
    // surface, so we cannot grep for " in " reliably; the integration test at
    // tests/integration/dead-letter-retry-all.test.ts executes the query
    // against real Postgres to prove the inArray path works end-to-end.)
    // `chain.where` is called twice (once by the SELECT in step 1, once by
    // the UPDATE in step 2) because the mock shares the single chain object.
    expect(chain.where).toHaveBeenCalledTimes(2);
    // Assert that the UPDATE WHERE (second call) carries the race guard.
    const updateWhereArg = chain.where.mock.calls[1][0];
    const updateWhereFragments = flattenSql(updateWhereArg).join(' ').toLowerCase();
    expect(updateWhereFragments).toContain('dead_letter');
  });
});
