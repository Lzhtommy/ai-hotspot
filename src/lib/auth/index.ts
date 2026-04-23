/**
 * Auth.js v5 singleton — Phase 5 AUTH-01.
 *
 * Single import surface for the app:
 *   import { auth, signIn, signOut, handlers } from '@/lib/auth';
 *
 * Route handlers also re-export GET/POST for the [...nextauth] route.
 *
 * Consumed by:
 *   - src/app/api/auth/[...nextauth]/route.ts (GET/POST)
 *   - src/lib/auth/session.ts (auth())
 *   - src/server/actions/**  (signIn / signOut / auth)
 */
import NextAuth from 'next-auth';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers;
