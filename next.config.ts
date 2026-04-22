// next.js pinned to 15.x per CLAUDE.md Tech Stack constraint.
// The scaffold defaults to Next 16.x; we explicitly pin to ^15 in package.json
// so all Phase 1 plans and downstream phases target the documented App Router 15 surface.
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Neon serverless opens a WebSocket via `ws`, which relies on a native
  // `bufferutil` mask addon. When webpack bundles `ws` into the Vercel
  // lambda, the addon is stripped and `b.mask is not a function` kills the
  // first query (~1.6s handshake timeout surfaces as "Connection terminated
  // unexpectedly"). Keep `ws` external so Node resolves it from
  // node_modules at runtime with its native deps intact.
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
};

export default nextConfig;
