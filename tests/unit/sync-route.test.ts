/**
 * Quick 260424-oyc Task 1 — unit tests for POST /api/admin/sync.
 *
 * Covers the two authority gates and response-shape contract of the route:
 *   1. auth gate via assertAdmin(await auth()) → 401 UNAUTHENTICATED / 403 FORBIDDEN
 *   2. tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined) → 200 { ok, runId }
 *      + 500 INTERNAL with NO leak of underlying error text (secret-safety).
 *
 * Mock strategy mirrors tests/unit/admin-gate.test.ts (vi.mock('@/lib/auth')).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();
const triggerMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@trigger.dev/sdk', () => ({
  tasks: { trigger: triggerMock },
}));

describe('POST /api/admin/sync — quick 260424-oyc', () => {
  beforeEach(() => {
    authMock.mockReset();
    triggerMock.mockReset();
  });

  it('returns 401 UNAUTHENTICATED when there is no session', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue(null);

    const res = await POST();
    const body = (await res.json()) as { ok: boolean; error?: string };

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN when session.user.role !== "admin"', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } });

    const res = await POST();
    const body = (await res.json()) as { ok: boolean; error?: string };

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('returns 200 { ok:true, runId } on a successful admin trigger', async () => {
    const { POST } = await import('@/app/api/admin/sync/route');
    authMock.mockResolvedValue({ user: { id: 'admin1', role: 'admin' } });
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
});
