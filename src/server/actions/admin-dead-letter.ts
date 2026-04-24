'use server';

/**
 * Admin dead-letter server actions — Phase 6 Plan 06-05 (OPS-03).
 *
 * Thin `'use server'` adapter over src/lib/admin/dead-letter-repo.ts. Every
 * mutation is gated by assertAdmin(session) (Layer 3 of the admin-gate
 * defense-in-depth described in src/lib/auth/admin.ts) and throttled by an
 * Upstash sliding-window rate limit.
 *
 * Rate limit (T-6-51): 20 retries / 60 s / admin. Sliding-window — a
 * fixed-window bucket would allow 2× the cap at the minute boundary and
 * directly burn LLM budget via the re-queued items. `prefix: 'admin:retry'`
 * keeps the Redis keyspace isolated from other limiters (Phase 4 feed
 * cache, future per-user interaction limits).
 *
 * Bulk action (retryAllAction) counts as a SINGLE rate-limit credit but
 * is itself capped at BULK_LIMIT=20 items per click. The combined effect
 * is the same ≤20 items/60s ceiling whether the admin retries one at a
 * time or in a single bulk click.
 *
 * Consumed by:
 *   - src/components/admin/retry-button.tsx      (retryItemAction)
 *   - src/components/admin/dead-letter-table.tsx (retryAllAction)
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { auth } from '@/lib/auth';
import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
import { redis } from '@/lib/redis/client';
import { retryItemCore, retryAllCore } from '@/lib/admin/dead-letter-repo';

const BULK_LIMIT = 20; // max items per single bulk action

// Sliding-window rate limit (NOT tumbling) — a naive tumbling bucket allows
// up to 2*N in the 1-second neighborhood of the minute boundary, which maps
// directly to 2× the LLM-cost ceiling under an adversarial retry loop.
// `prefix: 'admin:retry'` isolates our keyspace from other limiters.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  analytics: false,
  prefix: 'admin:retry',
});

async function checkRateLimit(adminUserId: string): Promise<boolean> {
  const { success } = await ratelimit.limit(`admin:retry:${adminUserId}`);
  return success;
}

const IdSchema = z.object({ itemId: z.string().regex(/^\d+$/) });

export type RetryItemResult =
  | { ok: true; retried: boolean }
  | { ok: false; error: 'VALIDATION' | 'RATE_LIMITED' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL' };

export async function retryItemAction(input: { itemId: string }): Promise<RetryItemResult> {
  try {
    const session = await auth();
    assertAdmin(session);
    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };
    const allowed = await checkRateLimit(session.user.id);
    if (!allowed) return { ok: false, error: 'RATE_LIMITED' };
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
  | { ok: false; error: 'RATE_LIMITED' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL' };

export async function retryAllAction(): Promise<RetryAllResult> {
  try {
    const session = await auth();
    assertAdmin(session);
    const allowed = await checkRateLimit(session.user.id);
    if (!allowed) return { ok: false, error: 'RATE_LIMITED' };
    const res = await retryAllCore({ limit: BULK_LIMIT });
    revalidatePath('/admin/dead-letter');
    return { ok: true, count: res.count };
  } catch (e) {
    if (e instanceof AdminAuthError) return { ok: false, error: e.code };
    return { ok: false, error: 'INTERNAL' };
  }
}
