/**
 * E2E test fixture — retrieves a sample published item ID from the DB.
 *
 * Used by specs that need a real /items/[id] URL to test against.
 * Returns null when the DB has no published items (specs should skip via test.skip).
 */
import { db } from '@/lib/db/client';
import { items } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getSamplePublishedItemId(): Promise<string | null> {
  const rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.status, 'published'))
    .limit(1);
  return rows[0] ? String(rows[0].id) : null;
}
