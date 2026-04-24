/**
 * Sentry server-side init — Phase 6 OPS-01.
 *
 * Loaded by `instrumentation.ts` when NEXT_RUNTIME === 'nodejs'. Next.js
 * invokes `register()` once per process, so `Sentry.init` runs at cold start
 * for every serverless instance that handles Node-runtime routes.
 *
 * PII scrub (T-6-60): before every event leaves this process, strip
 *   - request.cookies (entire object)
 *   - request.headers.cookie / authorization (both casings)
 *   - user.email (but keep user.id for correlation — operator debugging needs
 *     a stable identifier without the plaintext email)
 *   - any request.data field whose key matches /token|secret|key|password|authorization/i
 *
 * The beforeSend hook mutates `event` in place and returns it. Returning null
 * here would drop the event entirely, which we explicitly do NOT want — the
 * operator should still see the error, just without PII.
 *
 * `enabled` is gated on SENTRY_DSN presence so local `next dev` runs without a
 * DSN do not spam "Sentry DSN is not defined" warnings on every boot.
 */
import * as Sentry from '@sentry/nextjs';

/**
 * Regex of key substrings that look secret-like. Keep `bearer` here because
 * Auth.js emits breadcrumbs containing bearer-prefixed Authorization headers
 * nested inside fetch data objects (top-level key walk missed these — see
 * 06-REVIEW WR-01).
 */
const SECRET_KEY_RE = /token|secret|key|password|authorization|bearer/i;

/**
 * Recursive secret scrubber. Replaces any value whose key matches
 * `SECRET_KEY_RE` with '[redacted]'. Plain objects are traversed, arrays are
 * mapped, primitives are returned unchanged. A WeakSet guards against object
 * cycles so a pathological event with a self-referencing payload cannot
 * blow the stack.
 *
 * Exported so sentry.edge.config.ts and any future runtime can share the
 * exact same scrub rather than redeclaring the walker.
 */
export function scrubNested(v: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v as object)) return '[circular]';
  seen.add(v as object);
  if (Array.isArray(v)) return v.map((el) => scrubNested(el, seen));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = SECRET_KEY_RE.test(k) ? '[redacted]' : scrubNested(val, seen);
  }
  return out;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === 'production' || !!process.env.SENTRY_DSN,
  beforeSend(event) {
    // Strip cookies + authorization from request context
    if (event.request?.cookies) event.request.cookies = {};
    if (event.request?.headers) {
      delete event.request.headers['cookie'];
      delete event.request.headers['authorization'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }
    // Redact email; keep user.id for correlation
    if (event.user?.email) event.user.email = '[redacted]';
    // Recursively redact any request.data that smells like a secret. Previous
    // revisions walked only `Object.keys(data)` (one level deep), which let
    // nested shapes like `{ auth: { bearer_token: '...' } }` pass through.
    if (event.request?.data && typeof event.request.data === 'object') {
      event.request.data = scrubNested(event.request.data) as typeof event.request.data;
    }
    if (event.extra) {
      event.extra = scrubNested(event.extra) as typeof event.extra;
    }
    if (event.contexts) {
      event.contexts = scrubNested(event.contexts) as typeof event.contexts;
    }
    if (event.breadcrumbs) {
      for (const b of event.breadcrumbs) {
        if (b.data) b.data = scrubNested(b.data) as typeof b.data;
      }
    }
    return event;
  },
});
