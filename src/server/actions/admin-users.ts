'use server';

/**
 * Admin users Server Actions — Phase 6 Plan 06-03 (ADMIN-07, ADMIN-08).
 *
 * Thin 'use server' wrapper over the pure core at `src/lib/admin/users-repo.ts`.
 * Responsibilities:
 *   1. Read the live session via `auth()`.
 *   2. Call `assertAdmin(session)` — Layer 3 gate per 06-00's defense-in-depth
 *      model (Layer 1: middleware, Layer 2: admin layout, Layer 3: here).
 *   3. zod-validate `targetUserId` as a uuid (T-6-31 IDOR — anything non-uuid
 *      is rejected before touching the DB).
 *   4. Map core exceptions to client-safe `{ ok: false, error: CODE }` so
 *      the thrown instance never leaks across the client boundary.
 *   5. `revalidatePath('/admin/users')` so the RSC list re-renders with the
 *      new ban state on the next navigation.
 *
 * Threat coverage:
 *   - T-6-30  SelfBanError → SELF_BAN (admin can't lock themselves out)
 *   - T-6-31  zod uuid() validation on targetUserId
 *   - T-6-32  Session revocation is enforced by banUserCore's transaction
 *
 * Consumed by:
 *   - src/components/admin/user-ban-button.tsx
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
import {
  banUserCore,
  unbanUserCore,
  SelfBanError,
  UserNotFoundError,
  AlreadyBannedError,
} from '@/lib/admin/users-repo';

const IdSchema = z.object({ targetUserId: z.string().uuid() });

export type AdminActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'VALIDATION'
        | 'SELF_BAN'
        | 'NOT_FOUND'
        | 'ALREADY_BANNED'
        | 'UNAUTHENTICATED'
        | 'FORBIDDEN'
        | 'INTERNAL';
    };

export async function banUserAction(input: { targetUserId: string }): Promise<AdminActionResult> {
  try {
    const session = await auth();
    assertAdmin(session);

    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };

    await banUserCore({
      targetUserId: parsed.data.targetUserId,
      adminUserId: session.user.id,
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    if (e instanceof SelfBanError) return { ok: false, error: 'SELF_BAN' };
    if (e instanceof UserNotFoundError) return { ok: false, error: 'NOT_FOUND' };
    if (e instanceof AlreadyBannedError) return { ok: false, error: 'ALREADY_BANNED' };
    if (e instanceof AdminAuthError) return { ok: false, error: e.code };
    return { ok: false, error: 'INTERNAL' };
  }
}

export async function unbanUserAction(input: { targetUserId: string }): Promise<AdminActionResult> {
  try {
    const session = await auth();
    assertAdmin(session);

    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };

    await unbanUserCore({ targetUserId: parsed.data.targetUserId });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    if (e instanceof UserNotFoundError) return { ok: false, error: 'NOT_FOUND' };
    if (e instanceof AdminAuthError) return { ok: false, error: e.code };
    return { ok: false, error: 'INTERNAL' };
  }
}
