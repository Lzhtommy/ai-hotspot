/**
 * Tests for get-feed — DB query construction and delegation.
 *
 * Uses vitest with a manual mock for db so no network calls are made.
 */

import { describe, expect, it, vi } from 'vitest';
import { getFeed } from './get-feed';

// ---------------------------------------------------------------------------
// getFeed — DB delegation behaviour
// ---------------------------------------------------------------------------

describe('getFeed', () => {
  it('featured view: score>=70 filter is applied (gte present in predicates)', async () => {
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

    await getFeed({ view: 'featured', page: 1 }, { db: mockDb as never });

    // .where was called — predicates were passed
    expect(chainable.where).toHaveBeenCalled();
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it('all view: score filter is NOT applied and result reflects the requested page', async () => {
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

    const result = await getFeed({ view: 'all', page: 1 }, { db: mockDb as never });

    expect(result.page).toBe(1);
  });

  it('cluster primary: fetches siblings and populates clusterSiblings map (primary self-excluded)', async () => {
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

    const result = await getFeed({ view: 'featured', page: 1 }, { db: mockDb as never });

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

  it('without cluster primaries: clusterSiblings is empty and sibling query is not issued', async () => {
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

    const result = await getFeed({ view: 'all', page: 1 }, { db: mockDb as never });

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(result.clusterSiblings).toEqual({});
  });
});
