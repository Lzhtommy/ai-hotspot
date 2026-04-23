// Task 5-03-02 | Plan 05-03 | REQ-AUTH-04
//
// Asserts Google OAuth provider is registered (secondary provider per D-06;
// GFW-blocked in mainland China but required by AUTH-04) with a profile() fn
// that maps { sub, name, email, picture } → { id, name, email, image } (D-04).
import { describe, it, expect } from 'vitest';

type ProfileFn = (p: Record<string, unknown>) => Record<string, unknown>;

type Provider = {
  id?: string;
  type?: string;
  profile?: ProfileFn; // default (OAuth providers only; Google OIDC has none)
  options?: { profile?: ProfileFn }; // user-supplied override lands here
};

// Google is an OIDC provider — @auth/core Google factory has no default
// `profile`; the user-supplied override from `Google({ profile() {...} })`
// is at `provider.options.profile`.
function getProfileFn(p: Provider | undefined): ProfileFn | undefined {
  return p?.options?.profile ?? p?.profile;
}

describe('Phase 5 Google OAuth provider', () => {
  it('authConfig.providers includes Google provider', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Provider[] };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasGoogle = providers.some((p) => p?.id === 'google');
    expect(hasGoogle, 'google provider missing from authConfig.providers').toBe(true);
  });

  it('Google profile() maps { sub, name, email, picture } → { id, name, email, image }', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Provider[] };
    };
    const providers = cfg.authConfig.providers ?? [];
    const google = providers.find((p) => p?.id === 'google');
    const profileFn = getProfileFn(google);
    expect(profileFn, 'google provider has no profile() fn').toBeDefined();
    const out = profileFn!({
      sub: 'google-user-sub-123',
      name: 'Grace',
      email: 'g@m.test',
      picture: 'https://lh3.googleusercontent.com/a/g',
    });
    expect(out.id).toBe('google-user-sub-123');
    expect(out.name).toBe('Grace');
    expect(out.email).toBe('g@m.test');
    expect(out.image).toBe('https://lh3.googleusercontent.com/a/g');
  });
});
