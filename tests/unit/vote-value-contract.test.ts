// Task 5-06-02 | Plan 05-06 | REQ-VOTE-04
//
// Asserts voteItemCore rejects values outside {-1, +1} (VOTE-04 contract hardening).
// The rejection is synchronous-ish — validation runs before any DB call, so we
// can pass a mock db that throws if invoked to prove no DB contact happens.
import { describe, it, expect, vi } from 'vitest';

type MockDb = Parameters<typeof import('@/lib/user-actions/votes-core').voteItemCore>[1] extends
  | { db?: infer D }
  | undefined
  ? D
  : never;

const neverDb = {
  select: vi.fn().mockImplementation(() => {
    throw new Error('db.select should not be called for invalid vote values');
  }),
  insert: vi.fn().mockImplementation(() => {
    throw new Error('db.insert should not be called for invalid vote values');
  }),
  update: vi.fn().mockImplementation(() => {
    throw new Error('db.update should not be called for invalid vote values');
  }),
  delete: vi.fn().mockImplementation(() => {
    throw new Error('db.delete should not be called for invalid vote values');
  }),
} as unknown as MockDb;

describe('vote value contract (VOTE-04)', () => {
  it('rejects value=2', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    await expect(
      mod.voteItemCore(
        { userId: 'u1', itemId: BigInt(1), value: 2 as unknown as 1 },
        { db: neverDb },
      ),
    ).rejects.toMatchObject({ name: 'VoteValueError' });
  });

  it('rejects value=0', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    await expect(
      mod.voteItemCore(
        { userId: 'u1', itemId: BigInt(1), value: 0 as unknown as 1 },
        { db: neverDb },
      ),
    ).rejects.toMatchObject({ name: 'VoteValueError' });
  });

  it('rejects value=-2', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    await expect(
      mod.voteItemCore(
        { userId: 'u1', itemId: BigInt(1), value: -2 as unknown as 1 },
        { db: neverDb },
      ),
    ).rejects.toMatchObject({ name: 'VoteValueError' });
  });
});
