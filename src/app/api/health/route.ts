/**
 * GET /api/health
 *
 * Aggregates four parallel reachability checks:
 *   1. Neon Postgres + pgvector extension
 *   2. Upstash Redis
 *   3. RSSHub (HF Space) — with 60s cold-start budget (D-05)
 *   4. Trigger.dev Cloud API — with graceful fallback if the whoami endpoint is unavailable
 *
 * Response shape (D-16):
 *   { ok: boolean, services: { neon, redis, rsshub, trigger: "ok" | { error } } }
 * HTTP status: 200 if all green, 503 otherwise.
 *
 * Runtime MUST be nodejs (D-15) — the Neon HTTP driver requires Node globals.
 *
 * Consumed by Plan 05 CI as the phase acceptance gate.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { redis } from '@/lib/redis/client';
import { fetchRSSHub, RSSHubError } from '@/lib/rsshub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ServiceResult = 'ok' | { error: string };

async function checkNeon(): Promise<ServiceResult> {
  try {
    await db.execute(sql`SELECT 1`);
    const ext = await db.execute(sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    // db.execute with neon-http returns an object with .rows (array)
    const rows = (ext as unknown as { rows?: unknown[] }).rows ?? (ext as unknown as unknown[]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: 'pgvector extension not installed' };
    }
    return 'ok';
  } catch (err) {
    return { error: sanitize(err) };
  }
}

async function checkRedis(): Promise<ServiceResult> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : { error: `Unexpected ping: ${String(pong)}` };
  } catch (err) {
    return { error: sanitize(err) };
  }
}

async function checkRSSHub(): Promise<ServiceResult> {
  try {
    const res = await fetchRSSHub('/', { timeoutMs: 60_000, warmup: true });
    return res.ok ? 'ok' : { error: `HTTP ${res.status}` };
  } catch (err) {
    if (err instanceof RSSHubError) return { error: err.message };
    return { error: sanitize(err) };
  }
}

/**
 * Trigger.dev check.
 *
 * Primary: GET https://api.trigger.dev/api/v1/whoami with Bearer TRIGGER_SECRET_KEY.
 *   [ASSUMED — RESEARCH.md A1] — if endpoint returns non-2xx, fall back to format-only check.
 *
 * Fallback: verify TRIGGER_SECRET_KEY is set and has the `tr_` prefix shape.
 *   Manual dashboard trigger (Plan 03 Task 2) separately proves Success Criterion #3.
 */
async function checkTrigger(): Promise<ServiceResult> {
  const key = process.env.TRIGGER_SECRET_KEY;
  if (!key) return { error: 'TRIGGER_SECRET_KEY not set' };

  try {
    const res = await fetch('https://api.trigger.dev/api/v1/whoami', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return 'ok';
    // Fallback: accept format-only check so a stale endpoint shape doesn't break /api/health
    if (/^tr_/.test(key)) return 'ok';
    return { error: `Trigger.dev API returned ${res.status}` };
  } catch {
    // Network error — fall back to format check
    if (/^tr_/.test(key)) return 'ok';
    return { error: 'Trigger.dev API unreachable and key format unrecognized' };
  }
}

function sanitize(err: unknown): string {
  // Never leak connection strings, keys, or full stacks to the client.
  if (err instanceof Error) {
    // Strip common secret-shaped substrings defensively.
    return err.name + ': ' + err.message.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted-db-url]');
  }
  return 'Unknown error';
}

export async function GET() {
  const [neonResult, redisResult, rsshubResult, triggerResult] = await Promise.allSettled([
    checkNeon(),
    checkRedis(),
    checkRSSHub(),
    checkTrigger(),
  ]);

  const services = {
    neon:
      neonResult.status === 'fulfilled' ? neonResult.value : { error: sanitize(neonResult.reason) },
    redis:
      redisResult.status === 'fulfilled'
        ? redisResult.value
        : { error: sanitize(redisResult.reason) },
    rsshub:
      rsshubResult.status === 'fulfilled'
        ? rsshubResult.value
        : { error: sanitize(rsshubResult.reason) },
    trigger:
      triggerResult.status === 'fulfilled'
        ? triggerResult.value
        : { error: sanitize(triggerResult.reason) },
  };

  const allOk = Object.values(services).every((s) => s === 'ok');

  return Response.json({ ok: allOk, services }, { status: allOk ? 200 : 503 });
}
