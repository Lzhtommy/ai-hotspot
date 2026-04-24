/**
 * Quick 260424-oyc Task 1 — unit tests for POST /api/admin/sync.
 *
 * Covers the three authority gates and response-shape contract of the route:
 *   1. auth gate via assertAdmin(await auth()) → 401 UNAUTHENTICATED / 403 FORBIDDEN
 *   2. Upstash sliding-window(1 / 120 s / admin user id) → 429 RATE_LIMITED (retryAfter=120)
 *   3. tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined) → 200 { ok, runId }
 *      + 500 INTERNAL with NO leak of underlying error text (secret-safety).
 *
 * Mock strategy mirrors tests/unit/admin-gate.test.ts (vi.mock('@/lib/auth'))
 * and tests/unit/admin-dead-letter.test.ts (Ratelimit + redis mocks). The
 * route module is imported AFTER mocks are registered so the module-scope
 * `new Ratelimit({...})` call picks up the mocked constructor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
const triggerMock = vi.fn();
const limitMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@trigger.dev/sdk', () => ({
  tasks: { trigger: triggerMock },
}));

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({ limit: limitMock }));
  // `Ratelimit.slidingWindow(...)` is called at module load on the route side —
  // make it a no-op that returns a sentinel token the constructor accepts.
  (Ratelimit as unknown as { slidingWindow: (n: number, w: string) => string }).slidingWindow =
    vi.fn(() => 'window-token');
  return { Ratelimit };
});

vi.mock('@/lib/redis/client', () => ({
  redis: {},
}));

function makeRequest(): Request {
  return new Request('http://localhost/api/admin/sync', { method: 'POST' });
}

describe('POST /api/admin/sync — quick 260424-oyc', () => {
  beforeEach(() => {
    authMock.mockReset();
    triggerMock.mockReset();
    limitMock.mockReset();
  });

  it('returns 401 UNAUTHENTICATED when there is no session', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue(null);

    const res = await POST();
    const body = (await res.json()) as { ok: boolean; error?: string };

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(triggerMock).not.toHaveBeenCalled();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN when session.user.role !== "admin"', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } });

    const res = await POST();
    const body = (await res.json()) as { ok: boolean; error?: string };

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(triggerMock).not.toHaveBeenCalled();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns 429 RATE_LIMITED when the sliding-window denies the admin', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } });
    limitMock.mockResolvedValue({ success: false });

    const res = await POST();
    const body = (await res.json()) as {
      ok: boolean;
      error?: string;
      retryAfterSeconds?: number;
    };

    expect(res.status).toBe(429);
    expect(body).toEqual({ ok: false, error: 'RATE_LIMITED', retryAfterSeconds: 120 });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('returns 200 { ok:true, runId } on a successful admin trigger', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } });
    limitMock.mockResolvedValue({ success: true });
    triggerMock.mockResolvedValue({ id: 'run_abc123' });

    const res = await POST();
    const body = (await res.json()) as { ok: boolean; runId?: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, runId: 'run_abc123' });
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith('ingest-hourly', undefined);
  });

  it('returns opaque 500 INTERNAL on trigger failure without leaking the error message', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } });
    limitMock.mockResolvedValue({ success: true });
    triggerMock.mockRejectedValue(new Error('TRIGGER_SECRET_KEY invalid'));

    const res = await POST();
    const raw = await res.text();

    expect(res.status).toBe(500);
    // No leak of the secret env-var name or the word "invalid" anywhere in the
    // response body. If the catch branch ever regresses to `err.message` the
    // opaque contract breaks silently and this assertion catches it.
    expect(raw.includes('TRIGGER_SECRET_KEY')).toBe(false);
    expect(raw.includes('invalid')).toBe(false);
    expect(JSON.parse(raw)).toEqual({ ok: false, error: 'INTERNAL' });
  });

  it('keys the sliding-window rate-limit by the admin user id (per-user isolation)', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } });
    limitMock.mockResolvedValue({ success: true });
    triggerMock.mockResolvedValue({ id: 'run_zzz' });

    await POST();

    expect(limitMock).toHaveBeenCalledTimes(1);
    const firstArg = limitMock.mock.calls[0]![0];
    expect(typeof firstArg).toBe('string');
    expect(String(firstArg)).toContain('admin1');
  });
});
