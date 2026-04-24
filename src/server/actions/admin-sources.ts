'use server';

/**
 * Admin sources Server Actions — Phase 6 Plan 06-02 (ADMIN-03, ADMIN-04,
 * ADMIN-05, ADMIN-06 + T-6-20..T-6-24).
 *
 * Four Server Actions behind `/admin/sources`:
 *   - createSourceAction      (ADMIN-03)
 *   - updateSourceAction      (ADMIN-04)
 *   - softDeleteSourceAction  (ADMIN-05)
 *   - toggleActiveAction      (enable/disable without losing data)
 *
 * Every action follows the exact same defense-in-depth sequence:
 *   1. `assertAdmin(await auth())` — FIRST, before any input parsing or DB
 *      access. Throws `AdminAuthError` which is caught and mapped to an
 *      opaque error code ('UNAUTHENTICATED' | 'FORBIDDEN'). This is Layer 3
 *      of the admin gate (edge middleware → layout RSC → per-action).
 *   2. Zod parse the FormData (or structured payload). A malformed input
 *      returns `{ ok: false, error: 'VALIDATION' }` — we do NOT echo the
 *      raw error message back to the client because doing so leaks DB
 *      schema hints and SDK internals (T-6-24).
 *   3. Delegate to the pure `*Core` helper from
 *      `@/lib/admin/sources-repo`.
 *   4. `revalidatePath('/admin/sources')` so the list view reflects the
 *      write on the next navigation.
 *
 * All error paths return a narrow `{ ok: false, error }` union rather than
 * throwing — Server Actions serialize thrown errors into a dev-friendly
 * but production-leaky shape, so we explicitly map to opaque codes.
 *
 * Consumed by:
 *   - src/components/admin/source-form.tsx        (create + update)
 *   - src/components/admin/source-row-actions.tsx (delete + toggle)
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
import {
  createSourceCore,
  softDeleteSourceCore,
  updateSourceCore,
} from '@/lib/admin/sources-repo';

// ────────────────────────────────────────────────────────────────────────
// Result shapes
// ────────────────────────────────────────────────────────────────────────

type ErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL';
export type AdminActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true } & T)
  | { ok: false; error: ErrorCode };

// ────────────────────────────────────────────────────────────────────────
// Validation schemas
// ────────────────────────────────────────────────────────────────────────

// Numeric string matching the `numeric(3,1)` column: 0–99 with optional
// single-decimal digit. Accepts '0', '1', '1.5', '10', '99.9' — rejects
// '1.55', 'abc', '-1.0'.
const WEIGHT_RE = /^\d+(\.\d)?$/;

const SourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  rssUrl: z.string().trim().url().max(2000),
  language: z.enum(['zh', 'en']).default('zh'),
  weight: z.string().regex(WEIGHT_RE).default('1.0'),
  category: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().default(true),
});

const SourceUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
  weight: z.string().regex(WEIGHT_RE).optional(),
  isActive: z.boolean().optional(),
  category: z.string().trim().max(40).nullable().optional(),
});

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * Map caught exceptions to the narrow ErrorCode contract. `AdminAuthError`
 * carries its own discriminant; everything else becomes 'INTERNAL' so we
 * never leak err.message (which could include DB schema hints per T-6-24).
 */
function toErrorCode(e: unknown): ErrorCode {
  if (e instanceof AdminAuthError) return e.code;
  return 'INTERNAL';
}

/**
 * Read a FormData field as an optional trimmed string. Missing / empty
 * fields return `undefined` so zod's `.optional()` correctly applies.
 */
function readString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Read a FormData checkbox. HTML checkbox posts 'on' / 'true' when checked
 * and omits the key entirely when unchecked — so `fd.has(key)` plus a value
 * normalization covers both the native form case and programmatic submits.
 */
function readBool(fd: FormData, key: string): boolean {
  if (!fd.has(key)) return false;
  const v = fd.get(key);
  if (typeof v !== 'string') return true; // present but non-string — still truthy
  return v !== '' && v !== 'false' && v !== '0' && v !== 'off';
}

// ────────────────────────────────────────────────────────────────────────
// Server Actions
// ────────────────────────────────────────────────────────────────────────

/**
 * Create a new source (ADMIN-03). Accepts a `FormData` built from the
 * admin create form in `src/components/admin/source-form.tsx`.
 */
export async function createSourceAction(
  formData: FormData,
): Promise<AdminActionResult<{ id: number }>> {
  try {
    assertAdmin(await auth());

    const parsed = SourceCreateSchema.safeParse({
      name: readString(formData, 'name'),
      rssUrl: readString(formData, 'rssUrl'),
      language: readString(formData, 'language'),
      weight: readString(formData, 'weight'),
      category: readString(formData, 'category') ?? null,
      isActive: readBool(formData, 'isActive'),
    });
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };

    const { id } = await createSourceCore(parsed.data);
    revalidatePath('/admin/sources');
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: toErrorCode(e) };
  }
}

/**
 * Patch an existing source (ADMIN-04). The edit form only lets the admin
 * change name / weight / isActive / category — rssUrl is immutable once a
 * source exists (changing it would orphan ingested items from their origin
 * URL and break idempotency). That constraint is enforced here by not
 * reading `rssUrl` out of the FormData at all.
 */
export async function updateSourceAction(
  formData: FormData,
): Promise<AdminActionResult> {
  try {
    assertAdmin(await auth());

    const categoryRaw = readString(formData, 'category');
    const parsed = SourceUpdateSchema.safeParse({
      id: formData.get('id'),
      name: readString(formData, 'name'),
      weight: readString(formData, 'weight'),
      isActive: formData.has('isActive') ? readBool(formData, 'isActive') : undefined,
      category: categoryRaw === undefined ? undefined : (categoryRaw as string | null),
    });
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };

    const { id, ...patch } = parsed.data;
    await updateSourceCore(id, patch);
    revalidatePath('/admin/sources');
    revalidatePath(`/admin/sources/${id}/edit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toErrorCode(e) };
  }
}

/**
 * Soft-delete a source (ADMIN-05). Takes an `id` directly (Client callers
 * bind the id via a wrapping .bind() / inline closure rather than a hidden
 * form field — the row-actions component does the bind).
 *
 * The underlying core sets `deleted_at = now()` and `is_active = false`;
 * items already in the DB are preserved (T-6-25).
 */
export async function softDeleteSourceAction(
  id: number,
): Promise<AdminActionResult> {
  try {
    assertAdmin(await auth());

    const parsed = z.coerce.number().int().positive().safeParse(id);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };

    await softDeleteSourceCore(parsed.data);
    revalidatePath('/admin/sources');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toErrorCode(e) };
  }
}

/**
 * Flip `is_active` for a source — pause / resume without data loss. Used
 * by the per-row inline toggle. `nextActive` is the desired new state so
 * the UI can stay stateless (no need to round-trip the current state).
 */
export async function toggleActiveAction(
  id: number,
  nextActive: boolean,
): Promise<AdminActionResult> {
  try {
    assertAdmin(await auth());

    const idParsed = z.coerce.number().int().positive().safeParse(id);
    const boolParsed = z.boolean().safeParse(nextActive);
    if (!idParsed.success || !boolParsed.success) {
      return { ok: false, error: 'VALIDATION' };
    }

    await updateSourceCore(idParsed.data, { isActive: boolParsed.data });
    revalidatePath('/admin/sources');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toErrorCode(e) };
  }
}
