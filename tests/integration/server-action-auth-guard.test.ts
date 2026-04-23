// Task 5-06-01 | Plan 05-06 | REQ-AUTH-07 | Threat T-5-03, T-5-06
//
// Asserts requireLiveUserCore enforces D-05 Layer 2 ban guard deterministically.
// Pure deps-injected function: tests pass a mock db + session directly — no
// network, no DATABASE_URL dependency.
import { describe, it, expect, vi } from 'vitest';

describe('requireLiveUserCore (D-05 Layer 2)', () => {
  it('throws AuthError{UNAUTHENTICATED} when session is null', async () => {
    const mod = await import('@/lib/user-actions/auth-guard');
    await expect(mod.requireLiveUserCore(null)).rejects.toMatchObject({
      name: 'AuthError',
      code: 'UNAUTHENTICATED',
    });
  });

  it('throws AuthError{UNAUTHENTICATED} when session has no user.id', async () => {
    const mod = await import('@/lib/user-actions/auth-guard');
    await expect(
      mod.requireLiveUserCore({ expires: 'x', user: {} } as unknown as Parameters<
        typeof mod.requireLiveUserCore
      >[0]),
    ).rejects.toMatchObject({ name: 'AuthError', code: 'UNAUTHENTICATED' });
  });

  it('throws AuthError{FORBIDDEN} when db returns is_banned=true', async () => {
    const mod = await import('@/lib/user-actions/auth-guard');
    const select = vi.fn().mockReturnThis();
    const from = vi.fn().mockReturnThis();
    const where = vi.fn().mockResolvedValue([{ isBanned: true }]);
    const mockDb = { select, from, where } as unknown as Parameters<
      typeof mod.requireLiveUserCore
    >[1] extends { db?: infer D } | undefined
      ? D
      : never;

    await expect(
      mod.requireLiveUserCore(
        { user: { id: 'u1' }, expires: 'x' } as unknown as Parameters<
          typeof mod.requireLiveUserCore
        >[0],
        { db: mockDb },
      ),
    ).rejects.toMatchObject({ name: 'AuthError', code: 'FORBIDDEN' });

    expect(select).toHaveBeenCalledOnce();
  });

  it('throws AuthError{FORBIDDEN} when user row does not exist (defensive)', async () => {
    const mod = await import('@/lib/user-actions/auth-guard');
    const select = vi.fn().mockReturnThis();
    const from = vi.fn().mockReturnThis();
    const where = vi.fn().mockResolvedValue([]);
    const mockDb = { select, from, where } as unknown as Parameters<
      typeof mod.requireLiveUserCore
    >[1] extends { db?: infer D } | undefined
      ? D
      : never;

    await expect(
      mod.requireLiveUserCore(
        { user: { id: 'u1' }, expires: 'x' } as unknown as Parameters<
          typeof mod.requireLiveUserCore
        >[0],
        { db: mockDb },
      ),
    ).rejects.toMatchObject({ name: 'AuthError', code: 'FORBIDDEN' });
  });

  it('returns session.user.id when user is live (not banned)', async () => {
    const mod = await import('@/lib/user-actions/auth-guard');
    const select = vi.fn().mockReturnThis();
    const from = vi.fn().mockReturnThis();
    const where = vi.fn().mockResolvedValue([{ isBanned: false }]);
    const mockDb = { select, from, where } as unknown as Parameters<
      typeof mod.requireLiveUserCore
    >[1] extends { db?: infer D } | undefined
      ? D
      : never;

    const userId = await mod.requireLiveUserCore(
      { user: { id: 'u1' }, expires: 'x' } as unknown as Parameters<
        typeof mod.requireLiveUserCore
      >[0],
      { db: mockDb },
    );
    expect(userId).toBe('u1');
  });
});
