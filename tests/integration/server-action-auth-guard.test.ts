// Task 5-06-03 | Plan 05-06 | REQ-AUTH-07
// Nyquist stub — red until implementation lands.
//
// Asserts server actions reject (not crash) when called without a session.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth' as string, () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

describe('server-action auth guard', () => {
  it('TODO[5-06-03]: favoriteItem rejects with UNAUTHENTICATED when no session', async () => {
    const mod = (await import('@/server/actions/favorites' as string)) as {
      favoriteItem: (args: { itemId: string }) => Promise<unknown>;
    };
    await expect(mod.favoriteItem({ itemId: '1' })).rejects.toThrow(/UNAUTH/i);
  });

  it('TODO[5-06-03]: voteItem rejects with UNAUTHENTICATED when no session', async () => {
    const mod = (await import('@/server/actions/votes' as string)) as {
      voteItem: (args: { itemId: string; value: 1 | -1 }) => Promise<unknown>;
    };
    await expect(mod.voteItem({ itemId: '1', value: 1 })).rejects.toThrow(/UNAUTH/i);
  });
});
