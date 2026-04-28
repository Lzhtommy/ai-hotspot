'use server';

/**
 * Vote server action — Phase 5 VOTE-01, VOTE-02, VOTE-04.
 *
 * Thin 'use server' adapter over `src/lib/user-actions/votes-core.ts`.
 * Responsible for: (1) auth() → requireLiveUserCore (D-05 Layer 2 ban guard),
 * (2) BigInt wrap, (3) delegation to voteItemCore (which enforces D-12 exclusive
 * toggle + VOTE-04 value contract).
 *
 * After the mutation, revalidates the (reader) layout so feed pages reflect
 * the updated vote state without a manual page refresh.
 *
 * Errors thrown (caught by caller):
 *   - AuthError{UNAUTHENTICATED}  → client opens login modal
 *   - AuthError{FORBIDDEN}        → client shows generic error
 *   - VoteValueError              → client shows inline error (should only
 *                                   happen on a malformed client call)
 *
 * Consumed by:
 *   - src/components/feed/feed-card-actions.tsx (Plan 05-07 — UI wiring)
 */
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireLiveUserCore } from '@/lib/user-actions/auth-guard';
import { voteItemCore, type VoteValue, type VoteState } from '@/lib/user-actions/votes-core';

export async function voteItem(itemId: string, value: VoteValue): Promise<{ vote: VoteState }> {
  const session = await auth();
  const userId = await requireLiveUserCore(session);
  const result = await voteItemCore({ userId, itemId: BigInt(itemId), value });
  revalidatePath('/(reader)', 'layout');
  return result;
}
