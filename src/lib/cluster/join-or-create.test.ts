import { describe, it, expect } from 'vitest';
import { joinOrCreateCluster } from './join-or-create';

// Factory that creates a mock transaction (tx) and wraps it in a db with transaction().
function makeTxMock(opts: {
  nearestRow?: { id: string; cluster_id: string; cosine_similarity: number } | null;
  returningCluster?: { id: bigint };
  threshold?: number;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const executeCalls: Array<unknown> = [];

  const tx = {
    execute: async (q: unknown) => {
      executeCalls.push(q);
      return { rows: opts.nearestRow != null ? [opts.nearestRow] : [] };
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updates.push(v);
        return { where: async () => {} };
      },
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserts.push(v);
        return {
          returning: async () => [opts.returningCluster ?? { id: BigInt(999) }],
        };
      },
    }),
  };

  const db = {
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  };

  return { db, tx, inserts, updates, executeCalls };
}

const baseParams = {
  itemId: BigInt(42),
  embedding: [0.1, 0.2, 0.3],
  publishedAt: new Date('2026-04-20T12:00:00Z'),
};

describe('joinOrCreateCluster', () => {
  it('joins existing cluster when nearest row cosine >= threshold (happy join)', async () => {
    const { db, inserts, updates } = makeTxMock({
      nearestRow: { id: '100', cluster_id: '77', cosine_similarity: 0.9 },
    });
    const result = await joinOrCreateCluster({
      ...baseParams,
      deps: {
        db: db as never,
        getThreshold: async () => 0.82,
      },
    });
    expect(result).toEqual({ clusterId: BigInt(77), joined: true });
    expect(updates).toHaveLength(1);
    expect(inserts).toHaveLength(0); // no cluster inserted
  });

  it('creates new cluster when nearest cosine is below threshold', async () => {
    const { db, inserts, updates } = makeTxMock({
      nearestRow: { id: '100', cluster_id: '77', cosine_similarity: 0.5 },
      returningCluster: { id: BigInt(555) },
    });
    const result = await joinOrCreateCluster({
      ...baseParams,
      deps: {
        db: db as never,
        getThreshold: async () => 0.82,
      },
    });
    expect(result).toEqual({ clusterId: BigInt(555), joined: false });
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ isClusterPrimary: true });
  });

  it('creates new cluster when no nearest row found', async () => {
    const { db, inserts, updates } = makeTxMock({
      nearestRow: null,
      returningCluster: { id: BigInt(888) },
    });
    const result = await joinOrCreateCluster({
      ...baseParams,
      deps: {
        db: db as never,
        getThreshold: async () => 0.82,
      },
    });
    expect(result).toEqual({ clusterId: BigInt(888), joined: false });
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });

  it('joins when cosine exactly equals threshold (inclusive boundary — CLUST-05)', async () => {
    const { db, inserts, updates } = makeTxMock({
      nearestRow: { id: '100', cluster_id: '77', cosine_similarity: 0.82 },
    });
    const result = await joinOrCreateCluster({
      ...baseParams,
      deps: {
        db: db as never,
        getThreshold: async () => 0.82,
      },
    });
    expect(result.joined).toBe(true);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
  });

  it('respects custom threshold injected via getThreshold dep — cosine 0.85 below 0.95 → creates new', async () => {
    const { db, inserts, updates } = makeTxMock({
      nearestRow: { id: '100', cluster_id: '77', cosine_similarity: 0.85 },
      returningCluster: { id: BigInt(333) },
    });
    const result = await joinOrCreateCluster({
      ...baseParams,
      deps: {
        db: db as never,
        getThreshold: async () => 0.95, // custom high threshold
      },
    });
    expect(result.joined).toBe(false);
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });

  it('new cluster payload shape includes all required fields', async () => {
    const publishedAt = new Date('2026-04-20T12:00:00Z');
    const embedding = [0.1, 0.2, 0.3];
    const itemId = BigInt(42);
    const { db, inserts } = makeTxMock({
      nearestRow: null,
      returningCluster: { id: BigInt(999) },
    });
    await joinOrCreateCluster({
      itemId,
      embedding,
      publishedAt,
      deps: {
        db: db as never,
        getThreshold: async () => 0.82,
      },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      primaryItemId: itemId,
      memberCount: 1,
      centroid: embedding,
      earliestSeenAt: publishedAt,
      latestSeenAt: publishedAt,
    });
  });
});
