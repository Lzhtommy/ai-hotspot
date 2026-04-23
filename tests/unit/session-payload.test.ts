// Task 5-02-03 | Plan 05-02 | REQ-AUTH-08
// Asserts session.user payload exposes {id, email, name, image, role} and
// does NOT leak is_banned (D-08).
import { describe, it, expect } from 'vitest';
import { fakeSession } from '../helpers/auth';

describe('Phase 5 session payload shape', () => {
  it('TODO[5-02-03]: session callback returns {id,email,name,image,role}', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { callbacks?: { session?: (...a: unknown[]) => unknown } };
    };
    const sessionCb = cfg.authConfig.callbacks?.session;
    expect(sessionCb, 'session callback missing').toBeDefined();

    const s = fakeSession({ role: 'user', image: 'https://example.test/avatar.png' });
    // With database strategy, Auth.js passes the DB row shape as `user`.
    const dbUser = {
      id: s.user.id,
      email: s.user.email,
      name: s.user.name,
      image: s.user.image,
      role: s.user.role,
      isBanned: false,
      avatarUrl: null,
    };
    const out = (await sessionCb!({ session: s, user: dbUser })) as typeof s | null;
    expect(out).not.toBeNull();
    expect(out!.user).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      role: expect.stringMatching(/^(user|admin)$/),
    });
    expect(out!.user.image).toBe('https://example.test/avatar.png');
    // D-08 — is_banned NEVER surfaced on the session payload.
    expect((out!.user as unknown as Record<string, unknown>).is_banned).toBeUndefined();
    expect((out!.user as unknown as Record<string, unknown>).isBanned).toBeUndefined();
  });

  it('session callback mirrors avatarUrl → image when image is null (D-04)', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { callbacks?: { session?: (...a: unknown[]) => unknown } };
    };
    const sessionCb = cfg.authConfig.callbacks?.session;
    const s = fakeSession();
    const dbUser = {
      id: s.user.id,
      email: s.user.email,
      name: s.user.name,
      image: null,
      role: 'user',
      isBanned: false,
      avatarUrl: 'https://example.test/legacy.png',
    };
    const out = (await sessionCb!({ session: s, user: dbUser })) as typeof s | null;
    expect(out!.user.image).toBe('https://example.test/legacy.png');
  });
});
