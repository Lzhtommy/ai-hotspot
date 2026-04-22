import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage, estimateTokens } from './prompt';

describe('buildSystemPrompt', () => {
  it('returns one text block with cache_control: ephemeral', () => {
    const parts = buildSystemPrompt();
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('text');
    expect(parts[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('system prompt meets ≥4096 token floor (LLM-08 Haiku 4.5 cache minimum)', () => {
    const parts = buildSystemPrompt();
    expect(estimateTokens(parts[0].text)).toBeGreaterThanOrEqual(4096);
  });
});

describe('buildUserMessage', () => {
  it('wraps article body in <untrusted_content> delimiters (LLM-09)', () => {
    const msg = buildUserMessage({ text: 'hello', title: 'T', sourceLang: 'en' });
    expect(msg).toContain('<untrusted_content>');
    expect(msg).toContain('</untrusted_content>');
    expect(msg).toContain('hello');
  });

  it('includes source language outside the fence and title inside it (WR-04 prompt-injection mitigation)', () => {
    const msg = buildUserMessage({ text: 'body', title: 'MyTitle', sourceLang: 'zh' });
    const before = msg.split('<untrusted_content>')[0];
    const inside = msg.split('<untrusted_content>')[1].split('</untrusted_content>')[0];
    // sourceLang is trusted metadata — stays outside the fence
    expect(before).toContain('zh');
    // title comes from untrusted RSS — must be inside the fence
    expect(before).not.toContain('MyTitle');
    expect(inside).toContain('MyTitle');
  });
});
