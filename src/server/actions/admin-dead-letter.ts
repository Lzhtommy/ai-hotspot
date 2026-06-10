'use server';

/**
 * Admin dead-letter server actions — Phase 6 Plan 06-05 (OPS-03).
 *
 * Thin `'use server'` adapter over src/lib/admin/dead-letter-repo.ts. Every
 * mutation is gated by assertAdmin(session) (Layer 3 of the admin-gate
 * defense-in-depth described in src/lib/auth/admin.ts).
 *
 * Bulk action (retryAllAction) is capped at BULK_LIMIT=20 items per click.
 *
 * Consumed by:
 *   - src/components/admin/retry-button.tsx      (retryItemAction)
 *   - src/components/admin/dead-letter-table.tsx (retryAllAction)
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
import { retryItemCore, retryAllCore } from '@/lib/admin/dead-letter-repo';

const BULK_LIMIT = 20; // max items per single bulk action

const IdSchema = z.object({ itemId: z.string().regex(/^\d+$/) });

export type RetryItemResult =
  | { ok: true; retried: boolean }
  | { ok: false; error: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL' };

export async function retryItemAction(input: { itemId: string }): Promise<RetryItemResult> {
  try {
    assertAdmin(await auth());
    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };
    const res = await retryItemCore({ itemId: BigInt(parsed.data.itemId) });
    revalidatePath('/admin/dead-letter');
    return { ok: true, retried: res.retried };
  } catch (e) {
    if (e instanceof AdminAuthError) return { ok: false, error: e.code };
    return { ok: false, error: 'INTERNAL' };
  }
}

export type RetryAllResult =
  | { ok: true; count: number }
  | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL' };

export async function retryAllAction(): Promise<RetryAllResult> {
  try {
    assertAdmin(await auth());
    const res = await retryAllCore({ limit: BULK_LIMIT });
    revalidatePath('/admin/dead-letter');
    return { ok: true, count: res.count };
  } catch (e) {
    if (e instanceof AdminAuthError) return { ok: false, error: e.code };
    return { ok: false, error: 'INTERNAL' };
  }
}
