// Task 5-10-01 | Plan 05-10 | REQ-AUTH-08
// Nyquist stub — red until implementation lands.
//
// Asserts next.config includes remotePatterns for OAuth avatar hosts AND
// that .env.example contains every Phase 5 AUTH_* / GITHUB_* / GOOGLE_* / RESEND_* var.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 5 env + remotePatterns', () => {
  it('TODO[5-10-01]: next.config allows github + googleusercontent avatar hosts', async () => {
    const cfgMod = (await import('../../next.config')) as {
      default: {
        images?: { remotePatterns?: Array<{ hostname?: string }> };
      };
    };
    const patterns = cfgMod.default.images?.remotePatterns ?? [];
    const hosts = patterns.map((p) => p.hostname);
    expect(hosts).toContain('avatars.githubusercontent.com');
    expect(hosts).toContain('lh3.googleusercontent.com');
  });

  it('TODO[5-10-01]: .env.example contains all Phase 5 auth vars', () => {
    const envExample = readFileSync(resolve(__dirname, '../../.env.example'), 'utf8');
    const required = [
      'AUTH_SECRET',
      'AUTH_URL',
      'AUTH_REDIRECT_PROXY_URL',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'RESEND_API_KEY',
      'RESEND_FROM',
    ];
    for (const key of required) {
      expect(envExample, `.env.example missing ${key}`).toContain(key);
    }
  });
});
