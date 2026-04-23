// Task 5-06-02 | Plan 05-06 | REQ-VOTE-01, REQ-VOTE-02 | Threat T-5-09
// Nyquist stub — red until implementation lands.
//
// Asserts vote server action enforces the D-12 exclusive 3-state toggle
// (+1 / -1 / delete) and rejects when users.is_banned = true.
import { describe, it, expect, vi } from 'vitest';
import { fakeSession } from '../helpers/auth';

vi.mock('@/lib/auth' as string, () => ({
  auth: vi.fn().mockResolvedValue(fakeSession()),
}));

describe('voteItem server action — D-12 state machine', () => {
  it('TODO[5-06-02]: like → like again deletes row', async () => {
    const mod = (await import('@/server/actions/votes' as string)) as {
      voteItem: (args: { itemId: string; value: 1 | -1 }) => Promise<{ vote: -1 | 0 | 1 }>;
    };
    const a = await mod.voteItem({ itemId: '1', value: 1 });
    expect(a.vote).toBe(1);
    const b = await mod.voteItem({ itemId: '1', value: 1 });
    expect(b.vote).toBe(0);
  });

  it('TODO[5-06-02]: like → dislike flips value without intermediate neutral', async () => {
    const mod = (await import('@/server/actions/votes' as string)) as {
      voteItem: (args: { itemId: string; value: 1 | -1 }) => Promise<{ vote: -1 | 0 | 1 }>;
    };
    const a = await mod.voteItem({ itemId: '1', value: 1 });
    expect(a.vote).toBe(1);
    const c = await mod.voteItem({ itemId: '1', value: -1 });
    expect(c.vote).toBe(-1);
  });

  it('TODO[5-06-02]: rejects banned user', async () => {
    const mod = (await import('@/server/actions/votes' as string)) as {
      voteItem: (args: { itemId: string; value: 1 | -1 }) => Promise<unknown>;
    };
    await expect(mod.voteItem({ itemId: '1', value: 1 })).rejects.toThrow(/FORBIDDEN|ban/i);
  });
});
