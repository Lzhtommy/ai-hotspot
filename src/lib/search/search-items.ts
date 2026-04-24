/**
 * searchItems — Quick 260424-ogp.
 *
 * Pure function used by /api/search. Searches published `items` by title,
 * title_zh, and summary_zh via PG ILIKE with a `%term%` pattern, JOINs
 * `sources` for the source name, orders by `published_at DESC`, and limits
 * to 10 rows.
 *
 * Design notes:
 *   - Uses raw `db.execute(sql`...`)` (parameterised via the Drizzle sql
 *     template) so the ILIKE predicate is straightforward to read. The
 *     sidebar dropdown only ever needs <=10 rows, so ranking / pg_trgm
 *     is unnecessary in v1.
 *   - User input is escaped for LIKE wildcards (`%` and `_`) and then
 *     sandwiched with `%...%` to form a substring pattern. Escape char
 *     is `\` (declared via `ESCAPE '\'`).
 *   - Query <2 chars (after trimming) short-circuits to `[]` without
 *     touching the db — the sidebar debounces aggressively, and we do
 *     not want 1-char full-table scans.
 *
 * Consumed by:
 *   - src/app/api/search/route.ts
 */
import { sql, type SQL } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';

export type SearchResultItem = {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  publishedAt: string; // ISO
  sourceName: string | null;
};

export interface SearchItemsDeps {
  /**
   * Drizzle neon-http client. Only `.execute()` is used; typed loosely so
   * tests can pass a `{ execute: vi.fn() }` stand-in.
   */
  db?: Pick<typeof realDb, 'execute'>;
}

/** Escape `%`, `_`, and `\` so user input is matched as literal substring. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

type Row = {
  id: bigint | string | number;
  title: string;
  title_zh: string | null;
  summary_zh: string | null;
  published_at: Date | string;
  source_name: string | null;
};

export async function searchItems(
  rawQuery: string,
  deps: SearchItemsDeps = {},
): Promise<SearchResultItem[]> {
  const db = deps.db ?? realDb;
  const q = (rawQuery ?? '').trim();
  if (q.length < 2) return [];

  const pattern = `%${escapeLikePattern(q)}%`;

  // NOTE: ESCAPE '\' makes the backslash an explicit LIKE escape char so that
  // escapeLikePattern's '\%' / '\_' insertions are interpreted as literals.
  const query: SQL = sql`
    SELECT
      items.id         AS id,
      items.title      AS title,
      items.title_zh   AS title_zh,
      items.summary_zh AS summary_zh,
      items.published_at AS published_at,
      sources.name     AS source_name
    FROM items
    LEFT JOIN sources ON sources.id = items.source_id
    WHERE items.status = 'published'
      AND (
        items.title      ILIKE ${pattern} ESCAPE '\\'
        OR items.title_zh   ILIKE ${pattern} ESCAPE '\\'
        OR items.summary_zh ILIKE ${pattern} ESCAPE '\\'
      )
    ORDER BY items.published_at DESC
    LIMIT 10
  `;

  const res = (await db.execute(query)) as unknown as { rows: Row[] };
  const rows = res.rows ?? [];

  return rows.map((r) => ({
    id: String(r.id),
    title: r.title,
    titleZh: r.title_zh,
    summaryZh: r.summary_zh,
    publishedAt:
      r.published_at instanceof Date ? r.published_at.toISOString() : String(r.published_at),
    sourceName: r.source_name,
  }));
}
