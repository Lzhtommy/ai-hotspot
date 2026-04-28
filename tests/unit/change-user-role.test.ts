import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: { __sentinel: 'real-db-should-not-be-used-in-these-tests' },
}));

import { changeUserRoleCore, SelfRoleChangeError, UserNotFoundError } from '@/lib/admin/users-repo';
import type { db as realDb } from '@/lib/db/client';

type MockDb = typeof realDb;

function makeUpdateSpy(returning: Array<{ id: string }>) {
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => returning),
      })),
    })),
  }));
  return { update } as unknown as MockDb;
}

describe('changeUserRoleCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws SelfRoleChangeError when targetUserId === adminUserId', async () => {
    const db = makeUpdateSpy([]);

    await expect(
      changeUserRoleCore(
        { targetUserId: 'same-id', adminUserId: 'same-id', newRole: 'admin' },
        { db },
      ),
    ).rejects.toBeInstanceOf(SelfRoleChangeError);

    expect(db.update).not.toHaveBeenCalled();
  });

  it('succeeds when db returns the updated row', async () => {
    const db = makeUpdateSpy([{ id: 'target-id' }]);

    await expect(
      changeUserRoleCore(
        { targetUserId: 'target-id', adminUserId: 'admin-id', newRole: 'admin' },
        { db },
      ),
    ).resolves.toBeUndefined();

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('throws UserNotFoundError when db returns empty array', async () => {
    const db = makeUpdateSpy([]);

    await expect(
      changeUserRoleCore(
        { targetUserId: 'ghost-id', adminUserId: 'admin-id', newRole: 'user' },
        { db },
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
