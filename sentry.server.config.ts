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
    // Redact any request.data that smells like a secret
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (/token|secret|key|password|authorization/i.test(key)) {
          data[key] = '[redacted]';
        }
      }
    }
    return event;
  },
});
