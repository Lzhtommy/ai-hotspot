/**
 * Votes core — Phase 5 VOTE-01, VOTE-02, VOTE-04, D-10, D-12.
 *
 * Pure deps-injected CRUD implementing the D-12 exclusive 3-state toggle state
 * machine for the `votes` table. `value` is persisted as smallint ∈ {-1, +1};
 * "no vote" is represented as absence of the row (composite PK on user_id,
 * item_id). The state machine has three transitions:
 *
 *   no row      + value=v   → INSERT(value=v)       → { vote: v }
 *   row value=v + value=v   → DELETE                → { vote: 0 }   (neutralize)
 *   row value=v + value=-v  → UPDATE(value=-v)      → { vote: -v }  (flip)
 *
 * Input validation (VOTE-04): `value` MUST be exactly -1 or +1. Any other
 * value throws `VoteValueError` before any DB call.
 *
 * Consumed by:
 *   - src/server/actions/votes.ts
 *   - tests/integration/server-action-vote.test.ts
 *   - tests/unit/vote-value-contract.test.ts
 */
import { and, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { votes } from '@/lib/db/schema';

export type VoteValue = -1 | 1;
export type VoteState = -1 | 0 | 1;

export class VoteValueError extends Error {
  constructor() {
    super('VoteValueError: value must be -1 or +1');
    this.name = 'VoteValueError';
  }
}

export interface VoteDeps {
  db?: typeof realDb;
}

export interface VoteParams {
  userId: string;
  itemId: bigint;
  value: VoteValue;
}

export async function voteItemCore(
  params: VoteParams,
  deps?: VoteDeps,
): Promise<{ vote: VoteState }> {
  const { userId, itemId, value } = params;

  // VOTE-04 contract — reject anything outside {-1, +1} before any DB call.
  if (value !== 1 && value !== -1) {
    throw new VoteValueError();
  }

  const dbx = deps?.db ?? realDb;
  const rows = await dbx
    .select({ value: votes.value })
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.itemId, itemId)));
  const existing = rows[0];

  // Transition 1 — no existing row → insert new vote.
  if (!existing) {
    await dbx.insert(votes).values({ userId, itemId, value });
    return { vote: value };
  }

  // Transition 2 — same value clicked twice → neutralize (delete).
  if (existing.value === value) {
    await dbx
      .delete(votes)
      .where(and(eq(votes.userId, userId), eq(votes.itemId, itemId)));
    return { vote: 0 };
  }

  // Transition 3 — flip (1 → -1 or -1 → 1) via UPDATE. No intermediate neutral.
  await dbx
    .update(votes)
    .set({ value })
    .where(and(eq(votes.userId, userId), eq(votes.itemId, itemId)));
  return { vote: value };
}
