import { describe, it, expect } from 'vitest';
import { getClusterThreshold, DEFAULT_THRESHOLD } from './threshold';

// Mock db factory for threshold tests — only needs .select() chain
function makeDbMock(returnRows: Array<{ value: string }>) {
  const selectChain = {
    from: () => selectChain,
    where: () => Promise.resolve(returnRows),
  };
  return { db: { select: () => selectChain } };
}

describe('getClusterThreshold', () => {
  it('returns DEFAULT_THRESHOLD when no row exists', async () => {
    const { db } = makeDbMock([]);
    const t = await getClusterThreshold({ db: db as never });
    expect(t).toBe(0.82);
    expect(t).toBe(DEFAULT_THRESHOLD);
  });

  it('returns parsed float from settings row', async () => {
    const { db } = makeDbMock([{ value: '0.90' }]);
    expect(await getClusterThreshold({ db: db as never })).toBe(0.9);
  });

  it('falls back to default on non-parseable value', async () => {
    const { db } = makeDbMock([{ value: 'not-a-number' }]);
    expect(await getClusterThreshold({ db: db as never })).toBe(DEFAULT_THRESHOLD);
  });

  it('returns 0.82 specifically when seeded value is 0.82 (CLUST-04 migration default)', async () => {
    const { db } = makeDbMock([{ value: '0.82' }]);
    expect(await getClusterThreshold({ db: db as never })).toBe(0.82);
  });
});
