/**
 * Auth.js v5 route handler — Phase 5 AUTH-01.
 *
 * Delegates GET/POST to NextAuth(authConfig).handlers.
 * runtime = 'nodejs' required — @auth/drizzle-adapter uses Node-only APIs
 * (crypto.randomUUID for sessionToken generation, Drizzle's Neon serverless
 * pool which binds `ws` unconditionally — see src/lib/db/client.ts).
 *
 * This file is a thin re-export; all config lives in src/lib/auth/config.ts
 * and the singleton lives in src/lib/auth/index.ts.
 */
export const runtime = 'nodejs';
export { GET, POST } from '@/lib/auth';
