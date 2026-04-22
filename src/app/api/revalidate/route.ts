/**
 * POST /api/revalidate — Phase 4 FEED-10.
 *
 * Called by Trigger.dev refresh-clusters task (via src/lib/feed/cache-invalidate.ts)
 * to revalidate the ISR HTML for `/` and `/all`. Shared-secret gated with
 * constant-time header comparison; path allowlisted to prevent open-revalidate.
 *
 * Threat model:
 *   - T-04-03-01 (Tampering / Spoofing): secret compared via crypto.timingSafeEqual —
 *     constant-time regardless of secret length; length mismatch returns false without
 *     calling timingSafeEqual (avoids Buffer.alloc throw on empty string)
 *   - T-04-03-02 (Open redirect / SSRF): paths restricted to '/', '/all' via ALLOWED_PATHS Set;
 *     arbitrary paths (e.g. '/admin', '/../etc/passwd') are silently skipped (400 if none pass)
 *   - T-04-03-03 (Info leak): secret never logged; error messages contain no header echo;
 *     route responses never include the received secret value
 *
 * Runtime MUST be nodejs — timingSafeEqual + revalidatePath require Node.js globals.
 */
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PATHS = new Set(['/', '/all']);

/**
 * Constant-time string comparison to prevent timing attacks on the shared secret.
 * Returns false immediately on length mismatch (still safe — length is not secret).
 */
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    console.warn('[revalidate] REVALIDATE_SECRET not configured');
    return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  const got = req.headers.get('x-revalidate-secret') ?? '';
  if (!safeEqual(got, expected)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const paths = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    return Response.json({ ok: false, error: 'paths_required' }, { status: 400 });
  }

  const revalidated: string[] = [];
  for (const p of paths) {
    if (typeof p === 'string' && ALLOWED_PATHS.has(p)) {
      revalidatePath(p);
      revalidated.push(p);
    }
  }

  if (revalidated.length === 0) {
    return Response.json({ ok: false, error: 'no_allowed_paths' }, { status: 400 });
  }

  return Response.json({ ok: true, revalidated });
}

/** Reject all non-POST verbs with 405 */
export async function GET(): Promise<Response> {
  return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
