/**
 * Full-text extraction — Phase 3 LLM-02.
 *
 * Input: RSS body_raw + article URL. Behavior:
 *   - if bodyRaw.length >= threshold (default 500, RESEARCH.md Assumption A10):
 *     return {text: bodyRaw, extracted: false}  (fast path, no HTTP)
 *   - else: fetch URL (SSRF-guarded), run jsdom + @mozilla/readability,
 *     return {text: readability.textContent, extracted: true}
 *   - fetch failure / Readability null / blocked URL: return
 *     {text: bodyRaw, extracted: false}  (Pitfall 3 — never dead-letter here)
 *
 * SSRF mitigation (T-03-01, RESEARCH.md §Known Threat Patterns):
 *   - Scheme whitelist: http, https only
 *   - Host blocklist: RFC1918 ranges (10/8, 172.16/12, 192.168/16), 127/8, localhost, ::1
 *   - 15s timeout (AbortSignal.timeout)
 *   - 2 MB response size cap
 *   - No credentials forwarded (headers: only User-Agent)
 *
 * Consumed by: src/lib/llm/process-item-core.ts
 */

export class ExtractError extends Error {
  constructor(
    message: string,
    public readonly kind: 'fetch' | 'parse' | 'blocked',
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}

const SIZE_CAP_BYTES = 2 * 1024 * 1024;
const DEFAULT_THRESHOLD = 500;

function isPrivateHost(hostname: string): boolean {
  // RFC1918 + loopback + link-local; return true to BLOCK.
  if (hostname === 'localhost' || hostname === '::1') return true;
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true; // link-local
  if (/^fc00:|^fe80:/i.test(hostname)) return true;
  return false;
}

export async function extractFullText(
  bodyRaw: string,
  url: string,
  opts?: { threshold?: number; timeoutMs?: number },
): Promise<{ text: string; extracted: boolean }> {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  if (bodyRaw.length >= threshold) {
    return { text: bodyRaw, extracted: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { text: bodyRaw, extracted: false };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { text: bodyRaw, extracted: false };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { text: bodyRaw, extracted: false };
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 15_000),
      headers: { 'User-Agent': 'ai-hotspot/1.0 (+https://github.com/)' },
      redirect: 'follow',
    });
    if (!res.ok) return { text: bodyRaw, extracted: false };
    const lenHeader = res.headers.get('content-length');
    if (lenHeader && parseInt(lenHeader, 10) > SIZE_CAP_BYTES) {
      return { text: bodyRaw, extracted: false };
    }
    const html = await res.text();
    if (html.length > SIZE_CAP_BYTES) return { text: bodyRaw, extracted: false };

    const { JSDOM } = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article || !article.textContent) {
      return { text: bodyRaw, extracted: false }; // Pitfall 3 — do NOT dead-letter
    }
    return { text: article.textContent, extracted: true };
  } catch {
    // Scrub — never include err.message which may contain URL/headers.
    return { text: bodyRaw, extracted: false };
  }
}
