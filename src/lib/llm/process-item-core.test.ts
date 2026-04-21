import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod/v4';
import { runProcessItem } from './process-item-core';
import { EnrichError } from './enrich';
import { EmbedError } from './embed';

// Helper: build a minimal db mock that records calls.
// Extends the makeDbMock factory pattern from src/lib/ingest/fetch-source-core.test.ts.
function makeDbMock(itemRow?: Partial<{
  id: bigint;
  title: string;
  bodyRaw: string;
  url: string;
  publishedAt: Date;
  retryCount: number;
  sourceLang: string;
}>) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  const row = {
    id: BigInt(1),
    title: 'Test Article Title',
    bodyRaw: 'Test body content that is long enough',
    url: 'https://example.com/article',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    retryCount: 0,
    sourceLang: 'en',
    ...itemRow,
  };

  const selectChain = {
    from: () => selectChain,
    leftJoin: () => selectChain,
    where: () => Promise.resolve([row]),
  };

  const insertChain = {
    values: (v: Record<string, unknown>) => {
      inserts.push(v);
      return insertChain;
    },
    onConflictDoNothing: () => insertChain,
    returning: () => Promise.resolve([{ id: BigInt(1) }]),
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
      select: () => selectChain,
      insert: () => insertChain,
      update: () => updateChain,
    } as never,
    updates,
    inserts,
  };
}

// Mock dependencies
const mockEnrichOk = vi.fn().mockResolvedValue({
  enrichment: {
    title_zh: '测试标题',
    summary_zh: '这是一个测试摘要,包含足够的内容以满足最小长度要求。',
    score: 75,
    recommendation: '值得关注的技术更新',
    tags: ['模型发布', 'Anthropic'],
  },
  usage: {
    input_tokens: 500,
    output_tokens: 150,
    cache_read_input_tokens: 400,
    cache_creation_input_tokens: 0,
  },
  latencyMs: 123,
});

const mockExtractOk = vi.fn().mockResolvedValue({ text: 'extracted text', extracted: true });
const mockEmbedOk = vi.fn().mockResolvedValue(new Array(1024).fill(0.5));
const mockJoinOk = vi.fn().mockResolvedValue({ clusterId: BigInt(42), joined: true });

