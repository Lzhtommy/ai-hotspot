// next.js pinned to 15.x per CLAUDE.md Tech Stack constraint.
// The scaffold defaults to Next 16.x; we explicitly pin to ^15 in package.json
// so all Phase 1 plans and downstream phases target the documented App Router 15 surface.
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Neon serverless opens a WebSocket via `ws`, which relies on a native
  // `bufferutil` mask addon. When webpack bundles `ws` into the Vercel
  // lambda, the addon is stripped and `b.mask is not a function` kills the
  // first query (~1.6s handshake timeout surfaces as "Connection terminated
  // unexpectedly"). Keep `ws` external so Node resolves it from
  // node_modules at runtime with its native deps intact.
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],

  // Phase 5 D-04 + RESEARCH §Pitfall 7 — OAuth avatar allowlist.
  // next/image proxies every remote image through the Next server, so the
  // hostname must be explicitly allowlisted. Without this, GitHub/Google
  // avatars rendered via <Image src={user.image} /> throw
  // "hostname … is not configured under images in your next.config.js".
  // Threat T-5-12 (SSRF via next/image fetch) is mitigated by the explicit
  // allowlist — no wildcards, only the two CDN hosts our profile() fns emit.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

// Phase 6 OPS-01 — Sentry wrap.
// withSentryConfig augments the build with sourcemap upload (gated on
// SENTRY_AUTH_TOKEN — silent-skipped if absent) and auto-instruments API
// routes for error capture. Options:
//   - silent: !process.env.CI  → quiet local builds, verbose in CI
//   - widenClientFileUpload: true → upload sourcemaps for additional client
//     bundles so stacktraces from dynamically loaded chunks symbolicate
//   - disableLogger: true → strip Sentry's console.log wrapper from prod
//     bundle (shaves bundle size)
//   - automaticVercelMonitors: false → we do not use Sentry cron monitors;
//     Vercel cron is only a trigger into Inngest/Trigger.dev
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
