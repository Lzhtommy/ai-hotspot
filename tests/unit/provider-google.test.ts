// Task 5-03-03 | Plan 05-03 | REQ-AUTH-04
// Nyquist stub — red until implementation lands.
//
// Asserts Google OAuth provider is registered (secondary; GFW-blocked in CN but required for AUTH-04).
import { describe, it, expect } from 'vitest';

describe('Phase 5 Google OAuth provider', () => {
  it('TODO[5-03-03]: authConfig.providers includes Google provider', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Array<{ id?: string }> };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasGoogle = providers.some((p) => p?.id === 'google');
    expect(hasGoogle, 'google provider missing from authConfig.providers').toBe(true);
  });
});
