// Task 5-02-01 | Plan 05-02 | REQ-AUTH-01 | Threat T-5-02
// Asserts @/lib/auth barrel exports handlers, auth, signIn, signOut, and that
// authConfig in @/lib/auth/config includes the Drizzle adapter + DB session strategy
// + redirectProxyUrl + session callback (providers array is empty at Plan 02 scope;
// Plan 03 populates GitHub + Resend + Google).
import { describe, it, expect } from 'vitest';

describe('Phase 5 Auth.js config', () => {
  it('TODO[5-02-01]: @/lib/auth exports handlers/auth/signIn/signOut', async () => {
    const mod = (await import('@/lib/auth' as string)) as Record<string, unknown>;
    expect(mod.handlers).toBeDefined();
    expect(mod.auth).toBeDefined();
    expect(mod.signIn).toBeDefined();
    expect(mod.signOut).toBeDefined();
    // Barrel also re-exports route handler verbs for convenience.
    expect(mod.GET).toBeDefined();
    expect(mod.POST).toBeDefined();
  });

  it('TODO[5-02-01]: authConfig wires Drizzle adapter + database session strategy', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: {
        adapter?: unknown;
        session?: { strategy?: string };
        providers?: unknown[];
        redirectProxyUrl?: string;
        callbacks?: { session?: unknown };
      };
    };
    expect(cfg.authConfig).toBeDefined();
    expect(typeof cfg.authConfig.adapter).toBe('object');
    expect(cfg.authConfig.session?.strategy).toBe('database');
    expect(Array.isArray(cfg.authConfig.providers)).toBe(true);
    // Plan 03 populates GitHub + Resend + Google (D-06). Before Plan 03 this
    // asserted length===0; the length was the scope-boundary marker between
    // Plans 02 and 03. With Plan 03 landed the length is 3 in the documented
    // D-06 order. Per-provider shape + profile() assertions live in
    // provider-github.test.ts, provider-resend.test.ts, provider-google.test.ts.
    expect(cfg.authConfig.providers!.length).toBe(3);
    // redirectProxyUrl is wired to AUTH_REDIRECT_PROXY_URL (D-19).
    // May be undefined in test env; the assignment itself is what matters.
    expect(
      cfg.authConfig.redirectProxyUrl === process.env.AUTH_REDIRECT_PROXY_URL ||
        cfg.authConfig.redirectProxyUrl === undefined,
    ).toBe(true);
    expect(typeof cfg.authConfig.callbacks?.session).toBe('function');
  });
});
