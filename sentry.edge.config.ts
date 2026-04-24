/**
 * Sentry edge-runtime init — Phase 6 OPS-01.
 *
 * Loaded by `instrumentation.ts` when NEXT_RUNTIME === 'edge'. Middleware
 * (src/middleware.ts — Phase 6 admin edge gate) runs in the edge runtime and
 * is the primary emitter of edge events for this project.
 *
 * The beforeSend PII scrub mirrors sentry.server.config.ts exactly. The edge
 * runtime does not expose Node's `process.env` in the same way for all vars
 * at init time, so we rely on Sentry's own runtime-safe env access internally
 * and supply DSN via `process.env.SENTRY_DSN`, which Next.js inlines at
 * build time for edge bundles.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === 'production' || !!process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.request?.cookies) event.request.cookies = {};
    if (event.request?.headers) {
      delete event.request.headers['cookie'];
      delete event.request.headers['authorization'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }
    if (event.user?.email) event.user.email = '[redacted]';
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
