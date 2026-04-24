/**
 * POST /api/admin/sync — quick 260424-oyc.
 *
 * Admin-only manual trigger for the `ingest-hourly` Trigger.dev task. Three
 * gates stack fail-fast (cheapest → most expensive):
 *
 *   1. assertAdmin(await auth())   — Layer 3 of the admin-gate defense-in-depth
 *      described in src/lib/auth/admin.ts. 401 / 403 before any Redis call.
 *   2. Upstash sliding-window(1 / 120 s / admin user id) — authoritative
 *      cooldown. Client-side localStorage countdown in ManualSyncButton is
 *      UX only; the server wins on every POST (D-03).
 *   3. tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined) — fires
 *      a manual run. Trigger.dev v4 synthesises the ScheduledTaskPayload
 *      ({ timestamp: now() }) server-side for manual runs on a schedules.task,
 *      verified against ingest-hourly.ts:40 which only reads payload.timestamp.
 *
 * Response shape never leaks err.message. Trigger.dev errors can include
 * fragments of TRIGGER_SECRET_KEY in auth-failure paths, so every catch
 * maps to opaque `{ error: 'INTERNAL' }` (T-OYC-04).
 *
 * Redis outage fails closed (returns 500, does NOT allow the trigger) —
 * the sibling admin-dead-letter.ts does the same (T-OYC-06). Availability
 * yields to safety here; an admin can simply retry when Redis recovers,
 * but a stuck Redis must not open the rate-limiting gate.
 *
 * Consumed by:
 *   - src/components/feed/manual-sync-button.tsx (fetch POST)
 */
import { tasks } from '@trigger.dev/sdk';
import { Ratelimit } from '@upstash/ratelimit';
import { auth } from '@/lib/auth';
import { assertAdmin, AdminAuthError } from '@/lib/auth/admin';
import { redis } from '@/lib/redis/client';
import type { ingestHourly } from '@/trigger/ingest-hourly';

// Neon HTTP driver (via session lookup) + Trigger.dev SDK require Node runtime.
export const runtime = 'nodejs';
// Mutation endpoint — no ISR.
export const dynamic = 'force-dynamic';

const WINDOW_SECONDS = 120;

// Module-scope singleton — warm serverless instances reuse the same limiter,
// mirroring src/server/actions/admin-dead-letter.ts:40-49.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, `${WINDOW_SECONDS} s`),
  analytics: false,
  prefix: 'admin:sync',
});

export async function POST(): Promise<Response> {
  // Gate 1 — auth. assertAdmin narrows session to AdminSession via its
  // `asserts session is AdminSession` declaration; we only reach the next
  // gate when the caller is authenticated AND role === 'admin'.
  let session;
  try {
    session = await auth();
    assertAdmin(session);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return Response.json({ ok: false, error: e.code }, { status });
    }
    return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }

  // Gate 2 — sliding-window rate limit keyed by admin user id.
  try {
    const { success } = await ratelimit.limit(`admin:sync:${session.user.id}`);
    if (!success) {
      return Response.json(
        { ok: false, error: 'RATE_LIMITED', retryAfterSeconds: WINDOW_SECONDS },
        { status: 429 },
      );
    }
  } catch {
    // Fail closed on Redis outage — see T-OYC-06 above.
    return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }

  // Gate 3 — trigger the ingest-hourly task.
  //
  // A `schedules.task` statically types its payload as `ScheduledTaskPayload`,
  // but Trigger.dev v4's server synthesises the full payload object
  // (scheduleId / type / timestamp / timezone / upcoming) when a schedule
  // is triggered manually and the client omits the payload. We pass
  // `undefined` at runtime and widen the compile-time type with `as never`
  // so the static generic still constrains the task id. Verified against
  // @trigger.dev/core@4.4.4 ScheduledTaskPayload shape + ingest-hourly.ts:40
  // which reads only `payload.timestamp` — the server always supplies it.
  try {
    const handle = await tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined as never);
    return Response.json({ ok: true, runId: handle.id }, { status: 200 });
  } catch {
    // NEVER echo the thrown message — it may embed TRIGGER_SECRET_KEY fragments.
    return Response.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}
