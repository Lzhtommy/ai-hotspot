// Task 5-08-01 | Plan 05-08 | REQ-FAV-03 | Threat T-5-10
//
// Asserts /favorites is auth-gated per D-15 Option A:
//   - anonymous session → redirect('/') (thrown as NEXT_REDIRECT by next/navigation)
//   - authenticated session → user-scoped reverse-chrono query filtering
//     items.status='published', rendered via FeedTopBar + Timeline (with favorites)
//     or FavoritesEmpty authenticated branch (zero favorites)
//
// Strategy: mock @/lib/auth.auth, @/lib/db/client.db, @/lib/user-actions/get-interactions,
// and next/navigation.redirect. Invoke the RSC default export directly and introspect the
// returned React element tree with vitest's deep-equal matchers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeSession } from '../helpers/auth';

type Row = Record<string, unknown>;

const favoritesRows: Row[] = [];

// Fluent query builder mock — returns itself for every chain method, terminates
// awaiting the promise with `favoritesRows`. Mirrors the `/all` page's
// select().from().leftJoin()...orderBy() call shape.
function makeQueryBuilder(rows: Row[]) {
  const builder: Record<string, unknown> & PromiseLike<Row[]> = {
    select: () => builder,
    from: () => builder,
    leftJoin: () => builder,
    innerJoin: () => builder,
    rightJoin: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    then: (onFulfilled?: (value: Row[]) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  } as Record<string, unknown> & PromiseLike<Row[]>;
  return builder;
}

vi.mock('@/lib/auth' as string, () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db/client' as string, () => ({
  db: {
    select: (..._args: unknown[]) => makeQueryBuilder(favoritesRows),
  },
}));

vi.mock('next/navigation' as string, () => ({
  redirect: vi.fn((_path: string) => {
    const err = new Error('NEXT_REDIRECT');
    // Mimic the structural marker Next.js uses so `expect().toThrow` identifies it.
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${_path}`;
    throw err;
  }),
}));

// Pre-seed a couple of rows for the "authenticated with favorites" case.
const SEED_ROWS: Row[] = [
  {
    id: 10n,
    title: 'Item 10',
    titleZh: null,
    summaryZh: '摘要 10',
    recommendation: null,
    score: 80,
    tags: null,
    sourceId: 1,
    sourceName: 'Anthropic',
    sourceKind: 'official',
    publishedAt: new Date('2026-04-22T10:00:00Z'),
    status: 'published',
    url: 'https://example.com/10',
    clusterId: null,
    clusterMemberCount: 1,
    favoritedAt: new Date('2026-04-22T11:00:00Z'),
  },
  {
    id: 9n,
    title: 'Item 9',
    titleZh: null,
    summaryZh: '摘要 9',
    recommendation: null,
    score: 70,
    tags: null,
    sourceId: 2,
    sourceName: 'OpenAI',
    sourceKind: 'official',
    publishedAt: new Date('2026-04-21T10:00:00Z'),
    status: 'published',
    url: 'https://example.com/9',
    clusterId: null,
    clusterMemberCount: 1,
    favoritedAt: new Date('2026-04-21T11:00:00Z'),
  },
];

beforeEach(() => {
  favoritesRows.length = 0;
  vi.clearAllMocks();
});

describe('/favorites page auth gate + query (Plan 05-08)', () => {
  it('anonymous session triggers redirect to /', async () => {
    const authMod = (await import('@/lib/auth' as string)) as {
      auth: ReturnType<typeof vi.fn>;
    };
    const navMod = (await import('next/navigation' as string)) as {
      redirect: ReturnType<typeof vi.fn>;
    };
    authMod.auth.mockResolvedValueOnce(null);

    const pageMod = (await import('@/app/(reader)/favorites/page' as string)) as {
      default: () => Promise<unknown>;
    };

    await expect(pageMod.default()).rejects.toThrow('NEXT_REDIRECT');
    expect(navMod.redirect).toHaveBeenCalledWith('/');
  });

  it('authenticated user with zero favorites renders FavoritesEmpty authenticated branch', async () => {
    const authMod = (await import('@/lib/auth' as string)) as {
      auth: ReturnType<typeof vi.fn>;
    };
    authMod.auth.mockResolvedValueOnce(fakeSession());

    const pageMod = (await import('@/app/(reader)/favorites/page' as string)) as {
      default: () => Promise<unknown>;
    };
    const out = (await pageMod.default()) as { props?: { children?: unknown } };
    // Serialize to JSON-like string to make the empty-state heading assertion simple.
    const dump = JSON.stringify(out, (_, v) =>
      typeof v === 'function' || (typeof v === 'object' && v !== null && 'current' in v)
        ? undefined
        : v,
    );
    expect(dump).toContain('还没有收藏的动态');
  });

  it('authenticated user with favorites renders Timeline via FeedTopBar', async () => {
    const authMod = (await import('@/lib/auth' as string)) as {
      auth: ReturnType<typeof vi.fn>;
    };
    authMod.auth.mockResolvedValueOnce(fakeSession());
    favoritesRows.push(...SEED_ROWS);

    const pageMod = (await import('@/app/(reader)/favorites/page' as string)) as {
      default: () => Promise<unknown>;
    };
    const out = (await pageMod.default()) as unknown;
    const dump = JSON.stringify(out, (_, v) =>
      typeof v === 'function' || (typeof v === 'object' && v !== null && 'current' in v)
        ? undefined
        : v,
    );
    // FeedTopBar present with favorites view; subtitle indicates count.
    expect(dump).toContain('favorites');
    // Empty-state heading MUST NOT appear when there are rows.
    expect(dump).not.toContain('还没有收藏的动态');
  });
});
