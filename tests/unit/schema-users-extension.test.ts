// Task 5-01-02 | Plan 05-01 | REQ-AUTH-01
// Nyquist stub — red until implementation lands.
//
// Asserts users table gains emailVerified + image columns while preserving
// existing columns (id, email, name, avatarUrl, role, isBanned, createdAt, lastSeenAt).
import { describe, it, expect } from 'vitest';
import { users } from '@/lib/db/schema';

describe('Phase 5 users column extension', () => {
  it('TODO[5-01-02]: users.emailVerified column exists', () => {
    // @ts-expect-error — emailVerified not added until Plan 05-01
    expect(users.emailVerified, 'emailVerified column missing').toBeDefined();
  });

  it('TODO[5-01-02]: users.image column exists', () => {
    // @ts-expect-error — image not added until Plan 05-01
    expect(users.image, 'image column missing').toBeDefined();
  });

  it('TODO[5-01-02]: existing users columns preserved (avatarUrl, role, isBanned)', () => {
    expect(users.avatarUrl).toBeDefined();
    expect(users.role).toBeDefined();
    expect(users.isBanned).toBeDefined();
  });
});
