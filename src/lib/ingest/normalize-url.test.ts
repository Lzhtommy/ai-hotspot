import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './normalize-url';

describe('normalizeUrl', () => {
  it('strips utm_source and keeps other params', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x&keep=1')).toBe(
      'https://example.com/a?keep=1',
    );
  });

  it('strips all 12 D-04 tracking params', () => {
    const url =
      'https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&fbclid=f&gclid=g&mc_cid=h&mc_eid=i&ref=j&source=k&spm=l&keep=yes';
    expect(normalizeUrl(url)).toBe('https://example.com/?keep=yes');
  });

  it('strips tracking params case-insensitively', () => {
    expect(normalizeUrl('https://example.com/?UTM_SOURCE=X&Fbclid=y')).toBe(
      'https://example.com/',
    );
  });

  it('upgrades http to https', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('https://example.com/a');
  });

  it('lowercases host but preserves path case', () => {
    expect(normalizeUrl('https://Example.COM/Path/Case')).toBe(
      'https://example.com/Path/Case',
    );
  });

  it('drops fragment', () => {
    expect(normalizeUrl('https://example.com/a#section')).toBe('https://example.com/a');
  });

  it('strips trailing slash when path length > 1', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe('https://example.com/a');
  });

  it('preserves root /', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('preserves non-tracking params', () => {
    expect(normalizeUrl('https://example.com/?a=1&b=2&utm_source=x&c=3')).toBe(
      'https://example.com/?a=1&b=2&c=3',
    );
  });

  it('is idempotent', () => {
    const samples = [
      'http://Example.COM/a/?utm_source=x&b=2#frag',
      'https://news.ycombinator.com/item?id=1',
      'https://buzzing.cc/',
      'https://www.anthropic.com/news/claude-3-5-haiku?ref=hn',
      'https://example.com/path/with/slash/',
    ];
    for (const u of samples) {
      const once = normalizeUrl(u);
      expect(normalizeUrl(once)).toBe(once);
    }
  });

  it('throws on invalid input', () => {
    expect(() => normalizeUrl('not-a-url')).toThrow();
  });
});
