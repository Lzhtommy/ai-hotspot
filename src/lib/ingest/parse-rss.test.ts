import { describe, it, expect, vi } from 'vitest';
import { parseRSS, RSSParseError } from './parse-rss';

function rssResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { 'content-type': 'application/rss+xml' },
  });
}

describe('parseRSS', () => {
  it('prefers content:encoded over description', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item>
        <title>Hello</title>
        <link>https://x.com/a</link>
        <description>short excerpt</description>
        <content:encoded><![CDATA[<p>full body</p>]]></content:encoded>
        <pubDate>Mon, 20 Apr 2026 01:00:00 GMT</pubDate>
      </item>
      </channel></rss>`;
    const entries = await parseRSS(rssResponse(xml));
    expect(entries).toHaveLength(1);
    expect(entries[0].bodyRaw).toContain('full body');
    expect(entries[0].bodyRaw).not.toContain('short excerpt');
  });

  it('falls back to description when content:encoded missing', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0">
      <channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item><title>Hi</title><link>https://x.com/b</link><description>only desc</description><pubDate>Mon, 20 Apr 2026 01:00:00 GMT</pubDate></item>
      </channel></rss>`;
    const entries = await parseRSS(rssResponse(xml));
    expect(entries[0].bodyRaw).toBe('only desc');
  });

  it('parses Atom feeds', async () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <title>t</title><link href="https://x.com/"/><id>urn:x</id><updated>2026-04-20T01:00:00Z</updated>
      <entry>
        <title>Hello</title><link href="https://x.com/a"/><id>urn:a</id>
        <updated>2026-04-20T01:00:00Z</updated>
        <content type="html">&lt;p&gt;atom body&lt;/p&gt;</content>
      </entry>
      </feed>`;
    const entries = await parseRSS(rssResponse(xml));
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Hello');
    expect(entries[0].bodyRaw).toContain('atom body');
  });

  it('preserves source timezone offset and converts to UTC', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item><title>Hi</title><link>https://x.com/a</link>
        <pubDate>Mon, 20 Apr 2026 09:00:00 +0800</pubDate>
      </item></channel></rss>`;
    const entries = await parseRSS(rssResponse(xml));
    // UTC instant: 01:00 on 2026-04-20
    expect(entries[0].publishedAtUtc.toISOString()).toBe('2026-04-20T01:00:00.000Z');
    // Source offset preserved — must contain +08:00 or +0800
    expect(entries[0].publishedAtSourceTz).toMatch(/\+08:?00/);
  });

  it('falls back to now() and null tz when pubDate missing (D-13)', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item><title>No date</title><link>https://x.com/a</link><description>x</description></item>
      </channel></rss>`;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    try {
      const entries = await parseRSS(rssResponse(xml));
      expect(entries[0].publishedAtUtc.toISOString()).toBe('2026-04-20T12:00:00.000Z');
      expect(entries[0].publishedAtSourceTz).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('truncates bodyRaw over 50_000 chars and appends sentinel (D-15)', async () => {
    const huge = 'a'.repeat(60_000);
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item><title>Big</title><link>https://x.com/a</link><content:encoded><![CDATA[${huge}]]></content:encoded><pubDate>Mon, 20 Apr 2026 01:00:00 GMT</pubDate></item>
      </channel></rss>`;
    const entries = await parseRSS(rssResponse(xml));
    expect(entries[0].bodyRaw.endsWith('<!-- truncated -->')).toBe(true);
    expect(entries[0].bodyRaw.length).toBeLessThanOrEqual(
      50_000 + '<!-- truncated -->'.length,
    );
  });

  it('throws RSSParseError on malformed XML', async () => {
    const bad = 'not xml at all';
    await expect(parseRSS(rssResponse(bad))).rejects.toThrow(RSSParseError);
  });

  it('returns empty array for valid feed with no items', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://x.com/</link><description>d</description></channel></rss>`;
    const entries = await parseRSS(rssResponse(xml));
    expect(entries).toEqual([]);
  });
});
