// Task 6-01-01 | Plan 06-01 | Phase 6 admin + ops schema extensions.
// Asserts sources gains deletedAt + category, users gains bannedAt + bannedBy
// (all nullable, no default). Also asserts the drizzle journal was advanced
// with the 0005_admin_ops entry so `db:migrate` has a migration to apply.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sources, users } from '@/lib/db/schema';

describe('Phase 6 admin + ops schema extensions', () => {
  describe('sources', () => {
    it('sources.deletedAt is a nullable timestamptz column with no default', () => {
      expect(sources.deletedAt).toBeDefined();
      expect(sources.deletedAt.name).toBe('deleted_at');
      expect(sources.deletedAt.columnType).toBe('PgTimestamp');
      expect(sources.deletedAt.hasDefault).toBe(false);
      expect(sources.deletedAt.notNull).toBe(false);
      expect((sources.deletedAt as unknown as { withTimezone: boolean }).withTimezone).toBe(true);
    });

    it('sources.category is a nullable text column with no default', () => {
      expect(sources.category).toBeDefined();
      expect(sources.category.name).toBe('category');
      expect(sources.category.columnType).toBe('PgText');
      expect(sources.category.hasDefault).toBe(false);
      expect(sources.category.notNull).toBe(false);
    });
  });

  describe('users', () => {
    it('users.bannedAt is a nullable timestamptz column with no default', () => {
      expect(users.bannedAt).toBeDefined();
      expect(users.bannedAt.name).toBe('banned_at');
      expect(users.bannedAt.columnType).toBe('PgTimestamp');
      expect(users.bannedAt.hasDefault).toBe(false);
      expect(users.bannedAt.notNull).toBe(false);
      expect((users.bannedAt as unknown as { withTimezone: boolean }).withTimezone).toBe(true);
    });

    it('users.bannedBy is a nullable uuid column with no default (FK enforced in SQL migration)', () => {
      expect(users.bannedBy).toBeDefined();
      expect(users.bannedBy.name).toBe('banned_by');
      expect(users.bannedBy.columnType).toBe('PgUUID');
      expect(users.bannedBy.hasDefault).toBe(false);
      expect(users.bannedBy.notNull).toBe(false);
    });
  });

  describe('drizzle journal', () => {
    it('includes the 0005_admin_ops migration entry at idx 5', () => {
      const journalPath = resolve(process.cwd(), 'drizzle/meta/_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
        entries: Array<{ idx: number; tag: string; breakpoints: boolean; version: string }>;
      };
      const entry = journal.entries.find((e) => e.tag === '0005_admin_ops');
      expect(entry).toBeDefined();
      expect(entry?.idx).toBe(5);
      expect(entry?.breakpoints).toBe(true);
    });
  });

  describe('drizzle SQL migration file', () => {
    const migrationPath = resolve(process.cwd(), 'drizzle/0005_admin_ops.sql');
    const content = (() => {
      try {
        return readFileSync(migrationPath, 'utf8');
      } catch {
        return '';
      }
    })();

    it('contains idempotent ADD COLUMN for sources.deleted_at', () => {
      expect(content).toMatch(/ADD COLUMN IF NOT EXISTS deleted_at/);
    });

    it('contains idempotent ADD COLUMN for sources.category', () => {
      expect(content).toMatch(/ADD COLUMN IF NOT EXISTS category/);
    });

    it('contains idempotent ADD COLUMN for users.banned_at', () => {
      expect(content).toMatch(/ADD COLUMN IF NOT EXISTS banned_at/);
    });

    it('contains idempotent ADD COLUMN for users.banned_by', () => {
      expect(content).toMatch(/ADD COLUMN IF NOT EXISTS banned_by/);
    });

    it('defines users_banned_by_fk self-referencing FK with ON DELETE SET NULL', () => {
      expect(content).toMatch(/users_banned_by_fk/);
      expect(content).toMatch(/ON DELETE SET NULL/);
    });

    it('creates sources_deleted_at_idx index for soft-delete queries', () => {
      expect(content).toMatch(/sources_deleted_at_idx/);
    });
  });
});
