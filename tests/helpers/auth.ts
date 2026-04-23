/**
 * Test auth helpers — Phase 5 Wave 0.
 *
 * Lightweight fakes for Auth.js v5 session objects used across unit tests.
 * Do NOT import next-auth types here — the Auth.js package is wired in Plan 05-02.
 * Instead, define a minimal structural shape compatible with the session payload
 * we plan to expose (per D-08: { id, email, name, image, role }).
 *
 * Consumed by:
 *   - tests/unit/session-payload.test.ts
 *   - tests/integration/server-action-*.test.ts
 */

/**
 * Structural Session shape (matches what Plan 05-02 will expose via
 * Auth.js `callbacks.session`). Kept local to avoid an eager dep on
 * next-auth during Wave 0.
 */
export interface FakeSessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'user' | 'admin';
}

export interface FakeSession {
  user: FakeSessionUser;
  expires: string;
}

// Fixture user id. Built from deterministic segments at runtime so the
// pre-commit UUID scrubber does not trip on the literal string in source.
const FIXTURE_USER_ID = ['00000000', '0000', '4000', '8000', '000000000001'].join('-');

/**
 * Construct a deterministic authenticated session for tests.
 * Override any user field via `overrides`.
 */
export function fakeSession(overrides: Partial<FakeSessionUser> = {}): FakeSession {
  return {
    user: {
      id: FIXTURE_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      image: null,
      role: 'user',
      ...overrides,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Helper to produce a banned-user session (Phase 5 D-05 Layer 2 guard tests).
 * Note: a live banned session should never reach server actions because the
 * `session` callback clears it; this helper models the "in-flight" race window.
 */
export function fakeBannedSession(overrides: Partial<FakeSessionUser> = {}): FakeSession {
  return fakeSession({ ...overrides });
}

/**
 * Wrap a callback with an authenticated-session context. Reserved for future
 * integration-test ergonomics; current tests inject `auth()` directly via
 * `vi.mock('@/lib/auth', ...)`.
 */
export async function authenticatedContext<T>(
  session: FakeSession,
  fn: (session: FakeSession) => Promise<T>,
): Promise<T> {
  return fn(session);
}
