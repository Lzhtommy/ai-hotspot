/**
 * Plan 06-03 Task 2 — integration test proving banUserCore actually deletes
 * session rows and sets the audit columns against a real Neon dev branch.
 *
 * This test builds its OWN Drizzle client via `neon-serverless` Pool — the same
 * driver shape `src/lib/db/client.ts` uses in production — because our repo's
 * banUserCore relies on `db.transaction(tx => ...)`, and the neon-http helper
 * in tests/helpers/test-db.ts throws on `transaction()` (neon-http does not
 * support transactions). Matching the Pool driver here is what makes the
 * integration test a faithful proof of the production transaction semantics.
 *
 * Threat coverage:
 *   - T-6-32  After ban: zero sessions rows remain for the target user.
 *   - T-6-33  Audit columns populated: is_banned=true, bannedBy=admin.id,
 *             bannedAt non-null (all set by the SAME transaction).
 *   - Unban symmetry: clears ban columns but does NOT recreate sessions.
 *
 * Runs against a real Neon branch ONLY. Skips when DATABASE_URL is the vitest
 * placeholder (localhost) — detected by looking for `.neon.` / `.neon.tech`
 * in the URL or by the RUN_INTEGRATION_DB=1 opt-in. Fail-closed on production:
 * if the URL contains "prod" the Pool constructor never runs.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { banUserCore, unbanUserCore } from '@/lib/admin/users-repo';
import { users, sessions } from '@/lib/db/schema';
import * as schema from '@/lib/db/schema';

const url = process.env.DATABASE_URL ?? '';
const hasRealDb =
  process.env.RUN_INTEGRATION_DB === '1' ||
  url.includes('.neon.') ||
  url.includes('.neon.tech');

// Fail-closed against production — mirror tests/helpers/test-db.ts guard.
const isProd = /prod/i.test(url) || /ep-[a-z0-9-]+-prod/i.test(url);

describe('banUserCore — atomic session revocation (integration)', () => {
  const describeDb = hasRealDb && !isProd ? describe : describe.skip;

  describeDb('with a live Neon branch (Pool driver)', () => {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: url });
    const db = drizzle({ client: pool, schema });

    let adminId: string;
    let targetId: string;

    beforeEach(async () => {
      // Unique suffix prevents collisions when the suite runs in parallel
      // against a shared dev branch.
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const [admin] = await db
        .insert(users)
        .values({ email: `admin-${suffix}@test.local`, role: 'admin' })
        .returning();
      const [target] = await db
        .insert(users)
        .values({ email: `target-${suffix}@test.local`, role: 'user' })
        .returning();
      adminId = admin.id;
      targetId = target.id;

      // Two live sessions for the target user — the ban must delete both.
      await db.insert(sessions).values([
        {
          sessionToken: `tok-${suffix}-1`,
          userId: targetId,
          expires: new Date(Date.now() + 86_400_000),
        },
        {
          sessionToken: `tok-${suffix}-2`,
          userId: targetId,
          expires: new Date(Date.now() + 86_400_000),
        },
      ]);
    });

    afterEach(async () => {
      // sessions ON DELETE CASCADE will clean up when users is deleted, but
      // attempt it defensively in case we somehow got here mid-ban.
      try {
        await db.delete(sessions).where(eq(sessions.userId, targetId));
      } catch {
        /* already gone */
      }
      await db.delete(users).where(eq(users.id, targetId));
      await db.delete(users).where(eq(users.id, adminId));
    });

    afterAll(async () => {
      // Drop the Pool's connections so vitest's worker exits cleanly.
      await pool.end();
    });

    it('ban deletes all sessions rows and sets audit columns atomically', async () => {
      await banUserCore({ targetUserId: targetId, adminUserId: adminId }, { db });

      const [after] = await db.select().from(users).where(eq(users.id, targetId));
      expect(after.isBanned).toBe(true);
      expect(after.bannedBy).toBe(adminId);
      expect(after.bannedAt).toBeInstanceOf(Date);

      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, targetId));
      expect(remainingSessions).toHaveLength(0);
    });

    it('unban clears ban columns but does not restore deleted sessions', async () => {
      await banUserCore({ targetUserId: targetId, adminUserId: adminId }, { db });
      await unbanUserCore({ targetUserId: targetId }, { db });

      const [after] = await db.select().from(users).where(eq(users.id, targetId));
      expect(after.isBanned).toBe(false);
      expect(after.bannedAt).toBeNull();
      expect(after.bannedBy).toBeNull();

      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, targetId));
      expect(remainingSessions).toHaveLength(0);
    });
  });
});
