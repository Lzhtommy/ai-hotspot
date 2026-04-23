// Task 5-01-02 | Plan 05-01 | REQ-AUTH-01
// Asserts users table gains emailVerified + image columns while preserving
// existing columns (id, email, name, avatarUrl, role, isBanned, createdAt, lastSeenAt).
import { describe, it, expect } from 'vitest';
import { users } from '@/lib/db/schema';

describe('Phase 5 users column extension', () => {
  it('users.emailVerified is a timestamp column with withTimezone=true and no default', () => {
    expect(users.emailVerified).toBeDefined();
    // Drizzle column shape: name + columnType
    expect(users.emailVerified.name).toBe('email_verified');
    expect(users.emailVerified.columnType).toBe('PgTimestamp');
    // no default
    expect(users.emailVerified.hasDefault).toBe(false);
    // withTimezone
    // drizzle stores `withTimezone` on the column config
    expect((users.emailVerified as unknown as { withTimezone: boolean }).withTimezone).toBe(true);
    // nullable (no .notNull() in schema)
    expect(users.emailVerified.notNull).toBe(false);
  });

  it('users.image is a text column with no default and nullable', () => {
    expect(users.image).toBeDefined();
    expect(users.image.name).toBe('image');
    expect(users.image.columnType).toBe('PgText');
    expect(users.image.hasDefault).toBe(false);
    expect(users.image.notNull).toBe(false);
  });

  it('existing users columns preserved (id, email, name, avatarUrl, role, isBanned, createdAt, lastSeenAt)', () => {
    expect(users.id).toBeDefined();
    expect(users.id.name).toBe('id');
    expect(users.id.primary).toBe(true);

    expect(users.email).toBeDefined();
    expect(users.email.name).toBe('email');
    expect(users.email.isUnique).toBe(true);
    expect(users.email.notNull).toBe(true);

    expect(users.name).toBeDefined();
    expect(users.name.name).toBe('name');

    expect(users.avatarUrl).toBeDefined();
    expect(users.avatarUrl.name).toBe('avatar_url');

    expect(users.role).toBeDefined();
    expect(users.role.name).toBe('role');
    expect(users.role.notNull).toBe(true);
    expect(users.role.hasDefault).toBe(true);

    expect(users.isBanned).toBeDefined();
    expect(users.isBanned.name).toBe('is_banned');
    expect(users.isBanned.notNull).toBe(true);
    expect(users.isBanned.hasDefault).toBe(true);

    expect(users.createdAt).toBeDefined();
    expect(users.createdAt.name).toBe('created_at');
    expect(users.createdAt.notNull).toBe(true);

    expect(users.lastSeenAt).toBeDefined();
    expect(users.lastSeenAt.name).toBe('last_seen_at');
  });
});
