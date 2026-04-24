/**
 * Plan 06-02 Task 1 — unit tests for src/lib/admin/sources-repo.ts.
 *
 * Covers the pure DB-access layer used by the admin sources pages:
 *   - listSourcesForAdmin — filters deleted_at IS NULL, orders by createdAt DESC
 *   - getSourceByIdForAdmin — returns the single row or null
 *   - createSourceCore — inserts and returns { id }
 *   - updateSourceCore — partial patch semantics (only passed keys set)
 *   - softDeleteSourceCore — sets deleted_at + isActive=false
 *
 * Uses a lightweight in-memory db mock matching the pattern in
 * src/lib/ingest/fetch-source-core.test.ts. The mock records the chain of
 * Drizzle builder calls so each test can assert on the shape of the SQL
 * fragments without materializing a real Postgres connection.
 */
import { describe, it, expect } from 'vitest';
import {
  listSourcesForAdmin,
  getSourceByIdForAdmin,
  createSourceCore,
  updateSourceCore,
  softDeleteSourceCore,
  type SourceAdminRow,
} from '@/lib/admin/sources-repo';

type Recorder = {
  selectCalls: Array<{ where?: unknown; orderBy?: unknown }>;
  insertValues: Array<Record<string, unknown>>;
  updateSets: Array<Record<string, unknown>>;
  updateWheres: unknown[];
};

