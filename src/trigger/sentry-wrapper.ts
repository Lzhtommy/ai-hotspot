/**
 * Trigger.dev Sentry wrapper — Phase 6 OPS-01.
 *
 * The Trigger.dev worker runtime is a separate Node process from the Next.js
 * server; it does NOT inherit Next.js's instrumentation.ts hook, so
 * sentry.server.config.ts is never loaded there. Instead each task module
 * calls `withSentry(label, () => runTask())` around its run body, and this
 * wrapper:
 *
 *   1. Lazily initializes the Sentry SDK at first invocation (idempotent —
 *      subsequent calls short-circuit via the `initialized` flag).
 *   2. Catches any exception that escapes `fn()`, forwards it to Sentry with
 *      a `task` tag for dashboard filtering, flushes (2s budget) so the event
 *      reaches Sentry before the worker process recycles, then re-throws so
 *      Trigger.dev's own retry/telemetry still sees the failure.
 *
 * The beforeSend hook here mirrors (a subset of) sentry.server.config.ts —
 * Trigger.dev events never carry request.cookies/headers (no HTTP boundary
 * inside the worker) so we only redact user.email defensively.
 *
 * tracesSampleRate=0: we do not want performance traces from every LLM pipeline
 * item flooding Sentry — Langfuse already owns LLM-call tracing. Sentry's job
 * in this process is purely error capture.
 *
 * Consumed by:
 *   - src/trigger/process-item.ts (wraps runProcessItem)
 *   - Any future Trigger.dev task that wants Sentry error capture
 */
import * as Sentry from '@sentry/nextjs';

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    enabled: true,
    beforeSend(event) {
      if (event.user?.email) event.user.email = '[redacted]';
      return event;
    },
  });
  initialized = true;
}

export async function withSentry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  ensureInit();
  try {
    return await fn();
  } catch (err) {
    Sentry.captureException(err, { tags: { task: label } });
    await Sentry.flush(2000);
    throw err;
  }
}
