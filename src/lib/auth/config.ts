/**
 * Auth.js v5 configuration — Phase 5 AUTH-01..08, D-01..D-21.
 *
 * Exports `authConfig` (adapter, session, callbacks, events).
 * Database session strategy (D-03) with two-layer ban enforcement (D-05 Layer 1).
 * Providers are registered in Plan 03 (src/lib/auth/providers.ts merges into this
 * file's providers array via an intermediate helper or direct edit).
 *
 * Consumed by:
 *   - src/lib/auth/index.ts (NextAuth(authConfig) → handlers/auth/signIn/signOut)
 *   - src/app/api/auth/[...nextauth]/route.ts (handlers.GET/POST)
 *   - tests/unit/auth-config.test.ts (shape assertions)
 *   - tests/unit/session-payload.test.ts (callback shape)
 *   - tests/integration/ban-enforcement.test.ts (D-05 Layer 1)
 */
import type { NextAuthConfig } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'database' },
  // D-19 — preview OAuth callback proxy. Auth.js v5 also auto-picks
  // AUTH_REDIRECT_PROXY_URL from env; explicit assignment documents the wiring.
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL,
  providers: [], // Plan 03 populates GitHub + Resend + Google
  callbacks: {
    // D-05 Layer 1 + D-08 — ban check + session payload shaping.
    // With database strategy, `user` is the DB row (users.*).
    async session({ session, user }) {
      const u = user as unknown as {
        id: string;
        role?: string;
        image?: string | null;
        avatarUrl?: string | null;
        isBanned?: boolean;
      };
      // D-05 Layer 1 — banned users: return null to clear the session.
      if (u.isBanned) {
        return null as unknown as typeof session;
      }
      // D-08 — expose id, role, image (mirrored from avatarUrl when null).
      // NOTE: intentionally do NOT propagate isBanned onto session.user.
      if (session.user) {
        const target = session.user as unknown as Record<string, unknown>;
        target.id = u.id;
        target.role = u.role ?? 'user';
        session.user.image = u.image ?? u.avatarUrl ?? null;
      }
      return session;
    },
  },
  events: {
    // D-09 — touch last_seen_at only on sign-in (not every request).
    async signIn({ user }) {
      if (user?.id) {
        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
      }
    },
    // D-04 — mirror OAuth avatar into users.avatar_url so Phase 4 UI code keeps working.
    async linkAccount({ user, profile }) {
      const image =
        (profile as Record<string, unknown> | undefined)?.avatar_url ??
        (profile as Record<string, unknown> | undefined)?.picture;
      if (image && user?.id && typeof image === 'string') {
        await db.update(users).set({ avatarUrl: image }).where(eq(users.id, user.id));
      }
    },
  },
} satisfies NextAuthConfig;