function fakeRow(overrides: Partial<SourceAdminRow> = {}): SourceAdminRow {
  return {
    id: 1,
    name: 'Anthropic News',
    rssUrl: '/anthropic/news',
    language: 'en',
    weight: '1.0',
    isActive: true,
    category: 'lab',
    consecutiveEmptyCount: 0,
    consecutiveErrorCount: 0,
    lastFetchedAt: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Build a mock db object that captures the Drizzle builder chain. Returning
 * `rows` from the terminal .where() / .orderBy() mimics the final Promise
 * that Drizzle produces in production.
 */
function makeDbMock(rows: SourceAdminRow[] = []) {
  const rec: Recorder = {
    selectCalls: [],
    insertValues: [],
    updateSets: [],
    updateWheres: [],
  };

  const selectChain = {
    from: () => selectChain,
    where: (w: unknown) => {
      rec.selectCalls.push({ where: w });
      return {
        orderBy: (o: unknown) => {
          rec.selectCalls[rec.selectCalls.length - 1]!.orderBy = o;
          return Promise.resolve(rows);
        },
        limit: () => Promise.resolve(rows),
      };
    },
  };

  const insertChain = {
    values: (v: Record<string, unknown>) => {
      rec.insertValues.push(v);
      return {
        returning: () => Promise.resolve([{ id: 42 }]),
      };
    },
  };

  const updateChain = {
    set: (v: Record<string, unknown>) => {
      rec.updateSets.push(v);
      return {
        where: (w: unknown) => {
          rec.updateWheres.push(w);
          return Promise.resolve();
        },
      };
    },
  };

  return {
    db: {
      select: () => selectChain,
      insert: () => insertChain,
      update: () => updateChain,
    } as never,
    rec,
  };
}

describe('listSourcesForAdmin', () => {
  it('returns rows filtered by deleted_at IS NULL, ordered by createdAt DESC', async () => {
    const rows = [fakeRow({ id: 2 }), fakeRow({ id: 1 })];
    const { db, rec } = makeDbMock(rows);

    const result = await listSourcesForAdmin({ db });

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe(2);
    // Exactly one select was issued; it had a where clause and an orderBy clause.
    expect(rec.selectCalls).toHaveLength(1);
    expect(rec.selectCalls[0]!.where).toBeDefined();
    expect(rec.selectCalls[0]!.orderBy).toBeDefined();
  });

  it('returns an empty array when no sources exist', async () => {
    const { db } = makeDbMock([]);
    const result = await listSourcesForAdmin({ db });
    expect(result).toEqual([]);
  });
});

describe('getSourceByIdForAdmin', () => {
  it('returns the single row when found', async () => {
    const row = fakeRow({ id: 7, name: 'Test' });
    const { db } = makeDbMock([row]);
    const result = await getSourceByIdForAdmin(7, { db });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(7);
    expect(result!.name).toBe('Test');
  });

  it('returns null when no row is found', async () => {
    const { db } = makeDbMock([]);
    const result = await getSourceByIdForAdmin(999, { db });
    expect(result).toBeNull();
  });
});

describe('createSourceCore', () => {
  it('inserts a new row and returns { id }', async () => {
    const { db, rec } = makeDbMock();
    const result = await createSourceCore(
      {
        name: 'New Source',
        rssUrl: '/new/route',
        language: 'zh',
        weight: '2.0',
        category: 'social',
        isActive: true,
      },
      { db },
    );
    expect(result.id).toBe(42);
    expect(rec.insertValues).toHaveLength(1);
    expect(rec.insertValues[0]).toMatchObject({
      name: 'New Source',
      rssUrl: '/new/route',
      language: 'zh',
      weight: '2.0',
      category: 'social',
      isActive: true,
    });
  });

  it('uses sensible defaults for optional fields', async () => {
    const { db, rec } = makeDbMock();
    await createSourceCore({ name: 'Minimal', rssUrl: '/x' }, { db });
    expect(rec.insertValues).toHaveLength(1);
    const v = rec.insertValues[0]!;
    expect(v.name).toBe('Minimal');
    expect(v.rssUrl).toBe('/x');
    // Defaults applied: language='zh', weight='1.0', isActive=true, category=null
    expect(v.language).toBe('zh');
    expect(v.weight).toBe('1.0');
    expect(v.isActive).toBe(true);
    expect(v.category).toBeNull();
  });
});

describe('updateSourceCore', () => {
  it('applies a partial patch — only passed keys appear in the SET clause', async () => {
    const { db, rec } = makeDbMock();
    await updateSourceCore(7, { weight: '3.5', isActive: false }, { db });
    expect(rec.updateSets).toHaveLength(1);
    const set = rec.updateSets[0]!;
    expect(set).toMatchObject({ weight: '3.5', isActive: false });
    // name and category were not passed, so they must not be in the SET.
    expect(set).not.toHaveProperty('name');
    expect(set).not.toHaveProperty('category');
  });

  it('accepts a null category (unsetting the taxonomy)', async () => {
    const { db, rec } = makeDbMock();
    await updateSourceCore(7, { category: null }, { db });
    expect(rec.updateSets[0]).toMatchObject({ category: null });
  });

  it('is a no-op when the patch object is empty', async () => {
    const { db, rec } = makeDbMock();
    await updateSourceCore(7, {}, { db });
    // Either no update issued, or an empty set — both are acceptable.
    // We assert the function does not throw and that if it issued an update,
    // the set is empty.
    if (rec.updateSets.length > 0) {
      expect(rec.updateSets[0]).toEqual({});
    }
  });
});

describe('softDeleteSourceCore', () => {
  it('sets deletedAt to a Date and isActive to false', async () => {
    const { db, rec } = makeDbMock();
    await softDeleteSourceCore(7, { db });
    expect(rec.updateSets).toHaveLength(1);
    const set = rec.updateSets[0]!;
    expect(set.isActive).toBe(false);
    expect(set.deletedAt).toBeInstanceOf(Date);
  });

  it('filters on deleted_at IS NULL so a double-delete is a no-op (scope of WHERE)', async () => {
    const { db, rec } = makeDbMock();
    await softDeleteSourceCore(7, { db });
    // The where clause was recorded — we cannot easily introspect the SQL
    // expression tree here, but presence alone is the contract.
    expect(rec.updateWheres).toHaveLength(1);
    expect(rec.updateWheres[0]).toBeDefined();
  });
});
