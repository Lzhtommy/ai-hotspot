/**
 * RSSHub fetch wrapper.
 *
 * Wraps fetch() against the HF Space RSSHub with:
 * - Authenticated URL building (?key=RSSHUB_ACCESS_KEY)
 * - Fire-and-forget warmup to absorb HF Space cold-start (D-05)
 * - 60s timeout budget (D-05 — cold starts take 30-60s)
 * - Sanitized error messages (never logs the access key)
 *
 * Consumed by:
 *   - /api/health (Plan 04) — reachability check
 *   - Phase 2 Trigger.dev ingestion tasks
 *
 * Env vars (D-07): RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY
 */

export class RSSHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'RSSHubError';
  }
}

interface FetchOpts {
  /** Abort after this many ms. Default 60_000 (D-05 cold-start budget). */
  timeoutMs?: number;
  /** Fire a warmup request before the measured request. Default true. */
  warmup?: boolean;
}

/**
 * Fetch a path against the RSSHub HF Space with ACCESS_KEY auth.
 * Path should begin with "/" (e.g., "/" for root, "/rsshub/routes" for a specific route).
 */
export async function fetchRSSHub(path: string, opts: FetchOpts = {}): Promise<Response> {
  // Default timeout 60_000ms (D-05 cold-start budget). Warmup default on.
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const warmup = opts.warmup ?? true;

  const base = process.env.RSSHUB_BASE_URL;
  const key = process.env.RSSHUB_ACCESS_KEY;
  if (!base) throw new RSSHubError('RSSHUB_BASE_URL not set');
  if (!key) throw new RSSHubError('RSSHUB_ACCESS_KEY not set');

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const separator = normalizedPath.includes('?') ? '&' : '?';
  const url = `${base.replace(/\/+$/, '')}${normalizedPath}${separator}key=${encodeURIComponent(key)}`;

  // Fire-and-forget warmup; 5_000ms budget; swallows all errors (D-05, D-15).
  if (warmup) {
    void fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }

  // Measured request honors caller-provided timeoutMs (defaulted 60_000 above).
  // AbortSignal.timeout(60_000) is the D-05 cold-start budget when opts.timeoutMs is undefined.
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'ai-hotspot/1.0 (+https://github.com/)' },
    });
  } catch (err) {
    // Never expose the URL with the key in the error — scrub it.
    throw new RSSHubError(`RSSHub fetch failed: ${err instanceof Error ? err.name : 'unknown'}`);
  }

  if (!res.ok) {
    throw new RSSHubError(`RSSHub returned HTTP ${res.status}`, res.status);
  }

  return res;
}
