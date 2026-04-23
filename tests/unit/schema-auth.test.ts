// Task 5-01-01 | Plan 05-01 | REQ-AUTH-01 | Threat T-5-01
// Asserts Auth.js adapter tables (accounts, sessions, verification_tokens)
// are exported from @/lib/db/schema with the shapes @auth/drizzle-adapter expects.
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Phase 5 schema: adapter tables', () => {
  it('accounts / sessions / verificationTokens are exported from schema.ts', async () => {
    const schema = (await import('@/lib/db/schema')) as Record<string, unknown>;
    expect(schema.accounts, 'accounts table missing').toBeDefined();
    expect(schema.sessions, 'sessions table missing').toBeDefined();
    expect(schema.verificationTokens, 'verificationTokens table missing').toBeDefined();
  });

  it('accounts has uuid userId FK to users.id with cascade delete', async () => {
    const { accounts, users } = await import('@/lib/db/schema');
    const cfg = getTableConfig(accounts);

    const userId = cfg.columns.find((c) => c.name === 'userId');
    expect(userId, 'accounts.userId missing').toBeDefined();
    expect(userId!.columnType).toBe('PgUUID');
    expect(userId!.notNull).toBe(true);

    const fks = cfg.foreignKeys;
    expect(fks.length, 'accounts should have at least one FK').toBeGreaterThan(0);
    const userFk = fks.find((fk) => {
      const ref = fk.reference();
      return ref.foreignTable === users;
    });
    expect(userFk, 'accounts → users FK missing').toBeDefined();
    expect(userFk!.onDelete).toBe('cascade');
  });

  it('accounts has composite PK on (provider, providerAccountId)', async () => {
    const { accounts } = await import('@/lib/db/schema');
    const cfg = getTableConfig(accounts);
    expect(cfg.primaryKeys.length).toBe(1);
    const pk = cfg.primaryKeys[0];
    const pkColNames = pk.columns.map((c) => c.name).sort();
    expect(pkColNames).toEqual(['provider', 'providerAccountId'].sort());
  });

  it('sessions.sessionToken is primary key (text) and userId is uuid FK cascade', async () => {
    const { sessions, users } = await import('@/lib/db/schema');
    const cfg = getTableConfig(sessions);

    const sessionToken = cfg.columns.find((c) => c.name === 'sessionToken');
    expect(sessionToken).toBeDefined();
    expect(sessionToken!.columnType).toBe('PgText');
    expect(sessionToken!.primary).toBe(true);

    const userId = cfg.columns.find((c) => c.name === 'userId');
    expect(userId).toBeDefined();
    expect(userId!.columnType).toBe('PgUUID');
    expect(userId!.notNull).toBe(true);

    const fks = cfg.foreignKeys;
    const userFk = fks.find((fk) => fk.reference().foreignTable === users);
    expect(userFk, 'sessions → users FK missing').toBeDefined();
    expect(userFk!.onDelete).toBe('cascade');

    const expires = cfg.columns.find((c) => c.name === 'expires');
    expect(expires).toBeDefined();
    expect(expires!.notNull).toBe(true);
  });

  it('verificationTokens has composite PK on (identifier, token)', async () => {
    const { verificationTokens } = await import('@/lib/db/schema');
    const cfg = getTableConfig(verificationTokens);
    expect(cfg.primaryKeys.length).toBe(1);
    const pk = cfg.primaryKeys[0];
    const pkColNames = pk.columns.map((c) => c.name).sort();
    expect(pkColNames).toEqual(['identifier', 'token']);

    const ident = cfg.columns.find((c) => c.name === 'identifier');
    expect(ident!.columnType).toBe('PgText');
    expect(ident!.notNull).toBe(true);
    const token = cfg.columns.find((c) => c.name === 'token');
    expect(token!.columnType).toBe('PgText');
    expect(token!.notNull).toBe(true);
    const expires = cfg.columns.find((c) => c.name === 'expires');
    expect(expires!.notNull).toBe(true);
  });

  it('verification_tokens SQL table name is snake_case (contract with @auth/drizzle-adapter standard)', async () => {
    const { verificationTokens } = await import('@/lib/db/schema');
    const cfg = getTableConfig(verificationTokens);
    expect(cfg.name).toBe('verification_tokens');
  });
});
