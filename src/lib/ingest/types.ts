/**
 * Shared ingestion types — Phase 2 D-14.
 *
 * The RssEntry shape is the contract between `parseRSS()` and downstream
 * consumers (Plan 03's `fetch-source` Trigger.dev task). All fields are the
 * minimum Phase 2 persists per D-14; Phase 3 LLM fields (title_zh, summary_zh,
 * etc.) live on the `items` table but are NOT part of the ingest contract.
 */

export interface RssEntry {
  /** Original URL from the RSS entry — NOT yet normalized. Caller normalizes. */
  url: string;
  title: string;
  /** UTC Date parsed from pubDate/dc:date. Falls back to `new Date()` when RSS lacks a date (D-13). */
  publishedAtUtc: Date;
  /** Original RFC3339 offset string preserving source timezone (D-11). Null if RSS lacks date or offset. */
  publishedAtSourceTz: string | null;
  /** Raw HTML from content:encoded (preferred) or description (fallback). Truncated at 50_000 chars with sentinel (D-15). */
  bodyRaw: string;
}
