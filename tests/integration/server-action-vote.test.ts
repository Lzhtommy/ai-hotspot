// Task 5-06-02 | Plan 05-06 | REQ-VOTE-01, REQ-VOTE-02 | Threat T-5-08
//
// Asserts voteItemCore implements the D-12 exclusive 3-state toggle state machine:
//   no row       + value=v  → insert(value=v)         → { vote: v }
//   row value=v  + value=v  → delete                  → { vote: 0 }
//   row value=v  + value=-v → update(value=-v)        → { vote: -v }
import { describe, it, expect, vi } from 'vitest';

type MockDb = Parameters<typeof import('@/lib/user-actions/votes-core').voteItemCore>[1] extends
  | { db?: infer D }
  | undefined
  ? D
  : never;

function makeSelectMock(resolveWith: Array<{ value: number }>) {
  const where = vi.fn().mockResolvedValue(resolveWith);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where };
}

describe('voteItemCore (D-12 exclusive 3-state toggle)', () => {
  it('no existing row + value=+1 → inserts row; returns {vote: 1}', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    const sel = makeSelectMock([]);
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const mockDb = { select: sel.select, insert } as unknown as MockDb;

    const result = await mod.voteItemCore(
      { userId: 'u1', itemId: BigInt(42), value: 1 },
      { db: mockDb },
    );

    expect(result).toEqual({ vote: 1 });
    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith({
      userId: 'u1',
      itemId: BigInt(42),
      value: 1,
    });
  });

  it('row value=+1 + value=+1 → deletes row; returns {vote: 0} (like → like again)', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    const sel = makeSelectMock([{ value: 1 }]);
    const delWhere = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where: delWhere });
    const insert = vi.fn().mockImplementation(() => {
      throw new Error('insert should not be called');
    });
    const update = vi.fn().mockImplementation(() => {
      throw new Error('update should not be called');
    });
    const mockDb = { select: sel.select, delete: del, insert, update } as unknown as MockDb;

    const result = await mod.voteItemCore(
      { userId: 'u1', itemId: BigInt(42), value: 1 },
      { db: mockDb },
    );

    expect(result).toEqual({ vote: 0 });
    expect(del).toHaveBeenCalledOnce();
    expect(delWhere).toHaveBeenCalledOnce();
  });

  it('row value=+1 + value=-1 → updates row to -1; returns {vote: -1} (like → dislike flip)', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    const sel = makeSelectMock([{ value: 1 }]);
    const updWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updWhere });
    const update = vi.fn().mockReturnValue({ set });
    const mockDb = { select: sel.select, update } as unknown as MockDb;

    const result = await mod.voteItemCore(
      { userId: 'u1', itemId: BigInt(42), value: -1 },
      { db: mockDb },
    );

    expect(result).toEqual({ vote: -1 });
    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ value: -1 });
  });

  it('row value=-1 + value=+1 → updates row to +1; returns {vote: 1} (dislike → like flip)', async () => {
    const mod = await import('@/lib/user-actions/votes-core');
    const sel = makeSelectMock([{ value: -1 }]);
    const updWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updWhere });
    const update = vi.fn().mockReturnValue({ set });
    const mockDb = { select: sel.select, update } as unknown as MockDb;

    const result = await mod.voteItemCore(
      { userId: 'u1', itemId: BigInt(42), value: 1 },
      { db: mockDb },
    );

    expect(result).toEqual({ vote: 1 });
    expect(set).toHaveBeenCalledWith({ value: 1 });
  });
});
