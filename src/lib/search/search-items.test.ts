/**
 * Tests for searchItems — Quick 260424-ogp.
 *
 * Pure unit tests with a mocked `db.execute`. No Neon / network access.
 *
 * Covers:
 *   - Empty / <2-char queries return `[]` without touching db
 *   - `%` and `_` are escaped inside the ILIKE pattern
 *   - SQL shape: ILIKE over (title OR title_zh OR summary_zh), status='published',
 *     ORDER BY published_at DESC, LIMIT 10
 *   - Row mapping (bigint id → string; Date → ISO) preserves ordering
 */

import { describe, expect, it, vi } from 'vitest';
import { searchItems } from './search-items';

function makeDb(rows: Record<string, unknown>[]) {
  const execute = vi.fn().mockResolvedValue({ rows });
  return {
    db: { execute } as unknown as NonNullable<Parameters<typeof searchItems>[1]>['db'],
    execute,
  };
}

describe('searchItems — query guards', () => {
  it('returns [] for empty query without calling db', async () => {
    const { db, execute } = makeDb([]);
    const out = await searchItems('', { db });
    expect(out).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns [] for 1-char query without calling db', async () => {
    const { db, execute } = makeDb([]);
    const out = await searchItems('A', { db });
    expect(out).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns [] for whitespace-only query without calling db', async () => {
    const { db, execute } = makeDb([]);
    const out = await searchItems('   ', { db });
    expect(out).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('searchItems — SQL shape', () => {
  it('2-char query triggers a db.execute call', async () => {
    const { db, execute } = makeDb([]);
    await searchItems('AI', { db });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('SQL contains ILIKE on title, title_zh, and summary_zh (OR clause)', async () => {
    const { db, execute } = makeDb([]);
    await searchItems('Claude', { db });
    const arg = execute.mock.calls[0][0] as unknown as { queryChunks?: unknown[] };
    // Drizzle sql`...` templates expose queryChunks; walk and stringify to inspect.
    const serialized = JSON.stringify(arg.queryChunks ?? arg);
    expect(serialized).toMatch(/title\s+ILIKE/i);
    expect(serialized).toMatch(/title_zh\s+ILIKE/i);
    expect(serialized).toMatch(/summary_zh\s+ILIKE/i);
  });

  it("SQL filters by status = 'published'", async () => {
    const { db, execute } = makeDb([]);
    await searchItems('AI', { db });
    const arg = execute.mock.calls[0][0] as unknown as { queryChunks?: unknown[] };
    const serialized = JSON.stringify(arg.queryChunks ?? arg);
    expect(serialized).toMatch(/status\s*=\s*'published'/i);
  });

  it('SQL orders by published_at DESC and limits 10', async () => {
    const { db, execute } = makeDb([]);
    await searchItems('AI', { db });
    const arg = execute.mock.calls[0][0] as unknown as { queryChunks?: unknown[] };
    const serialized = JSON.stringify(arg.queryChunks ?? arg);
    expect(serialized).toMatch(/ORDER BY/i);
    expect(serialized).toMatch(/published_at/i);
    expect(serialized).toMatch(/DESC/i);
    expect(serialized).toMatch(/LIMIT\s*10/i);
  });
});

describe('searchItems — LIKE pattern escaping', () => {
  it("escapes '%' in user input (so 'a%b' is a literal match, not wildcard)", async () => {
    const { db, execute } = makeDb([]);
    await searchItems('a%b', { db });
    const arg = execute.mock.calls[0][0] as unknown as {
      queryChunks?: unknown[];
      params?: unknown[];
    };
    // The escaped pattern should appear in the sql params (parameterised).
    const params = (arg.params ?? []) as unknown[];
    const haystack = JSON.stringify(params) + JSON.stringify(arg.queryChunks ?? {});
    // The literal user '%' must be escaped to '\%' in the LIKE pattern.
    expect(haystack).toMatch(/\\%/);
  });

  it("escapes '_' in user input", async () => {
    const { db, execute } = makeDb([]);
    await searchItems('a_b', { db });
    const arg = execute.mock.calls[0][0] as unknown as {
      queryChunks?: unknown[];
      params?: unknown[];
    };
    const params = (arg.params ?? []) as unknown[];
    const haystack = JSON.stringify(params) + JSON.stringify(arg.queryChunks ?? {});
    expect(haystack).toMatch(/\\_/);
  });
});

describe('searchItems — row mapping', () => {
  it('maps bigint id to string and Date to ISO string', async () => {
    const now = new Date('2026-04-20T10:30:00Z');
    const { db } = makeDb([
      {
        id: BigInt(42),
        title: 'Anthropic releases Claude Haiku 4.5',
        title_zh: 'Anthropic 发布 Claude Haiku 4.5',
        summary_zh: '快速且便宜的模型',
        published_at: now,
        source_name: 'Anthropic News',
      },
    ]);
    const out = await searchItems('Claude', { db });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: '42',
      title: 'Anthropic releases Claude Haiku 4.5',
      titleZh: 'Anthropic 发布 Claude Haiku 4.5',
      summaryZh: '快速且便宜的模型',
      publishedAt: now.toISOString(),
      sourceName: 'Anthropic News',
    });
  });

  it('tolerates nullable title_zh / summary_zh / source_name', async () => {
    const { db } = makeDb([
      {
        id: BigInt(7),
        title: 'Plain English title only',
        title_zh: null,
        summary_zh: null,
        published_at: '2026-04-22T00:00:00Z',
        source_name: null,
      },
    ]);
    const out = await searchItems('English', { db });
    expect(out).toEqual([
      {
        id: '7',
        title: 'Plain English title only',
        titleZh: null,
        summaryZh: null,
        publishedAt: '2026-04-22T00:00:00Z',
        sourceName: null,
      },
    ]);
  });
});
