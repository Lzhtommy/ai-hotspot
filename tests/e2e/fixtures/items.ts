/**
 * E2E test fixture — retrieves a sample published item ID.
 *
 * Used by specs that need a real /items/[id] URL to test against.
 * Returns null when no published items are available (specs should skip via test.skip).
 *
 * Fetches from the running dev server's /api/e2e-fixture endpoint rather than
 * importing the DB client directly (Playwright workers run outside the Next.js
 * server process and don't have DATABASE_URL available).
 */

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

export async function getSamplePublishedItemId(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/e2e-fixture/sample-item`);
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    // Server not reachable or endpoint doesn't exist — skip tests that need an item
    return null;
  }
}
