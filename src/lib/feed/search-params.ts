/**
 * nuqs search-params cache singleton for the /all feed page.
 *
 * Provides type-safe URL search param parsing for:
 *   - page: integer (default 1)
 *   - tags: string array (default [])
 *   - source: string (default '')
 *
 * Consumed by:
 *   - src/app/(reader)/all/page.tsx (server-side via feedParamsCache.parse)
 *   - src/components/feed/feed-top-bar.tsx (client-side via nuqs hooks)
 */
import { createSearchParamsCache, parseAsArrayOf, parseAsInteger, parseAsString } from 'nuqs/server';

export const feedParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  source: parseAsString.withDefault(''),
});
