/**
 * System + user prompt builders — Phase 3 LLM-03..07, LLM-08, LLM-09.
 *
 * System prompt is split into:
 *   - RUBRIC_TEXT:        0-100 hotness rubric with anchor examples (~1500-2000 tokens)
 *   - TAG_TAXONOMY:       ~30 tags with one-line examples (~1500 tokens)
 *   - FEW_SHOT_EXAMPLES:  2-3 input→output pairs (~1000-1500 tokens)
 * Total ≥ 4096 tokens — required for Haiku 4.5 cache (RESEARCH.md §Pitfall 1).
 *
 * User message wraps article body in <untrusted_content>...</untrusted_content>
 * per LLM-09 + Anthropic jailbreak-mitigation docs.
 */

// Load the three static resource files at module load time. The three
// `src/lib/llm/prompts/*.md` files are authored in this same task and
// MUST be shipped verbatim as part of this plan — they are the locked
// content that determines Haiku's hotness rubric, tag vocabulary, and
// few-shot priming. Reading them as raw strings via `fs.readFileSync` at
// module load keeps the prompt identical across processes (so prompt-cache
// keys match) and avoids bundler stringification surprises.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROMPTS_DIR = join(process.cwd(), 'src/lib/llm/prompts');
const RUBRIC_TEXT = readFileSync(join(PROMPTS_DIR, 'rubric.md'), 'utf8');
const TAG_TAXONOMY = readFileSync(join(PROMPTS_DIR, 'tag-taxonomy.md'), 'utf8');
const FEW_SHOT_EXAMPLES = readFileSync(join(PROMPTS_DIR, 'few-shot.md'), 'utf8');

export function buildSystemPrompt(): Array<{
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}> {
  return [
    {
      type: 'text',
      text: `${RUBRIC_TEXT}\n\n${TAG_TAXONOMY}\n\n${FEW_SHOT_EXAMPLES}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export function buildUserMessage(params: {
  text: string;
  title: string;
  sourceLang: 'zh' | 'en';
}): string {
  // LLM-09: wrap BOTH title and body in untrusted_content XML tags.
  // Title comes from the same untrusted RSS feed as the body — placing it outside
  // the fence would let a crafted title bypass the prompt-injection boundary.
  return (
    `Source language: ${params.sourceLang}\n\n` +
    `<untrusted_content>\n` +
    `Title: ${params.title}\n\n` +
    `${params.text}\n` +
    `</untrusted_content>\n\n` +
    `Return the enrichment JSON.`
  );
}

// Simple token-estimate heuristic — for prompt.test.ts ≥4096 assertion only.
// NOT used at runtime. ~4 chars per token is the Anthropic rule of thumb.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
