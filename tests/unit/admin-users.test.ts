/**
 * Plan 06-03 Task 1 — unit tests for src/lib/admin/users-repo.ts.
 *
 * Covers listUsersForAdmin + banUserCore + unbanUserCore with an injected
 * Drizzle-shaped mock db so no live Neon round-trip is needed. The critical
 * behavior — banUserCore runs UPDATE users AND DELETE sessions inside the
 * SAME db.transaction — is asserted by recording call order on a shared
 * transaction-level spy.
 *
 * Threat coverage: T-6-30 (SelfBanError), T-6-32/T-6-33 (atomic flip + delete).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The repo imports the real `db` client at top-level. We don't want that client
// to even try to instantiate a Pool in tests (requires DATABASE_URL). Mock it
// with a bare object; every test call injects its own `deps.db` anyway.
vi.mock('@/lib/db/client', () => ({
  db: { __sentinel: 'real-db-should-not-be-used-in-these-tests' },
}));

import {
  listUsersForAdmin,
  banUserCore,
  unbanUserCore,
  SelfBanError,
  UserNotFoundError,
} from '@/lib/admin/users-repo';
import type { db as realDb } from '@/lib/db/client';

/** Structural alias for the injected `db` — matches the repo's DbLike. */
type MockDb = typeof realDb;

/** Construct a fake Drizzle-shaped tx that records which ops were invoked. */
function makeTxSpy(options: { updateReturning?: Array<{ id: string }> } = {}) {
  const updateReturning = options.updateReturning ?? [{ id: 'target-uuid' }];
  const calls: string[] = [];

  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          calls.push('update');
          return updateReturning;
        }),
      })),
    })),
  }));

  const del = vi.fn(() => ({
    where: vi.fn(async () => {
      calls.push('delete');
      return undefined;
    }),
  }));

  const tx = { update, delete: del };
  return { tx, calls };
}

describe('listUsersForAdmin', () => {
  it('returns typed rows with providers aggregated from accounts LEFT JOIN', async () => {
    const rowsFromDb = [
      {
        id: 'u1',
        email: 'alice@test',
        name: 'Alice',
        role: 'user',
        is_banned: false,
        banned_at: null,
        banned_by: null,
        created_at: new Date('2026-04-01T00:00:00Z').toISOString(),
        providers: ['github', 'google'],
      },
      {
        id: 'u2',
        email: 'bob@test',
        name: null,
        role: 'admin',
        is_banned: true,
        banned_at: new Date('2026-04-10T00:00:00Z').toISOString(),
        banned_by: 'admin-id',
        created_at: new Date('2026-03-01T00:00:00Z').toISOString(),
        providers: [],
      },
    ];

    const execute = vi.fn(async () => ({ rows: rowsFromDb }));
    const db = { execute } as unknown as MockDb;

    const result = await listUsersForAdmin({ db });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'u1',
      email: 'alice@test',
      name: 'Alice',
      role: 'user',
      isBanned: false,
      bannedAt: null,
      bannedBy: null,
      providers: ['github', 'google'],
    });
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[1]).toMatchObject({
      id: 'u2',
      name: null,
      role: 'admin',
      isBanned: true,
      bannedBy: 'admin-id',
      providers: [],
    });
    expect(result[1].bannedAt).toBeInstanceOf(Date);
  });
});

describe('banUserCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws SelfBanError when targetUserId === adminUserId', async () => {
    const transaction = vi.fn();
    const db = { transaction } as unknown as MockDb;

    await expect(
      banUserCore({ targetUserId: 'same', adminUserId: 'same' }, { db }),
    ).rejects.toBeInstanceOf(SelfBanError);

    // Transaction MUST NOT have been opened for a self-ban.
    expect(transaction).not.toHaveBeenCalled();
  });

  it('runs UPDATE users THEN DELETE sessions inside a single transaction', async () => {
    const { tx, calls } = makeTxSpy();
    const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => {
      await fn(tx);
    });
    const db = { transaction } as unknown as MockDb;

    await banUserCore({ targetUserId: 'target', adminUserId: 'admin' }, { db });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['update', 'delete']);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
  });

  it('throws UserNotFoundError and skips sessions delete when update returns no rows', async () => {
    const { tx, calls } = makeTxSpy({ updateReturning: [] });
    const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => {
      await fn(tx);
    });
    const db = { transaction } as unknown as MockDb;

    await expect(
      banUserCore({ targetUserId: 'ghost', adminUserId: 'admin' }, { db }),
    ).rejects.toBeInstanceOf(UserNotFoundError);

    // UPDATE ran (to learn the user is missing) but DELETE must not have.
    expect(calls).toEqual(['update']);
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe('unbanUserCore', () => {
  it('clears is_banned + banned_at + banned_by (no sessions touched)', async () => {
    let setPayload: Record<string, unknown> | undefined;

    const update = vi.fn(() => ({
      set: vi.fn((payload: Record<string, unknown>) => {
        setPayload = payload;
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    }));
    const del = vi.fn();

    const db = { update, delete: del } as unknown as MockDb;

    await unbanUserCore({ targetUserId: 'target' }, { db });

    expect(update).toHaveBeenCalledTimes(1);
    expect(setPayload).toEqual({
      isBanned: false,
      bannedAt: null,
      bannedBy: null,
    });
    // unban MUST NOT delete sessions (integration-test assertion parity).
    expect(del).not.toHaveBeenCalled();
  });
});