describe('runProcessItem', () => {
  it('happy path: published status, clusterId set, 1 item update + 2 pipeline_runs inserts', async () => {
    const { db, updates, inserts } = makeDbMock();

    const result = await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichOk,
        embedDocument: mockEmbedOk,
        joinOrCreateCluster: mockJoinOk,
        now: () => new Date('2026-01-01T12:00:00Z'),
      },
    });

    expect(result.status).toBe('published');
    expect(result.clusterId).toBe('42');
    expect(result.joinedExistingCluster).toBe(true);

    // 1 update to items (set published state)
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'published' });

    // 2 pipeline_runs inserts (enrich + embed)
    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toMatchObject({ task: 'enrich', status: 'ok' });
    expect(inserts[1]).toMatchObject({ task: 'embed', status: 'ok' });
  });

  it('LLM-10: ZodError from enrich → status=dead_letter, failureReason set, NOT published', async () => {
    const { db, updates, inserts } = makeDbMock();
    const zodErr = new ZodError([]);
    const mockEnrichZodFail = vi.fn().mockRejectedValue(zodErr);

    const result = await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichZodFail,
        embedDocument: mockEmbedOk,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    expect(result.status).toBe('dead_letter');
    expect(result.failureReason).toBeDefined();
    expect(result.failureReason).not.toBe('');
    // 1 update to set dead_letter
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'dead_letter' });
    // 1 pipeline_runs insert with status=error
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ status: 'error' });
  });

  it('LLM-11 terminal: retryCount=2 + transient error → dead_letter (retriesExhausted)', async () => {
    const { db, updates } = makeDbMock({ retryCount: 2 });
    const transientErr = new Error('ECONNRESET network failure');
    transientErr.name = 'NetworkError';
    const mockEnrichTransient = vi.fn().mockRejectedValue(transientErr);

    const result = await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichTransient,
        embedDocument: mockEmbedOk,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    expect(result.status).toBe('dead_letter');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'dead_letter' });
  });

  it('LLM-11 retryable: retryCount=0 + transient error → rethrows, updates retry_count', async () => {
    const { db, updates } = makeDbMock({ retryCount: 0 });
    const transientErr = new Error('upstream timeout');
    transientErr.name = 'TimeoutError';
    const mockEnrichRetryable = vi.fn().mockRejectedValue(transientErr);

    await expect(
      runProcessItem({
        itemId: BigInt(1),
        deps: {
          db,
          extractFullText: mockExtractOk,
          enrichWithClaude: mockEnrichRetryable,
          embedDocument: mockEmbedOk,
          joinOrCreateCluster: mockJoinOk,
        },
      }),
    ).rejects.toThrow('upstream timeout');

    // Must have updated retry_count (but NOT set status to dead_letter)
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty('status');
    expect(updates[0]).toMatchObject({ retryCount: 1 });
  });

  it('secret scrub: API key in error message → failureReason does NOT contain key material', async () => {
    // Use retryCount=2 (exhausted) so the error path writes dead_letter and we can inspect failureReason
    const { db, updates } = makeDbMock({ retryCount: 2 });
    const leakyErr = new Error('sk-ant-xxxxxxxx authentication failed pa-secret-key');
    leakyErr.name = 'AuthenticationError';
    const mockEnrichLeaky = vi.fn().mockRejectedValue(leakyErr);

    const result = await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichLeaky,
        embedDocument: mockEmbedOk,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    expect(result.status).toBe('dead_letter');
    const reason = result.failureReason ?? '';
    // Must not contain API key material from err.message
    expect(reason).not.toMatch(/sk-ant|pa-|api.?key/i);
    // Must contain err.name (the only permitted information)
    expect(reason).toContain('AuthenticationError');

    // Also check the DB update payload
    const updatePayload = updates[0] as Record<string, unknown>;
    const dbReason = String(updatePayload.failureReason ?? '');
    expect(dbReason).not.toMatch(/sk-ant|pa-|api.?key/i);
  });

  it('embedding input check: embed receives title_zh + summary_zh, NOT body_raw', async () => {
    const { db } = makeDbMock();
    const capturedEmbedInput: string[] = [];
    const mockEmbedCapture = vi.fn().mockImplementation(async (text: string) => {
      capturedEmbedInput.push(text);
      return new Array(1024).fill(0.5);
    });

    await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichOk,
        embedDocument: mockEmbedCapture,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    expect(capturedEmbedInput).toHaveLength(1);
    const embedInput = capturedEmbedInput[0];
    // Should contain title_zh and summary_zh from mock enrichment
    expect(embedInput).toContain('测试标题');
    expect(embedInput).toContain('这是一个测试摘要');
    // Should NOT be the raw body
    expect(embedInput).not.toBe('Test body content that is long enough');
  });

  it('pipeline_runs LLM-12: enrich insert has all required token + cost fields', async () => {
    const { db, inserts } = makeDbMock();

    await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichOk,
        embedDocument: mockEmbedOk,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    // First insert is the enrich run
    const enrichInsert = inserts[0];
    expect(Object.keys(enrichInsert)).toEqual(
      expect.arrayContaining([
        'cacheReadTokens',
        'inputTokens',
        'outputTokens',
        'cacheWriteTokens',
        'estimatedCostUsd',
        'latencyMs',
        'model',
        'task',
      ]),
    );
    expect(enrichInsert.model).toBe('claude-haiku-4-5-20251001');
    expect(enrichInsert.cacheReadTokens).toBe(400);
  });

  it('embedding dims: 1024-length embedding written to items update payload', async () => {
    const embedding1024 = new Array(1024).fill(0.123);
    const { db, updates } = makeDbMock();
    const mockEmbedFixed = vi.fn().mockResolvedValue(embedding1024);

    await runProcessItem({
      itemId: BigInt(1),
      deps: {
        db,
        extractFullText: mockExtractOk,
        enrichWithClaude: mockEnrichOk,
        embedDocument: mockEmbedFixed,
        joinOrCreateCluster: mockJoinOk,
      },
    });

    const itemUpdate = updates[0] as Record<string, unknown>;
    expect(itemUpdate.embedding).toEqual(embedding1024);
    expect((itemUpdate.embedding as number[]).length).toBe(1024);
  });
});
