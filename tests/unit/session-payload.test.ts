// Task 5-02-03 | Plan 05-02 | REQ-AUTH-08
// Nyquist stub — red until implementation lands.
//
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

    const s = fakeSession({ role: 'user' });
    const out = (await sessionCb!({ session: s, user: s.user })) as typeof s | null;
    expect(out).not.toBeNull();
    expect(out!.user).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      role: expect.stringMatching(/^(user|admin)$/),
    });
    expect((out!.user as Record<string, unknown>).is_banned).toBeUndefined();
    expect((out!.user as Record<string, unknown>).isBanned).toBeUndefined();
  });
});
