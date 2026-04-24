/**
 * GET /api/search?q=... — Quick 260424-ogp.
 *
 * Returns up to 10 published items whose title / title_zh / summary_zh
 * substring-matches the query. Delegates to src/lib/search/search-items.ts.
 *
 * Runtime MUST be nodejs — the Neon HTTP driver needs Node globals.
 * Marked `force-dynamic` because the response depends on a query param and
 * there is no ISR win for per-keystroke searches.
 *
 * Response shape:
 *   { items: SearchResultItem[] }
 *
 * Consumed by:
 *   - src/components/layout/sidebar-search.tsx
 */
import { searchItems } from '@/lib/search/search-items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';

  try {
    const items = await searchItems(q);
    return Response.json({ items }, { status: 200 });
  } catch (err) {
    // Never leak driver errors to the client.
    const message = err instanceof Error ? err.name : 'Search failed';
    return Response.json({ items: [], error: message }, { status: 500 });
  }
}
