/**
 * Next.js instrumentation hook — Phase 6 OPS-01.
 *
 * `register()` runs exactly once per server-side process at cold start.
 * Next.js invokes it before any route handler executes, so we can rely on
 * Sentry being initialized by the time the first request arrives.
 *
 * `onRequestError` is the per-request error hook Next.js added for runtime
 * error capture in App Router. We forward every captured request error to
 * Sentry via `captureRequestError`. Dynamic import inside the function body
 * (not a top-level `await import()`) keeps module evaluation synchronous —
 * important because this file is special-cased by Next.js's bundler and
 * top-level await has historically tripped esbuild/swc corner cases across
 * dev/build/runtime (WARNING-7 in the plan).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  const { captureRequestError } = await import('@sentry/nextjs');
  return captureRequestError(...args);
}
