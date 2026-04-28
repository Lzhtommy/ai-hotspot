import { describe, it, expect, vi } from 'vitest';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { enrichWithClaude, EnrichError } from './enrich';
import { EnrichmentSchema } from './schema';
import { ZodError } from 'zod/v4';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
  },
  APIError: class APIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'APIError';
    }
  },
}));

// Build a minimal mock for the Anthropic client's messages.parse method.
// We do NOT use vi.mock('@/lib/llm/client') — only DI via deps parameter.
function makeAnthropicMock(behavior: 'ok' | 'schema-fail' | 'api-error' | 'ok-with-cache') {
  const calls: Array<Record<string, unknown>> = [];

  const parseFn = vi.fn(async (args: Record<string, unknown>) => {
    calls.push(args);

    if (behavior === 'api-error') {
      const err = new Error('connection refused');
      err.name = 'ConnectionError';
      throw err;
    }

    if (behavior === 'schema-fail') {
      return {
        parsed_output: {
          title_zh: 'Test Title',
          summary_zh: 'This is a summary with enough characters.',
          score: 150, // out-of-range — zod will reject
          recommendation: 'Short rec',
          tags: ['模型发布'],
        },
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      };
    }

    if (behavior === 'ok-with-cache') {
      return {
        parsed_output: {
          title_zh: 'Cached Title',
          summary_zh: 'Summary text that meets the minimum length.',
          score: 75,
          recommendation: '推荐关注',
          tags: ['模型发布', 'Anthropic'],
        },
        usage: {
          input_tokens: 50,
          output_tokens: 30,
          cache_read_input_tokens: 400,
          cache_creation_input_tokens: 0,
        },
      };
    }

    // behavior === 'ok'
    return {
      parsed_output: {
        title_zh: 'Anthropic 发布 Claude 3.5',
        summary_zh: 'Anthropic 今日发布了 Claude 3.5 Sonnet 模型,在多项 benchmark 上超越前代。',
        score: 90,
        recommendation: '旗舰级智能按 Sonnet 定价',
        tags: ['模型发布', 'Anthropic'],
      },
      usage: {
        input_tokens: 500,
        output_tokens: 150,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 4200,
      },
    };
  });

  const mockClient = {
    messages: { parse: parseFn },
  } as never;

  return { mockClient, calls, parseFn };
}

describe('enrichWithClaude', () => {
  it('happy path: returns EnrichResult with enrichment + usage populated', async () => {
    const { mockClient } = makeAnthropicMock('ok');
    const result = await enrichWithClaude({
      text: 'Some article text',
      title: 'Claude 3.5 Sonnet',
      sourceLang: 'en',
      deps: { anthropic: mockClient as never },
    });
    expect(result.enrichment.title_zh).toBe('Anthropic 发布 Claude 3.5');
    expect(result.enrichment.score).toBe(90);
    expect(result.enrichment.tags).toContain('模型发布');
    expect(result.usage.input_tokens).toBe(500);
    expect(result.usage.output_tokens).toBe(150);
    expect(result.usage.cache_creation_input_tokens).toBe(4200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('schema-failure path: score=150 → ZodError propagated (orchestrator handles as dead_letter)', async () => {
    const { mockClient } = makeAnthropicMock('schema-fail');
    await expect(
      enrichWithClaude({
        text: 'Some article text',
        title: 'Test',
        sourceLang: 'en',
        deps: { anthropic: mockClient as never },
      }),
    ).rejects.toThrow(ZodError);
  });

  it('API-failure path: connection error → throws EnrichError with kind=api', async () => {
    const { mockClient } = makeAnthropicMock('api-error');
    const err = await enrichWithClaude({
      text: 'Some text',
      title: 'Test',
      sourceLang: 'en',
      deps: { anthropic: mockClient as never },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EnrichError);
    const enrichErr = err as EnrichError;
    expect(enrichErr.kind).toBe('api');
    // Detail policy (2026-04-23): include err.name + err.message sliced to 300 chars
    // so Trigger.dev logs surface the real failure cause. Anthropic SDK redacts
    // credentials; 300-char slice guards against runaway payloads.
    expect(enrichErr.message).toContain('ConnectionError');
    expect(enrichErr.message).toContain('connection refused');
    expect(enrichErr.message.length).toBeLessThanOrEqual(400);
  });

  it('usage propagation: cache_read_input_tokens reflected in result', async () => {
    const { mockClient } = makeAnthropicMock('ok-with-cache');
    const result = await enrichWithClaude({
      text: 'Article text',
      title: 'Cached Test',
      sourceLang: 'zh',
      deps: { anthropic: mockClient as never },
    });
    expect(result.usage.cache_read_input_tokens).toBe(400);
    expect(result.usage.cache_creation_input_tokens).toBe(0);
  });

  it('W5 regression gate: system has cache_control ephemeral + correct model + zodOutputFormat', async () => {
    const { mockClient, calls } = makeAnthropicMock('ok');
    await enrichWithClaude({
      text: 'Article',
      title: 'Test',
      sourceLang: 'en',
      deps: { anthropic: mockClient as never },
    });
    expect(calls).toHaveLength(1);
    const args = calls[0] as {
      system: Array<{ type: string; cache_control?: { type: string } }>;
      model: string;
      output_config: { format: unknown };
    };

    // cache_control regression gate (LLM-08)
    expect(Array.isArray(args.system)).toBe(true);
    expect(args.system[0].type).toBe('text');
    expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });

    // Model ID gate
    expect(args.model).toBe('claude-haiku-4-5-20251001');

    // zodOutputFormat shape gate — deep-equal on the JSON-schema portion (type + schema).
    // The `parse` function is a closure so two zodOutputFormat() calls produce different
    // function instances; we compare the serializable parts that affect API behavior.
    const expectedFormat = zodOutputFormat(EnrichmentSchema as never);
    const actual = args.output_config.format as Record<string, unknown>;
    expect(actual.type).toBe(expectedFormat.type);
    expect(actual.schema).toEqual(expectedFormat.schema);
  });
});
