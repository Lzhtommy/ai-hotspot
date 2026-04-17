import { Redis } from '@upstash/redis';

/**
 * Upstash Redis client singleton.
 *
 * HTTP-based — safe for Vercel serverless and Edge (no persistent TCP pool).
 * Consumed by:
 *   - /api/health (Plan 04) — ping check
 *   - Phase 4 feed cache (5-min TTL)
 *   - Phase 4 rate limiting (Upstash Ratelimit SDK)
 *
 * Env vars (D-07): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
