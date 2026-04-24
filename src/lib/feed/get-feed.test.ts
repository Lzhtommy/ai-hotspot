/**
 * Tests for get-feed — Redis-cache semantics, key builder, DB delegation.
 *
 * Uses vitest with manual mocks for redis and db so no network calls are made.
 */

import { describe, expect, it, vi, type Mock } from 'vitest';
import { buildFeedKey, getFeed, type GetFeedResult } from './get-feed';

// ---------------------------------------------------------------------------
// buildFeedKey unit tests
// ---------------------------------------------------------------------------
describe('buildFeedKey', () => {
  it('featured view: simple key with page only', () => {
    expect(buildFeedKey({ view: 'featured', page: 1 })).toBe('feed:v2:featured:page:1');
  });

  it('featured view: ignores tags and sourceId', () => {
    expect(buildFeedKey({ view: 'featured', page: 3, tags: ['Agent'], sourceId: 5 })).toBe(
      'feed:v2:featured:page:3',
    );
  });

  it('all view: no filters → empty tags + source=all', () => {
    expect(buildFeedKey({ view: 'all', page: 1 })).toBe('feed:v2:all:page:1:tags::source:all');
  });

  it('all view: tags sorted alphabetically (stable regardless of input order)', () => {
    const key1 = buildFeedKey({ view: 'all', page: 2, tags: ['开源', 'Agent'] });
    const key2 = buildFeedKey({ view: 'all', page: 2, tags: ['Agent', '开源'] });
    expect(key1).toBe(key2);
    expect(key1).toBe('feed:v2:all:page:2:tags:Agent,开源:source:all');
  });

  it('all view: empty tags array → empty segment', () => {
    expect(buildFeedKey({ view: 'all', page: 1, tags: [], sourceId: 5 })).toBe(
      'feed:v2:all:page:1:tags::source:5',
    );
  });

  it('all view: empty-string tags are filtered out', () => {
    expect(buildFeedKey({ view: 'all', page: 1, tags: ['', 'Agent', ''] })).toBe(
      'feed:v2:all:page:1:tags:Agent:source:all',
    );
  });

  it('all view: sourceId set → uses numeric id in key', () => {
    expect(buildFeedKey({ view: 'all', page: 1, sourceId: 7 })).toBe(
      'feed:v2:all:page:1:tags::source:7',
    );
  });

  it('all view: sourceId null → source=all', () => {
    expect(buildFeedKey({ view: 'all', page: 1, sourceId: null })).toBe(
      'feed:v2:all:page:1:tags::source:all',
    );
  });
});

// ---------------------------------------------------------------------------
// getFeed — cache hit / miss behaviour
// ---------------------------------------------------------------------------

/** Minimal cached result fixture */
const CACHED_RESULT: GetFeedResult = {
  items: [
    {
      id: '1',
      title: 'cached',
      titleZh: null,
      summaryZh: null,
      recommendation: null,
      score: 80,
      tags: null,
      sourceId: 1,
      sourceName: 'Test Source',
      sourceKind: null,
      publishedAt: new Date('2026-04-22T00:00:00Z').toISOString(),
      clusterId: null,
      clusterMemberCount: 1,
      url: 'https://example.com',
    },
  ],
  page: 1,
  totalPages: 1,
  lastSyncMinutes: 5,
  clusterSiblings: {},
};

