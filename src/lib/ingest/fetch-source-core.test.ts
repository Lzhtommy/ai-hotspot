import { describe, it, expect } from 'vitest';
import { runFetchSource } from './fetch-source-core';

// Helper: build a minimal db mock that records calls.
function makeDbMock(insertBehavior: 'new' | 'conflict' | 'mixed' = 'new') {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const insertChain = {
    values: (v: Record<string, unknown>) => {
      inserts.push(v);
      return insertChain;
    },
    onConflictDoNothing: () => insertChain,
    returning: () => {
      if (insertBehavior === 'new') return Promise.resolve([{ id: BigInt(1) }]);
      if (insertBehavior === 'conflict') return Promise.resolve([]);
      // mixed: alternate — first insert wins, second conflicts
      return Promise.resolve(inserts.length === 1 ? [{ id: BigInt(1) }] : []);
    },
  };

  const updateChain = {
    set: (v: Record<string, unknown>) => {
      updates.push(v);
      return updateChain;
    },
    where: () => Promise.resolve(),
  };

  return {
    db: {
      insert: () => insertChain,
      update: () => updateChain,
    },
    inserts,
    updates,
  };
}

function rssResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { 'content-type': 'application/rss+xml' },
  });
}

const sampleFeedXml = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel><title>t</title><link>https://x.com/</link><description>d</description>
  <item><title>A</title><link>https://x.com/a</link><pubDate>Mon, 20 Apr 2026 01:00:00 GMT</pubDate><content:encoded><![CDATA[body a]]></content:encoded></item>
  <item><title>B</title><link>https://x.com/b</link><pubDate>Mon, 20 Apr 2026 02:00:00 GMT</pubDate><content:encoded><![CDATA[body b]]></content:encoded></item>
  </channel></rss>`;

const emptyFeedXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://x.com/</link><description>d</description></channel></rss>`;
const malformedXml = 'not xml at all';

describe('runFetchSource', () => {
  it('happy path: 2 new items → status ok, newCount 2, counters reset, last_fetched_at set', async () => {
    const { db, inserts, updates } = makeDbMock('new');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/some/route',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(sampleFeedXml),
        now: () => new Date('2026-04-20T12:00:00Z'),
      },
    });
    expect(res).toEqual({ sourceId: 42, status: 'ok', newCount: 2, seenCount: 0 });
    expect(inserts).toHaveLength(2);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      consecutiveEmptyCount: 0,
      consecutiveErrorCount: 0,
    });
    expect((updates[0] as { lastFetchedAt: unknown }).lastFetchedAt).toBeInstanceOf(Date);
  });

  it('0 new items (all conflict): consecutive_empty +=1, error resets to 0, last_fetched_at set', async () => {
    const { db, inserts, updates } = makeDbMock('conflict');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(sampleFeedXml),
        now: () => new Date('2026-04-20T12:00:00Z'),
      },
    });
    expect(res.status).toBe('ok');
    expect(res.newCount).toBe(0);
    expect(res.seenCount).toBe(2);
    expect(inserts).toHaveLength(2);
    expect(updates).toHaveLength(1);
    // D-08: empty count is INCREMENTED (via SQL expression — test by snapshot of keys used)
    expect(Object.keys(updates[0])).toEqual(
      expect.arrayContaining(['consecutiveEmptyCount', 'consecutiveErrorCount', 'lastFetchedAt']),
    );
  });

  it('empty feed: treated as success with 0 new items', async () => {
    const { db, updates } = makeDbMock('new');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(emptyFeedXml),
        now: () => new Date('2026-04-20T12:00:00Z'),
      },
    });
    expect(res.status).toBe('ok');
    expect(res.newCount).toBe(0);
    expect(res.seenCount).toBe(0);
    expect(updates).toHaveLength(1);
  });

  it('fetch error: counter increment for error only; last_fetched_at NOT updated', async () => {
    const { db, updates } = makeDbMock('new');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => {
          throw new Error('network boom');
        },
        now: () => new Date('2026-04-20T12:00:00Z'),
      },
    });
    expect(res.status).toBe('error');
    expect(res.newCount).toBe(0);
    expect(res.errorKind).toBeDefined();
    expect(updates).toHaveLength(1);
    // D-08 critical: on error, lastFetchedAt MUST NOT be in the set payload.
    expect(Object.keys(updates[0])).not.toContain('lastFetchedAt');
    expect(Object.keys(updates[0])).toContain('consecutiveErrorCount');
    expect(Object.keys(updates[0])).not.toContain('consecutiveEmptyCount');
  });

  it('parse error: same counter behavior as fetch error', async () => {
    const { db, updates } = makeDbMock('new');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(malformedXml),
        now: () => new Date('2026-04-20T12:00:00Z'),
      },
    });
    expect(res.status).toBe('error');
    expect(Object.keys(updates[0])).not.toContain('lastFetchedAt');
  });

  it('mixed: 1 new, 1 conflict → newCount 1, counters reset (≥1 new path)', async () => {
    const { db } = makeDbMock('mixed');
    const res = await runFetchSource({
      sourceId: 42,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(sampleFeedXml),
        now: () => new Date(),
      },
    });
    expect(res.newCount).toBe(1);
    expect(res.seenCount).toBe(1);
  });

  it('persists all D-14 required fields on insert', async () => {
    const { db, inserts } = makeDbMock('new');
    await runFetchSource({
      sourceId: 7,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(sampleFeedXml),
        now: () => new Date(),
      },
    });
    for (const row of inserts) {
      expect(row).toMatchObject({
        sourceId: 7,
        url: expect.any(String),
        urlFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        title: expect.any(String),
        bodyRaw: expect.any(String),
        status: 'pending',
        retryCount: 0,
      });
      // publishedAt must be a Date; publishedAtSourceTz may be null or string
      expect(row.publishedAt).toBeInstanceOf(Date);
    }
  });

  it('url stored is the normalized form (not the raw RSS link)', async () => {
    const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://x.com/</link><description>d</description>
      <item><title>A</title><link>HTTP://Example.COM/a/?utm_source=rss#hash</link><pubDate>Mon, 20 Apr 2026 01:00:00 GMT</pubDate><description>x</description></item>
      </channel></rss>`;
    const { db, inserts } = makeDbMock('new');
    await runFetchSource({
      sourceId: 1,
      rssUrl: '/r',
      deps: {
        db: db as never,
        fetchRSSHub: async () => rssResponse(feed),
        now: () => new Date(),
      },
    });
    expect(inserts[0].url).toBe('https://example.com/a');
  });
});
