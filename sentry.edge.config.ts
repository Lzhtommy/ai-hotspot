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

// Mirror of sentry.server.config.ts's scrubNested. Duplicated rather than
// imported because edge-runtime bundles must not pull Node-only imports
// transitively; keeping this file self-contained is the safer default. See
// 06-REVIEW WR-01 for the original one-level-deep scrub bug.
const SECRET_KEY_RE = /token|secret|key|password|authorization|bearer/i;

function scrubNested(v: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
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
    if (event.request?.cookies) event.request.cookies = {};
    if (event.request?.headers) {
      delete event.request.headers['cookie'];
      delete event.request.headers['authorization'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }
    if (event.user?.email) event.user.email = '[redacted]';
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
