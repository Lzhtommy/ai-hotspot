// Task 5-02-02 | Plan 05-02 | REQ-AUTH-07 | Threat T-5-03
// Nyquist stub — red until implementation lands.
//
// Asserts `callbacks.session` returns null when users.is_banned = true (D-05 Layer 1).
import { describe, it, expect } from 'vitest';
import { fakeSession } from '../helpers/auth';

describe('ban enforcement — session callback Layer 1', () => {
  it('TODO[5-02-02]: banned user → session callback returns null', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { callbacks?: { session?: (...a: unknown[]) => unknown } };
    };
    const sessionCb = cfg.authConfig.callbacks?.session;
    expect(sessionCb, 'session callback missing').toBeDefined();

    // When the session callback refreshes and finds is_banned=true,
    // it must return null (treating the user as anonymous).
    const s = fakeSession();
    const out = await sessionCb!({
      session: s,
      user: { ...s.user, isBanned: true },
    });
    expect(out).toBeNull();
  });
});
