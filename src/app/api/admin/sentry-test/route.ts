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
 * T-6-63 (log-noise DoS) is accepted: admin-only gate + no automation point
 * means a malicious flooder would first need an admin session, and then each
 * call produces exactly one Sentry event.
 */
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Gate — redirects non-admins before we reach the deliberate throw.
  await requireAdmin();

  // Deliberate error. This reaches Sentry via the instrumentation.ts
  // `onRequestError` hook for Next.js App Router runtime errors.
  throw new Error(`Sentry integration test — ${new Date().toISOString()}`);
}
