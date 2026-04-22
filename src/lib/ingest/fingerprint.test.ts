import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { urlFingerprint, contentHash } from './fingerprint';

describe('urlFingerprint', () => {
  it('returns 64-char lowercase hex for any input', () => {
    const fp = urlFingerprint('https://example.com/a');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(urlFingerprint('https://x.com/')).toBe(urlFingerprint('https://x.com/'));
  });

  it('differs for different inputs', () => {
    expect(urlFingerprint('https://a.com/')).not.toBe(urlFingerprint('https://b.com/'));
  });

  it('matches Node crypto sha256 hex encoding exactly', () => {
    const url = 'https://example.com/a?b=c';
    const expected = createHash('sha256').update(url, 'utf8').digest('hex');
    expect(urlFingerprint(url)).toBe(expected);
  });

  it('handles Chinese/unicode input', () => {
    const fp = urlFingerprint('https://buzzing.cc/文章/你好');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('contentHash', () => {
  it('returns 64-char hex', () => {
    expect(contentHash('https://x.com/', 'Title')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses url + \\n + title as input', () => {
    const url = 'https://x.com/';
    const title = 'Hello';
    const expected = createHash('sha256').update(`${url}\n${title}`, 'utf8').digest('hex');
    expect(contentHash(url, title)).toBe(expected);
  });

  it('changes when either arg changes', () => {
    const base = contentHash('https://x.com/', 'A');
    expect(contentHash('https://y.com/', 'A')).not.toBe(base);
    expect(contentHash('https://x.com/', 'B')).not.toBe(base);
  });
});
