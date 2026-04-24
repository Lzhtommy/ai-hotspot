/**
 * Sentry browser-side init — Phase 6 OPS-01.
 *
 * Loaded automatically by Next.js on the client when this file exists at the
 * project root (App Router instrumentation-client convention). Initializes
 * Sentry in the browser so unhandled React errors, fetch failures, and
 * navigation errors reach the same Sentry project as server events.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is the same Sentry DSN value as the server-side
 * `SENTRY_DSN`, but must be exposed to the client bundle via the
 * `NEXT_PUBLIC_` prefix — that is the whole point of having two env names
 * for the same secret.
 *
 * beforeSend here only needs the user.email redaction — the browser does not
 * have request.cookies/headers access in the first place, so those fields
 * never show up in client-side events. We still redact email defensively in
 * case any telemetry attaches user context client-side.
 *
 * `onRouterTransitionStart` export enables Sentry's App Router navigation
 * tracing (Sentry SDK reads this named export automatically).
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    if (event.user?.email) event.user.email = '[redacted]';
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
