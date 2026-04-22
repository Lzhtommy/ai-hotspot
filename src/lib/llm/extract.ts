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
  // RFC1918 + loopback + link-local + 0.0.0.0 + IPv4-mapped IPv6; return true to BLOCK.
  // Node's URL API normalizes IPv6 literals: strips brackets → "::ffff:a9fe:a9fe" form.
  // Strip brackets so we can match raw IPv6 strings (e.g. "[::1]" → "::1").
  const h = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // link-local IPv4 + AWS/GCP metadata
  if (/^fc00:|^fe80:/i.test(h)) return true; // IPv6 ULA + link-local

  // IPv4-mapped IPv6 in two forms Node may produce:
  //   dotted-decimal: "::ffff:169.254.169.254" (some runtimes)
  //   hex groups:     "::ffff:a9fe:a9fe"       (Node 18+ normalizes to this)
  if (/^::ffff:/i.test(h)) {
    const mapped = h.replace(/^::ffff:/i, '');
    // If it looks like dotted-decimal already, recurse directly.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) return isPrivateHost(mapped);
    // Otherwise convert two hex groups (XXXX:XXXX) to a.b.c.d and recurse.
    const hexMatch = /^([0-9a-f]+):([0-9a-f]+)$/i.exec(mapped);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const dotted = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
      return isPrivateHost(dotted);
    }
  }
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
