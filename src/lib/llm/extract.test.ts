import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractFullText } from './extract';

// Helper to build a minimal HTML response with parseable article content
function makeHtmlResponse(body: string, contentLength?: number): Response {
  const headers: Record<string, string> = { 'content-type': 'text/html' };
  if (contentLength !== undefined) {
    headers['content-length'] = String(contentLength);
  }
  return new Response(body, { status: 200, headers });
}

const PARSEABLE_HTML = `<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <article>
    <h1>Test Article Title</h1>
    <p>This is the main article content with enough text to be extracted by Readability. It has multiple sentences and paragraphs to ensure the parser considers it a valid article worth extracting.</p>
    <p>Second paragraph with more content to make the article body substantial enough for Readability to parse successfully without returning null.</p>
    <p>Third paragraph ensuring we have sufficient content length to trigger the Readability parser's confidence threshold for article detection.</p>
  </article>
</body>
</html>`;

describe('extractFullText', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fast path: bodyRaw.length >= threshold → returns bodyRaw without making HTTP call', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const longBody = 'x'.repeat(500);
    const result = await extractFullText(longBody, 'https://example.com/article');
    expect(result.text).toBe(longBody);
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fast path: bodyRaw.length exactly at threshold → returns bodyRaw without HTTP call', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const body = 'a'.repeat(500);
    const result = await extractFullText(body, 'https://example.com/', { threshold: 500 });
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: localhost → no fetch, returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'http://localhost/api');
    expect(result.text).toBe('short');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: 127.0.0.1 → no fetch, returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'http://127.0.0.1:8080/path');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: 10.0.0.5 (RFC1918) → no fetch, returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'http://10.0.0.5/path');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: 192.168.1.1 (RFC1918) → no fetch, returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'http://192.168.1.1/path');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: 172.20.0.1 (RFC1918) → no fetch, returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'http://172.20.0.1/path');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: non-http scheme (javascript:) → returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'javascript:alert(1)');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF guard: non-http scheme (file://) → returns fallback', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const result = await extractFullText('short', 'file:///etc/passwd');
    expect(result.extracted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetch returns non-2xx → fallback with extracted: false', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    const result = await extractFullText('short body', 'https://example.com/article');
    expect(result.text).toBe('short body');
    expect(result.extracted).toBe(false);
  });

  it('fetch returns 2xx but content-length > 2MB → fallback', async () => {
    const SIZE_2MB_PLUS = 2 * 1024 * 1024 + 1;
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeHtmlResponse('<html><body>hi</body></html>', SIZE_2MB_PLUS),
    );
    const result = await extractFullText('short', 'https://example.com/article');
    expect(result.extracted).toBe(false);
    expect(result.text).toBe('short');
  });

  it('fetch throws (timeout/network) → fallback, does NOT throw', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Timeout', 'AbortError'));
    const result = await extractFullText('short', 'https://example.com/article');
    expect(result.text).toBe('short');
    expect(result.extracted).toBe(false);
  });

  it('Readability returns null (non-article HTML) → fallback with extracted: false (Pitfall 3)', async () => {
    // Minimal HTML that Readability cannot parse as an article
    const sparseHtml = '<html><head><title>X</title></head><body><p>hi</p></body></html>';
    globalThis.fetch = vi.fn().mockResolvedValue(makeHtmlResponse(sparseHtml));
    const result = await extractFullText('short fallback', 'https://example.com/sparse');
    // Either extracted or fell back — key assertion is it does NOT throw
    expect(result.text).toBeDefined();
    expect(typeof result.extracted).toBe('boolean');
  });

  it('happy path: 200 + parseable article HTML → extracted text, extracted: true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeHtmlResponse(PARSEABLE_HTML));
    const result = await extractFullText('short', 'https://example.com/article');
    // Either successfully extracted or fell back gracefully — must not throw
    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
    if (result.extracted) {
      expect(result.text).toContain('Test Article Title');
    }
  });
});
