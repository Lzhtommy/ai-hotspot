// Task 5-02-01 | Plan 05-02 | REQ-AUTH-01 | Threat T-5-02
// Nyquist stub — red until implementation lands.
//
// Asserts @/lib/auth barrel exports handlers, auth, signIn, signOut, and that
// authConfig in @/lib/auth/config includes the Drizzle adapter + 3 providers.
import { describe, it, expect } from 'vitest';

describe('Phase 5 Auth.js config', () => {
  it('TODO[5-02-01]: @/lib/auth exports handlers/auth/signIn/signOut', async () => {
    const mod = (await import('@/lib/auth' as string)) as Record<string, unknown>;
    expect(mod.handlers).toBeDefined();
    expect(mod.auth).toBeDefined();
    expect(mod.signIn).toBeDefined();
    expect(mod.signOut).toBeDefined();
  });

  it('TODO[5-02-01]: authConfig wires Drizzle adapter + 3 providers', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as { authConfig: unknown };
    expect(cfg.authConfig).toBeDefined();
  });
});
