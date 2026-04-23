// Task 5-03-01 | Plan 05-03 | REQ-AUTH-02 | Threat T-5-04
// Nyquist stub — red until implementation lands.
//
// Asserts GitHub OAuth provider is registered in authConfig with the profile→users
// mapping that mirrors image to avatar_url (D-04).
import { describe, it, expect } from 'vitest';

describe('Phase 5 GitHub OAuth provider', () => {
  it('TODO[5-03-01]: authConfig.providers includes GitHub provider', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Array<{ id?: string }> };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasGithub = providers.some((p) => p?.id === 'github');
    expect(hasGithub, 'github provider missing from authConfig.providers').toBe(true);
  });
});
