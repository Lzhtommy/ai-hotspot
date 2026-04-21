import { describe, it, expect } from 'vitest';
import { runRefreshClusters, buildDebounceOpts } from './refresh';

// Mock db factory for refresh tests.
// Supports multiple execute() calls sequentially (dirty list, aggregate, primary, centroid, centroid UPDATE).
// Supports multiple update() calls (cluster update, clear is_primary, set is_primary).
function makeRefreshDbMock(opts: {
  dirtyClusters?: Array<{ cluster_id: string }>;
  aggRows?: Array<{ member_count: number; earliest_seen_at: string; latest_seen_at: string }>;
  primRows?: Array<{ id: string }>;
  centroidRows?: Array<{ centroid: string | null }>;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const executeCalls: Array<{ sql?: string; queryStr?: string }> = [];
  let executeCallIndex = 0;

  // Per-call execute response sequence:
  // call 0: dirty clusters list
  // call 1: aggregate (member_count / earliest / latest)
  // call 2: primary item id
  // call 3: centroid AVG
  // call 4+: centroid UPDATE (raw SQL)
  const executeResponses: Array<{ rows: unknown[] }> = [
    { rows: opts.dirtyClusters ?? [] },
    { rows: opts.aggRows ?? [{ member_count: 3, earliest_seen_at: '2026-04-18T00:00:00Z', latest_seen_at: '2026-04-20T00:00:00Z' }] },
    { rows: opts.primRows ?? [{ id: '10' }] },
    { rows: opts.centroidRows ?? [{ centroid: null }] },
    { rows: [] }, // centroid UPDATE if centroid present
  ];

  const db = {
    execute: async (_q: unknown) => {
      const resp = executeResponses[executeCallIndex] ?? { rows: [] };
      executeCallIndex += 1;
      return resp;
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updates.push(v);
        return {
          where: async () => {},
        };
      },
    }),
  };

  return { db, updates, getExecuteCallIndex: () => executeCallIndex };
}

describe('runRefreshClusters', () => {
  it('returns { updated: 0 } when no dirty clusters exist', async () => {
    const { db, updates } = makeRefreshDbMock({ dirtyClusters: [] });
    const result = await runRefreshClusters({ db: db as never });
    expect(result).toEqual({ updated: 0 });
    expect(updates).toHaveLength(0);
  });

  it('updates one dirty cluster with member_count, primary, earliest, latest', async () => {
    const { db, updates } = makeRefreshDbMock({
      dirtyClusters: [{ cluster_id: '5' }],
      aggRows: [{ member_count: 3, earliest_seen_at: '2026-04-18T00:00:00Z', latest_seen_at: '2026-04-20T00:00:00Z' }],
      primRows: [{ id: '10' }],
      centroidRows: [{ centroid: null }],
    });
    const result = await runRefreshClusters({
      db: db as never,
      now: () => new Date('2026-04-21T00:00:00Z'),
    });
    expect(result).toEqual({ updated: 1 });
    // Expect: 1 cluster update + 2 items updates (clear all is_primary, then set new primary)
    expect(updates).toHaveLength(3);
    // First update: cluster aggregate fields
    expect(updates[0]).toMatchObject({ memberCount: 3, primaryItemId: BigInt(10) });
    expect(updates[0].updatedAt).toBeInstanceOf(Date);
    // Second update: clear is_cluster_primary on all cluster members
    expect(updates[1]).toMatchObject({ isClusterPrimary: false });
    // Third update: set is_cluster_primary on new primary
    expect(updates[2]).toMatchObject({ isClusterPrimary: true });
  });

  it('handles centroid update when centroid string is provided', async () => {
    const { db, updates, getExecuteCallIndex } = makeRefreshDbMock({
      dirtyClusters: [{ cluster_id: '7' }],
      aggRows: [{ member_count: 2, earliest_seen_at: '2026-04-18T00:00:00Z', latest_seen_at: '2026-04-20T00:00:00Z' }],
      primRows: [{ id: '20' }],
      centroidRows: [{ centroid: '[0.1,0.2,0.3]' }],
    });
    const result = await runRefreshClusters({ db: db as never, now: () => new Date() });
    expect(result).toEqual({ updated: 1 });
    // Execute call index 5 means centroid UPDATE SQL was also called (4 selects + 1 update SQL)
    expect(getExecuteCallIndex()).toBe(5);
    // 3 updates: cluster SET, clear is_primary, set is_primary
    expect(updates).toHaveLength(3);
  });

  it('skips cluster update when aggregate returns zero member_count', async () => {
    const { db, updates } = makeRefreshDbMock({
      dirtyClusters: [{ cluster_id: '9' }],
      aggRows: [{ member_count: 0, earliest_seen_at: '2026-04-18T00:00:00Z', latest_seen_at: '2026-04-20T00:00:00Z' }],
      primRows: [],
      centroidRows: [{ centroid: null }],
    });
    const result = await runRefreshClusters({ db: db as never, now: () => new Date() });
    // defensive continue — cluster with 0 members is skipped
    expect(result).toEqual({ updated: 0 });
    expect(updates).toHaveLength(0);
  });

  it('skips cluster when primary query returns no rows', async () => {
    const { db, updates } = makeRefreshDbMock({
      dirtyClusters: [{ cluster_id: '11' }],
      aggRows: [{ member_count: 2, earliest_seen_at: '2026-04-18T00:00:00Z', latest_seen_at: '2026-04-20T00:00:00Z' }],
      primRows: [],
      centroidRows: [{ centroid: null }],
    });
    const result = await runRefreshClusters({ db: db as never, now: () => new Date() });
    expect(result).toEqual({ updated: 0 });
    expect(updates).toHaveLength(0);
  });
});

describe('buildDebounceOpts', () => {
  it('returns exactly { key: "refresh-clusters", delay: "60s" }', () => {
    expect(buildDebounceOpts()).toEqual({ key: 'refresh-clusters', delay: '60s' });
  });
});