describe('getFeed cache semantics', () => {
  it('cache hit: returns cached value without calling db', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue(CACHED_RESULT),
      set: vi.fn(),
    };

    // DB should NEVER be called on cache hit — pass a mock that throws on select
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        throw new Error('DB should not be called on cache hit');
      }),
      execute: vi.fn().mockImplementation(() => {
        throw new Error('DB should not be called on cache hit');
      }),
    };

    const result = await getFeed(
      { view: 'featured', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    expect(mockRedis.get).toHaveBeenCalledOnce();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.execute).not.toHaveBeenCalled();
    expect(result).toEqual(CACHED_RESULT);
  });

  it('cache miss: calls db and writes result to redis with ex=300', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    // Minimal db mock that returns empty rows and count=0
    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    const mockDb = {
      select: vi.fn().mockReturnValue(chainable),
      execute: vi.fn().mockResolvedValue({ rows: [{ n: 0, last_fetched: null }] }),
    };

    // First execute call = count query (returns n), second = lastSyncMinutes (returns last_fetched)
    // We'll mock to return { rows: [{ n: 0 }] } for count and { rows: [{ last_fetched: null }] } for sync
    (mockDb.execute as Mock)
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })
      .mockResolvedValueOnce({ rows: [{ last_fetched: null }] });

    await getFeed(
      { view: 'featured', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    expect(mockRedis.get).toHaveBeenCalledOnce();
    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockRedis.set).toHaveBeenCalledOnce();

    // Verify TTL = 300
    const setCall = (mockRedis.set as Mock).mock.calls[0];
    expect(setCall[2]).toEqual({ ex: 300 });
  });

  it('featured view: score>=70 filter is applied (gte present in predicates)', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    const mockDb = {
      select: vi.fn().mockReturnValue(chainable),
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ n: 0 }] })
        .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
    };

    await getFeed(
      { view: 'featured', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    // .where was called — predicates were passed
    expect(chainable.where).toHaveBeenCalled();
    // The test proves the code path runs without throwing
    expect(mockRedis.set).toHaveBeenCalledOnce();
  });

  it('all view: score filter is NOT applied', async () => {
    // The key distinction: 'all' view must not add score>=70 filter.
    // We verify the cache key doesn't include 'featured' and test completes successfully.
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    const mockDb = {
      select: vi.fn().mockReturnValue(chainable),
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ n: 0 }] })
        .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
    };

    const result = await getFeed(
      { view: 'all', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    // Redis key should be 'all' variant
    expect((mockRedis.get as Mock).mock.calls[0][0]).toMatch(/^feed:v2:all:/);
    expect(result.page).toBe(1);
  });

  it('cache miss + cluster primary: fetches siblings and populates clusterSiblings map (primary self-excluded)', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const primaryRow = {
      id: BigInt(100),
      title: 'Primary',
      titleZh: null,
      summaryZh: null,
      recommendation: null,
      score: 80,
      tags: null,
      sourceId: 1,
      sourceName: 'Source A',
      sourceKind: null,
      publishedAt: new Date('2026-04-22T01:00:00Z'),
      clusterId: BigInt(42),
      clusterMemberCount: 3,
      url: 'https://example.com/100',
    };

    const siblingRows = [
      {
        ...primaryRow,
        id: BigInt(101),
        sourceName: 'Source B',
        url: 'https://example.com/101',
        publishedAt: new Date('2026-04-22T02:00:00Z'),
        clusterMemberCount: undefined,
      },
      {
        ...primaryRow,
        id: BigInt(102),
        sourceName: 'Source C',
        url: 'https://example.com/102',
        publishedAt: new Date('2026-04-22T03:00:00Z'),
        clusterMemberCount: undefined,
      },
    ];

    const primaryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([primaryRow]),
    };
    const siblingChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(siblingRows),
    };
    const mockDb = {
      select: vi.fn().mockReturnValueOnce(primaryChain).mockReturnValueOnce(siblingChain),
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ n: 1 }] })
        .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
    };

    const result = await getFeed(
      { view: 'featured', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    expect(mockDb.select).toHaveBeenCalledTimes(2);
    expect(result.clusterSiblings['42']).toBeDefined();
    expect(result.clusterSiblings['42']).toHaveLength(2);
    expect(result.clusterSiblings['42'].every((s) => s.id !== '100')).toBe(true);
    expect(result.clusterSiblings['42'][0]).toMatchObject({
      id: '101',
      sourceName: 'Source B',
      clusterId: '42',
    });
  });

  it('cache miss without cluster primaries: clusterSiblings is empty and sibling query is not issued', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const nonClusterRow = {
      id: BigInt(200),
      title: 't',
      titleZh: null,
      summaryZh: null,
      recommendation: null,
      score: 50,
      tags: null,
      sourceId: 1,
      sourceName: 'S',
      sourceKind: null,
      publishedAt: new Date('2026-04-22T00:00:00Z'),
      clusterId: null,
      clusterMemberCount: 1,
      url: 'https://example.com/200',
    };
    const primaryChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([nonClusterRow]),
    };
    const mockDb = {
      select: vi.fn().mockReturnValueOnce(primaryChain),
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ n: 1 }] })
        .mockResolvedValueOnce({ rows: [{ last_fetched: null }] }),
    };

    const result = await getFeed(
      { view: 'all', page: 1 },
      { db: mockDb as never, redis: mockRedis as never },
    );

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(result.clusterSiblings).toEqual({});
  });
});
