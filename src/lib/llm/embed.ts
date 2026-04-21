/**
 * Voyage voyage-3.5 document embedding — Phase 3 CLUST-01.
 *
 * Returns 1024-dim vector. Embed only the summary (title_zh + summary_zh),
 * NOT the raw body (RESEARCH.md §Anti-Patterns — embedding the raw body_raw).
 *
 * Consumed by: src/lib/llm/process-item-core.ts
 */
import { voyage as realVoyage } from './client';

export class EmbedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbedError';
  }
}

export async function embedDocument(
  text: string,
  deps?: typeof realVoyage | { voyage?: typeof realVoyage },
): Promise<number[]> {
  // Support both: embedDocument(text, voyageClient) and embedDocument(text, { voyage: client })
  let client: typeof realVoyage;
  if (deps === undefined) {
    client = realVoyage;
  } else if (typeof (deps as { embed?: unknown }).embed === 'function') {
    client = deps as typeof realVoyage;
  } else {
    client = (deps as { voyage?: typeof realVoyage }).voyage ?? realVoyage;
  }

  let res;
  try {
    res = await client.embed({
      input: [text],
      model: 'voyage-3.5',
      inputType: 'document',
    });
  } catch (err) {
    throw new EmbedError(`Voyage embed failed: ${err instanceof Error ? err.name : 'unknown'}`);
  }
  const embedding = (res as unknown as { data: Array<{ embedding: number[] }> }).data?.[0]
    ?.embedding;
  if (!embedding || embedding.length !== 1024) {
    throw new EmbedError(
      `Voyage returned malformed embedding (length=${embedding?.length ?? 'undefined'})`,
    );
  }
  return embedding;
}
