/**
 * Haiku 4.5 structured-output call — Phase 3 LLM-03..07, LLM-09, LLM-12.
 *
 * Single messages.parse() call returns a zod-validated Enrichment object.
 * The system prompt carries cache_control: ephemeral (LLM-08).
 * The user content wraps article body in <untrusted_content> (LLM-09).
 *
 * Consumed by: src/lib/llm/process-item-core.ts
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic as realAnthropic } from './client';
import { EnrichmentSchema, type Enrichment } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export class EnrichError extends Error {
  constructor(
    message: string,
    public readonly kind: 'api' | 'parse' | 'schema',
  ) {
    super(message);
    this.name = 'EnrichError';
  }
}

export interface EnrichUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface EnrichResult {
  enrichment: Enrichment;
  usage: EnrichUsage;
  latencyMs: number;
}

export async function enrichWithClaude(params: {
  text: string;
  title: string;
  sourceLang: 'zh' | 'en';
  deps?: { anthropic?: typeof realAnthropic };
}): Promise<EnrichResult> {
  const client = params.deps?.anthropic ?? realAnthropic;
  const start = Date.now();
  let res;
  try {
    res = await (client as typeof realAnthropic).messages.parse({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildUserMessage({
                text: params.text,
                title: params.title,
                sourceLang: params.sourceLang,
              }),
            },
          ],
        },
      ],
      // EnrichmentSchema uses zod/v4 but SDK type signature expects zod v3 ZodType.
      // Runtime is compatible (zodOutputFormat uses zod/v4 internally); cast to satisfy tsc.
      output_config: { format: zodOutputFormat(EnrichmentSchema as never) },
    });
  } catch (err) {
    throw new EnrichError(
      `Anthropic call failed: ${err instanceof Error ? err.name : 'unknown'}`,
      'api',
    );
  }
  const parsed = (res as unknown as { parsed_output?: Enrichment }).parsed_output;
  if (!parsed) {
    throw new EnrichError('Anthropic response missing parsed_output', 'parse');
  }
  // Belt-and-suspenders zod re-validation — propagates as ZodError, caught by orchestrator as terminal/dead-letter.
  const validated = EnrichmentSchema.parse(parsed);
  const u = (res as unknown as { usage?: Partial<EnrichUsage> }).usage ?? {};
  return {
    enrichment: validated,
    usage: {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    },
    latencyMs: Date.now() - start,
  };
}
