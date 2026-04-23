// Task 5-03-02 | Plan 05-03 | REQ-AUTH-02 | Threat T-5-04
//
// Asserts GitHub OAuth provider is:
//   (a) registered in authConfig.providers (id === 'github'),
//   (b) has a profile() function that maps { id, name|login, email, avatar_url }
//       → { id: string, name, email, image } (D-04).
//
// Auth.js provider factories return a config object at the call site; the object
// exposes `.id`, `.type`, and `.profile` (a function). See
// node_modules/@auth/core/providers/github (default export = factory).
import { describe, it, expect } from 'vitest';

type ProfileFn = (p: Record<string, unknown>) => Record<string, unknown>;

type Provider = {
  id?: string;
  type?: string;
  profile?: ProfileFn; // default profile on built-in OAuth providers
  options?: { profile?: ProfileFn }; // user-supplied override lands here
};

// The user-supplied `profile` override from `GitHub({ profile() {...} })` ends
// up at `provider.options.profile`; the built-in default is at `provider.profile`
// (@auth/core only copies user config into `options`). Prefer the override.
function getProfileFn(p: Provider | undefined): ProfileFn | undefined {
  return p?.options?.profile ?? p?.profile;
}

describe('Phase 5 GitHub OAuth provider', () => {
  it('authConfig.providers includes GitHub provider', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Provider[] };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasGithub = providers.some((p) => p?.id === 'github');
    expect(hasGithub, 'github provider missing from authConfig.providers').toBe(true);
  });

  it('GitHub profile() maps { id, name, email, avatar_url } → { id, name, email, image }', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Provider[] };
    };
    const providers = cfg.authConfig.providers ?? [];
    const github = providers.find((p) => p?.id === 'github');
    const profileFn = getProfileFn(github);
    expect(profileFn, 'github provider has no profile() fn').toBeDefined();
    const out = profileFn!({
      id: 42,
      name: 'Alice',
      login: 'alice',
      email: 'a@b.test',
      avatar_url: 'https://avatars.githubusercontent.com/u/42',
    });
    expect(out.id).toBe('42'); // stringified
    expect(out.name).toBe('Alice');
    expect(out.email).toBe('a@b.test');
    expect(out.image).toBe('https://avatars.githubusercontent.com/u/42');
  });

  it('GitHub profile() falls back to login when name is null', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Provider[] };
    };
    const github = (cfg.authConfig.providers ?? []).find((p) => p?.id === 'github');
    const profileFn = getProfileFn(github);
    const out = profileFn!({
      id: 7,
      name: null,
      login: 'bob',
      email: 'b@c.test',
      avatar_url: 'https://avatars.githubusercontent.com/u/7',
    });
    expect(out.name).toBe('bob');
  });
});
