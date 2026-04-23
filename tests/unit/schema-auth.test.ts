// Task 5-01-01 | Plan 05-01 | REQ-AUTH-01 | Threat T-5-01
// Nyquist stub — red until implementation lands.
//
// Asserts Auth.js adapter tables (accounts, sessions, verification_tokens)
// are exported from @/lib/db/schema with the shapes @auth/drizzle-adapter expects.
import { describe, it, expect } from 'vitest';

describe('Phase 5 schema: adapter tables', () => {
  it('TODO[5-01-01]: accounts/sessions/verification_tokens exported from schema.ts', async () => {
    const schema = (await import('@/lib/db/schema')) as Record<string, unknown>;
    expect(schema.accounts, 'accounts table missing').toBeDefined();
    expect(schema.sessions, 'sessions table missing').toBeDefined();
    expect(schema.verificationTokens, 'verificationTokens table missing').toBeDefined();
  });
});
