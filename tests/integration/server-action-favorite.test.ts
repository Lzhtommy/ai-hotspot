// Task 5-06-01 | Plan 05-06 | REQ-FAV-01, REQ-FAV-02 | Threat T-5-08
//
// Asserts favoriteItemCore / unfavoriteItemCore do the right Drizzle calls
// against a mock db. Pure deps-injected cores — no real DB, no auth mocking.
import { describe, it, expect, vi } from 'vitest';

describe('favoriteItemCore / unfavoriteItemCore (D-11)', () => {
  it('favoriteItemCore inserts favorites row with ON CONFLICT DO NOTHING; returns {favorited: true}', async () => {
    const mod = await import('@/lib/user-actions/favorites-core');

    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const mockDb = { insert } as unknown as Parameters<typeof mod.favoriteItemCore>[1] extends
      | { db?: infer D }
      | undefined
      ? D
      : never;

    const result = await mod.favoriteItemCore(
      { userId: 'u1', itemId: 42n },
      { db: mockDb },
    );

    expect(result).toEqual({ favorited: true });
    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith({ userId: 'u1', itemId: 42n });
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('unfavoriteItemCore deletes favorites row matching (userId, itemId); returns {favorited: false}', async () => {
    const mod = await import('@/lib/user-actions/favorites-core');

    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where });
    const mockDb = { delete: del } as unknown as Parameters<
      typeof mod.favoriteItemCore
    >[1] extends { db?: infer D } | undefined
      ? D
      : never;

    const result = await mod.unfavoriteItemCore(
      { userId: 'u1', itemId: 42n },
      { db: mockDb },
    );

    expect(result).toEqual({ favorited: false });
    expect(del).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
  });
});
