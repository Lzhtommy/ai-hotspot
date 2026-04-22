import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('voyage.embed — in-process rate limit + 429 handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  type OkEntry = { kind: 'ok'; embedding: number[] };
  type ErrEntry = { kind: 'err'; status: number; retryAfter?: string };
  type Entry = OkEntry | ErrEntry;

  function mockFetch(sequence: Entry[]): ReturnType<typeof vi.fn> {
    let i = 0;
    return vi.fn(async () => {
      const entry = sequence[i++] ?? sequence[sequence.length - 1];
      if (entry.kind === 'ok') {
        return new Response(
          JSON.stringify({
            data: [{ embedding: entry.embedding, index: 0 }],
            model: 'voyage-3.5',
            usage: { total_tokens: 10 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (entry.retryAfter) {
        headers['retry-after'] = entry.retryAfter;
      }
      return new Response('rate limited', { status: entry.status, headers });
    });
  }

  it('spaces sequential calls by ~VOYAGE_INTERVAL_MS (3 RPM → 20s)', async () => {
    vi.stubEnv('VOYAGE_RPM', '3');
    const fetchMock = mockFetch([
      { kind: 'ok', embedding: new Array(1024).fill(0.1) },
      { kind: 'ok', embedding: new Array(1024).fill(0.2) },
      { kind: 'ok', embedding: new Array(1024).fill(0.3) },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { voyage } = await import('./client');

    // Fire 3 calls concurrently; the limiter should serialize them.
    const p1 = voyage.embed({ input: ['a'], model: 'voyage-3.5', inputType: 'document' });
    const p2 = voyage.embed({ input: ['b'], model: 'voyage-3.5', inputType: 'document' });
    const p3 = voyage.embed({ input: ['c'], model: 'voyage-3.5', inputType: 'document' });

    // First call should fire on the next microtask; the next two must wait.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await Promise.all([p1, p2, p3]);
  });

  it('429 triggers a retry that honors Retry-After', async () => {
    vi.stubEnv('VOYAGE_RPM', '3');
    const fetchMock = mockFetch([
      { kind: 'err', status: 429, retryAfter: '5' },
      { kind: 'ok', embedding: new Array(1024).fill(0.7) },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { voyage } = await import('./client');
    const p = voyage.embed({ input: ['x'], model: 'voyage-3.5', inputType: 'document' });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Retry-After 5s, then ≥20s slot spacing before the retry fetch fires.
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const result = await p;
    expect(result.data[0].embedding).toHaveLength(1024);
  });

  it('exhausted 429 retries throw VoyageRateLimitError', async () => {
    vi.stubEnv('VOYAGE_RPM', '3');
    const fetchMock = mockFetch([
      { kind: 'err', status: 429, retryAfter: '1' },
      { kind: 'err', status: 429, retryAfter: '1' },
      { kind: 'err', status: 429, retryAfter: '1' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { voyage } = await import('./client');
    const p = voyage.embed({ input: ['y'], model: 'voyage-3.5', inputType: 'document' });
    // Capture the rejection immediately so the unhandled-rejection detector never sees it.
    const rejection = p.catch((e: unknown) => e);

    await vi.runAllTimersAsync();
    const err = (await rejection) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VoyageRateLimitError');
  });
});
