import { describe, it, expect, vi } from 'vitest';
import { processPending, claimPendingItems } from './process-pending';
import * as barrel from './index';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
  },
}));

describe('processPending task', () => {
  it('has id "process-pending"', () => {
    expect((processPending as unknown as { id: string }).id).toBe('process-pending');
  });

  it('is exported from src/trigger/index.ts barrel', () => {
    expect((barrel as unknown as { processPending?: unknown }).processPending).toBeDefined();
  });
});

describe('claimPendingItems', () => {
  function makeDbMock(returningIds: string[]) {
    return {
      execute: vi.fn().mockResolvedValue({ rows: returningIds.map((id) => ({ id })) }),
    };
  }

  it('returns the list of claimed ids', async () => {
    const db = makeDbMock(['1', '2', '3']);
    const ids = await claimPendingItems({ db: db as never });
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('returns [] when no rows match', async () => {
    const db = makeDbMock([]);
    expect(await claimPendingItems({ db: db as never })).toEqual([]);
  });

  it('passes the FOR UPDATE SKIP LOCKED SQL to db.execute', async () => {
    const db = makeDbMock([]);
    await claimPendingItems({ db: db as never });
    const sqlArg = db.execute.mock.calls[0][0];
    // Drizzle sql template renders to an object with queryChunks — stringify for assertion.
    const rendered = JSON.stringify(sqlArg);
    expect(rendered).toContain('FOR UPDATE SKIP LOCKED');
    expect(rendered).toContain("status = 'pending'");
  });

  it("passes status = 'processing' in the UPDATE SET clause", async () => {
    const db = makeDbMock([]);
    await claimPendingItems({ db: db as never });
    const sqlArg = db.execute.mock.calls[0][0];
    const rendered = JSON.stringify(sqlArg);
    expect(rendered).toContain("status = 'processing'");
  });

  it('honors injected batchSize', async () => {
    const db = makeDbMock([]);
    await claimPendingItems({ db: db as never, batchSize: 5 });
    const rendered = JSON.stringify(db.execute.mock.calls[0][0]);
    // The size is embedded in a queryChunk value — verify it appears in the serialised SQL.
    expect(rendered).toContain('5');
  });
});
