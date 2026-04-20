/**
 * URL normalization for dedup — Phase 2 D-04.
 *
 * Rules (medium profile):
 *   1. Force scheme to https
 *   2. Lowercase host
 *   3. Strip tracking query params (case-insensitive match on key)
 *   4. Drop #fragment
 *   5. Strip trailing / when path.length > 1
 *
 * Pure — no network I/O. Used for `items.url_fingerprint` (D-05) and `items.url` (D-16).
 *
 * Consumed by:
 *   - src/trigger/fetch-source.ts (Plan 03)
 *   - src/lib/ingest/fingerprint.ts (via composition in fetch-source)
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'spm',
]);

export class UrlNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlNormalizationError';
  }
}

export function normalizeUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new UrlNormalizationError(`Invalid URL: ${input.slice(0, 80)}`);
  }

  if (u.protocol === 'http:') u.protocol = 'https:';
  u.host = u.host.toLowerCase();

  // Strip tracking params — case-insensitive on key.
  const toDelete: string[] = [];
  for (const key of u.searchParams.keys()) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) toDelete.push(key);
  }
  for (const k of toDelete) u.searchParams.delete(k);

  u.hash = '';

  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}
