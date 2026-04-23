// Task 5-06-01 | Plan 05-06 | REQ-FAV-01, REQ-FAV-02 | Threat T-5-08
// Nyquist stub — red until implementation lands.
//
// Asserts the favorite server action toggles the favorites row (insert on first
// click, delete on second) and rejects when users.is_banned = true (D-11, D-05 L2).
import { describe, it, expect, vi } from 'vitest';
import { fakeSession } from '../helpers/auth';

vi.mock('@/lib/auth' as string, () => ({
  auth: vi.fn().mockResolvedValue(fakeSession()),
}));

describe('favoriteItem server action', () => {
  it('TODO[5-06-01]: first call inserts favorites row, second call removes it', async () => {
    const mod = (await import('@/server/actions/favorites' as string)) as {
      favoriteItem: (args: { itemId: string }) => Promise<{ favorited: boolean }>;
    };
    const first = await mod.favoriteItem({ itemId: '1' });
    expect(first.favorited).toBe(true);
    const second = await mod.favoriteItem({ itemId: '1' });
    expect(second.favorited).toBe(false);
  });

  it('TODO[5-06-01]: rejects when user is banned (D-05 Layer 2)', async () => {
    const mod = (await import('@/server/actions/favorites' as string)) as {
      favoriteItem: (args: { itemId: string }) => Promise<unknown>;
    };
    // Mock auth() to return a session whose user lookup will find is_banned=true.
    await expect(mod.favoriteItem({ itemId: '1' })).rejects.toThrow(/FORBIDDEN|ban/i);
  });
});
