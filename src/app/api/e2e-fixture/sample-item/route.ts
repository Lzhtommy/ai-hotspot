/**
 * E2E test fixture endpoint — returns a sample published item ID for Playwright specs.
 *
 * Only returns data in non-production environments (NODE_ENV !== 'production').
 * Used by tests/e2e/fixtures/items.ts to avoid importing the DB client in
 * Playwright worker processes (which don't have DATABASE_URL in scope).
 *
 * Consumed by:
 *   - tests/e2e/fixtures/items.ts (E2E test fixture helper)
 */
import { db } from '@/lib/db/client';
import { items } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Only expose in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.status, 'published'))
      .limit(1);

    if (!rows[0]) {
      return Response.json({ id: null }, { status: 200 });
    }

    return Response.json({ id: String(rows[0].id) }, { status: 200 });
  } catch (e) {
    // DB unavailable — return null so specs skip gracefully
    const msg = e instanceof Error ? e.message : 'db error';
    return Response.json({ id: null, error: msg }, { status: 200 });
  }
}
