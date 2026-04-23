/**
 * Plan 06-00 Task 1 — unit tests for src/lib/auth/admin.ts.
 *
 * Covers the four behaviors specified in the plan:
 *   1. requireAdmin() returns the session when session.user.role === 'admin'
 *   2. requireAdmin() redirects to '/admin/access-denied' when a session exists
 *      but the role is not 'admin'
 *   3. requireAdmin() redirects to '/' when there is no session (anonymous)
 *   4. assertAdmin(session) throws AdminAuthError('UNAUTHENTICATED') on null,
 *      AdminAuthError('FORBIDDEN') on non-admin, and is a no-op on admin.
 *
 * `auth()` is mocked via vi.mock('@/lib/auth'). `redirect` from
 * 'next/navigation' is mocked so we can assert it was called with the right
 * path without the test runner throwing (Next's redirect() throws a special
 * sentinel error in production; here we replace it with a recorder).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture calls to auth() and redirect(). Hoisted so vi.mock picks them up.
const authMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  // Match the behaviour of real Next.js redirect(): it never returns.
  throw new Error(`__REDIRECT__:${path}`);
});

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { fakeSession } from '../helpers/auth';

describe('Plan 06-00 Task 1 — requireAdmin()', () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
  });

  it('returns the session when user.role === "admin"', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin');
    const session = fakeSession({ role: 'admin' });
    authMock.mockResolvedValue(session);

    const result = await requireAdmin();

    expect(result).toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to /admin/access-denied when session exists but role !== "admin"', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin');
    const session = fakeSession({ role: 'user' });
    authMock.mockResolvedValue(session);

    await expect(requireAdmin()).rejects.toThrow('__REDIRECT__:/admin/access-denied');
    expect(redirectMock).toHaveBeenCalledWith('/admin/access-denied');
  });

  it('redirects to / when the session is null (anonymous)', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin');
    authMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow('__REDIRECT__:/');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('redirects to / when session exists but user.id is missing', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin');
    // Malformed session — session callback returned an object without user.id.
    // Treat as anonymous (same as null).
    authMock.mockResolvedValue({ user: {} });

    await expect(requireAdmin()).rejects.toThrow('__REDIRECT__:/');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });
});

describe('Plan 06-00 Task 1 — assertAdmin()', () => {
  it('throws AdminAuthError("UNAUTHENTICATED") when session is null', async () => {
    const { assertAdmin, AdminAuthError } = await import('@/lib/auth/admin');
    expect(() => assertAdmin(null)).toThrow(AdminAuthError);
    try {
      assertAdmin(null);
    } catch (err) {
      expect(err).toBeInstanceOf(AdminAuthError);
      expect((err as InstanceType<typeof AdminAuthError>).code).toBe('UNAUTHENTICATED');
    }
  });

  it('throws AdminAuthError("FORBIDDEN") when role !== "admin"', async () => {
    const { assertAdmin, AdminAuthError } = await import('@/lib/auth/admin');
    const session = fakeSession({ role: 'user' });
    try {
      // Cast FakeSession through unknown to appease the NextAuth Session param
      // without pulling real next-auth types into the test file.
      assertAdmin(session as unknown as Parameters<typeof assertAdmin>[0]);
      throw new Error('assertAdmin did not throw for non-admin session');
    } catch (err) {
      expect(err).toBeInstanceOf(AdminAuthError);
      expect((err as InstanceType<typeof AdminAuthError>).code).toBe('FORBIDDEN');
    }
  });

  it('returns normally when role === "admin"', async () => {
    const { assertAdmin } = await import('@/lib/auth/admin');
    const session = fakeSession({ role: 'admin' });
    expect(() =>
      assertAdmin(session as unknown as Parameters<typeof assertAdmin>[0]),
    ).not.toThrow();
  });
});
