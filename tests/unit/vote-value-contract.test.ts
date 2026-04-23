// Task 5-07-03 | Plan 05-07 | REQ-VOTE-04
// Nyquist stub — red until implementation lands.
//
// Asserts the vote server action rejects values outside {-1, +1} (VOTE-04 contract).
import { describe, it, expect } from 'vitest';

describe('vote value contract', () => {
  it('TODO[5-07-03]: voteItem rejects values outside {-1, +1}', async () => {
    const mod = (await import('@/server/actions/votes' as string)) as {
      voteItem: (args: { itemId: string; value: number }) => Promise<unknown>;
    };
    await expect(mod.voteItem({ itemId: '1', value: 2 })).rejects.toThrow();
    await expect(mod.voteItem({ itemId: '1', value: 0 })).rejects.toThrow();
    await expect(mod.voteItem({ itemId: '1', value: -2 })).rejects.toThrow();
  });
});
