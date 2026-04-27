import { describe, it, expect, vi } from 'vitest';
import { embedDocument, EmbedError } from './embed';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
  },
}));

// Build a minimal mock for the Voyage client's embed method.
// We do NOT use vi.mock('@/lib/llm/client') — only DI via deps parameter.
function makeVoyageMock(behavior: 'ok' | 'wrong-length' | 'network-error') {
  const embedFn = vi.fn(async () => {
    if (behavior === 'network-error') {
      const err = new Error('sk-api-key-leaked-in-message ECONNREFUSED');
      err.name = 'NetworkError';
      throw err;
    }
    if (behavior === 'wrong-length') {
      return {
        data: [{ embedding: new Array(512).fill(0.1) }],
      };
    }
    // ok: 1024-dim vector
    return {
      data: [{ embedding: new Array(1024).fill(0.5) }],
    };
  });

  const mockClient = { embed: embedFn } as never;
  return { mockClient, embedFn };
}

describe('embedDocument', () => {
  it('happy path: returns exactly 1024-length number[]', async () => {
    const { mockClient } = makeVoyageMock('ok');
    const result = await embedDocument('Some document text', mockClient);
    expect(result).toHaveLength(1024);
    expect(typeof result[0]).toBe('number');
  });

  it('wrong embedding length → throws EmbedError', async () => {
    const { mockClient } = makeVoyageMock('wrong-length');
    await expect(embedDocument('text', mockClient)).rejects.toThrow(EmbedError);
  });

  it('wrong embedding length → EmbedError message contains length info', async () => {
    const { mockClient } = makeVoyageMock('wrong-length');
    const err = await embedDocument('text', mockClient).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbedError);
    const embedErr = err as EmbedError;
    expect(embedErr.message).toContain('512');
  });

  it('client throws network error → throws EmbedError with scrubbed message (only err.name)', async () => {
    const { mockClient } = makeVoyageMock('network-error');
    const err = await embedDocument('text', mockClient).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbedError);
    const embedErr = err as EmbedError;
    // Secret scrub: must contain err.name ('NetworkError'), NOT err.message which contains API key
    expect(embedErr.message).toContain('NetworkError');
    expect(embedErr.message).not.toContain('sk-api-key-leaked');
    expect(embedErr.message).not.toContain('ECONNREFUSED');
  });

  it('embedFn called with voyage-3.5 model and document inputType', async () => {
    const { mockClient, embedFn } = makeVoyageMock('ok');
    await embedDocument('test input', mockClient);
    expect(embedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'voyage-3.5',
        inputType: 'document',
        input: expect.arrayContaining(['test input']),
      }),
    );
  });
});
