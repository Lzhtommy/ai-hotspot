// Task 5-02-02 | Plan 05-02 | REQ-AUTH-07 | Threat T-5-03
//
// Asserts `callbacks.session` returns null when users.is_banned = true (D-05 Layer 1).
//
// Runs as a unit-style integration test: with database session strategy,
// Auth.js passes the DB user row as the `user` param directly to the callback,
// so we can exercise the full Layer 1 branch without touching Neon. The
// plan explicitly permits this fallback variant when a Neon branch isn't
// available (which is the case in CI / local `pnpm test`).
//
// A separate Neon-branch integration test covering the full Auth.js adapter
// sign-in → session-refresh loop can be added in Plan 05-06 alongside the
// server-action Layer 2 guards.
import { describe, it, expect } from 'vitest';
import { fakeSession } from '../helpers/auth';

describe('ban enforcement — session callback Layer 1 (D-05)', () => {
  it('banned user → session callback returns null', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { callbacks?: { session?: (...a: unknown[]) => unknown } };
    };
    const sessionCb = cfg.authConfig.callbacks?.session;
    expect(sessionCb, 'session callback missing').toBeDefined();

    const s = fakeSession();
    const out = await sessionCb!({
      session: s,
      user: {
        id: s.user.id,
        email: s.user.email,
        name: s.user.name,
        image: s.user.image,
        role: s.user.role,
        avatarUrl: null,
        isBanned: true,
      },
    });
    expect(out).toBeNull();
  });

  it('non-banned user → session callback returns a populated session', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { callbacks?: { session?: (...a: unknown[]) => unknown } };
    };
    const sessionCb = cfg.authConfig.callbacks?.session;
    const s = fakeSession({ role: 'user', image: 'https://example.test/a.png' });
    const out = (await sessionCb!({
      session: s,
      user: {
        id: s.user.id,
        email: s.user.email,
        name: s.user.name,
        image: s.user.image,
        role: s.user.role,
        avatarUrl: null,
        isBanned: false,
      },
    })) as typeof s | null;

    expect(out).not.toBeNull();
    expect(out!.user.id).toBe(s.user.id);
    expect((out!.user as unknown as Record<string, unknown>).role).toBe('user');
    expect(out!.user.image).toBe('https://example.test/a.png');
  });
});
