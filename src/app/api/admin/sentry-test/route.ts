/**
 * Admin-only Sentry integration test endpoint — Phase 6 OPS-01.
 *
 * Purpose: deliberately throw a runtime error so Task 3's live verification
 * can confirm the error reaches the Sentry dashboard within 5 minutes. The
 * thrown error carries a timestamp in the message so multiple test runs can
 * be distinguished in the Sentry Issues list.
 *
 * Security (T-6-61 — Elevation of Privilege):
 *   - `requireAdmin()` is the first statement. Anonymous users are redirected
 *     to `/` and non-admin users to `/admin/access-denied` (both are 3xx, not
 *     5xx — no response body leaks). Only authenticated admins reach the
 *     `throw` statement below.
 *   - `dynamic = 'force-dynamic'` ensures the handler runs per-request so the
 *     admin session check is always evaluated (no stale cached 500).
 *
 * CSRF hardening (06-REVIEW WR-04):
 *   - Changed from GET to POST so a cross-site `<img src="...">` can no
 *     longer trigger the endpoint (images are GET-only).
 *   - Origin/host check rejects cross-origin POSTs even if an attacker finds
 *     a way to issue one — belt-and-suspenders behind Auth.js's default
 *     `SameSite=Lax` session cookie, which already blocks cross-site form
 *     POSTs from delivering the session cookie.
 *
 * T-6-63 (log-noise DoS) is still accepted for first-party admins, but
 * cross-site amplification (an attacker burning an admin's budget via an
 * `<img>` tag) is no longer possible.
 */
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Gate — redirects non-admins before we reach the deliberate throw.
  await requireAdmin();

  // Belt-and-suspenders CSRF check: require the Origin header host to match
  // the request's own host. Browsers attach Origin to all cross-site POSTs
  // (and same-origin POSTs). A missing Origin header on a POST is itself
  // suspicious and we fail closed.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return new Response('forbidden', { status: 403 });
    }
  } catch {
    return new Response('forbidden', { status: 403 });
  }

  // Deliberate error. This reaches Sentry via the instrumentation.ts
  // `onRequestError` hook for Next.js App Router runtime errors.
  throw new Error(`Sentry integration test — ${new Date().toISOString()}`);
}
