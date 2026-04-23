// Task 5-06-03 | Plan 05-06 | REQ-FAV-01, REQ-FAV-02
//
// Adapter smoke test — proves src/server/actions/favorites.ts threads
// session.user.id into favoriteItemCore and wraps the BigInt conversion.
// Full DB logic is covered by the favorites-core unit tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before the dynamic import of the adapter module.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'u1' }, expires: 'x' }),
}));

vi.mock('@/lib/user-actions/auth-guard', () => ({
  requireLiveUserCore: vi.fn().mockResolvedValue('u1'),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AuthError';
      this.code = code;
    }
  },
}));

const favoriteItemCore = vi.fn().mockResolvedValue({ favorited: true });
const unfavoriteItemCore = vi.fn().mockResolvedValue({ favorited: false });
vi.mock('@/lib/user-actions/favorites-core', () => ({
  favoriteItemCore,
  unfavoriteItemCore,
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath,
}));

describe('favorites server-action adapter', () => {
  beforeEach(() => {
    favoriteItemCore.mockClear();
    unfavoriteItemCore.mockClear();
    revalidatePath.mockClear();
  });

  it('favoriteItem wraps itemId to BigInt and threads userId from session → core', async () => {
    const mod = await import('@/server/actions/favorites');
    const result = await mod.favoriteItem('123');

    expect(result).toEqual({ favorited: true });
    expect(favoriteItemCore).toHaveBeenCalledWith({
      userId: 'u1',
      itemId: BigInt(123),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/favorites');
  });

  it('unfavoriteItem wraps itemId to BigInt, calls unfavoriteItemCore, and revalidates /favorites', async () => {
    const mod = await import('@/server/actions/favorites');
    const result = await mod.unfavoriteItem('123');

    expect(result).toEqual({ favorited: false });
    expect(unfavoriteItemCore).toHaveBeenCalledWith({
      userId: 'u1',
      itemId: BigInt(123),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/favorites');
  });
});
