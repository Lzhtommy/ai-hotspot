// Task 5-03-01 (TDD) + 5-03-02 | Plan 05-03 | REQ-AUTH-03 | Threat T-5-05
//
// Asserts:
//   (Task 1) sendChineseMagicLink POSTs a Chinese-body email to Resend's HTTP API.
//   (Task 2) authConfig.providers registers the Resend provider (id === 'resend').
//
// Implementation lives in:
//   - src/lib/auth/magic-link-email.ts (Task 1 output)
//   - src/lib/auth/config.ts          (Task 2 wires Resend → sendChineseMagicLink)
import { describe, it, expect, vi } from 'vitest';

describe('Phase 5 magic-link email (sendChineseMagicLink)', () => {
  async function callWithMockFetch(mockFetch: typeof globalThis.fetch) {
    const { sendChineseMagicLink } = (await import(
      '@/lib/auth/magic-link-email' as string
    )) as typeof import('@/lib/auth/magic-link-email');
    await sendChineseMagicLink(
      {
        identifier: 'alice@example.com',
        url: 'https://ai-hotspot.example/api/auth/callback/resend?token=abc',
        provider: { apiKey: 'test-key', from: 'AI Hotspot <noreply@example.com>' },
        expires: new Date(Date.now() + 10 * 60 * 1000),
      },
      { fetch: mockFetch },
    );
  }

  it('POSTs to https://api.resend.com/emails with Bearer Authorization', async () => {
    const calls: Array<[string, RequestInit]> = [];
    const mockFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(url), init ?? {}]);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    await callWithMockFetch(mockFetch);

    expect(calls.length).toBe(1);
    const [url, init] = calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('body uses Chinese subject "AI Hotspot 登录链接" and 10-minute-TTL text', async () => {
    let captured = '';
    const mockFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      captured = String(init?.body ?? '');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    await callWithMockFetch(mockFetch);

    const parsed = JSON.parse(captured) as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    };
    expect(parsed.subject).toBe('AI Hotspot 登录链接');
    expect(parsed.text).toContain('链接 10 分钟内有效');
    expect(parsed.text).toContain(
      'https://ai-hotspot.example/api/auth/callback/resend?token=abc',
    );
    expect(parsed.to).toBe('alice@example.com');
    expect(parsed.from).toBe('AI Hotspot <noreply@example.com>');
  });

  it('throws MagicLinkError when Resend returns non-OK status', async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response('{"message":"invalid_api_key"}', {
          status: 401,
          statusText: 'Unauthorized',
        }),
    ) as unknown as typeof globalThis.fetch;

    const { sendChineseMagicLink, MagicLinkError } = (await import(
      '@/lib/auth/magic-link-email' as string
    )) as typeof import('@/lib/auth/magic-link-email');

    await expect(
      sendChineseMagicLink(
        {
          identifier: 'a@b',
          url: 'https://x/y',
          provider: { apiKey: 'bad', from: 'F' },
          expires: new Date(),
        },
        { fetch: mockFetch },
      ),
    ).rejects.toBeInstanceOf(MagicLinkError);
  });
});

describe('Phase 5 Resend magic-link provider', () => {
  it('authConfig.providers includes resend provider (Task 2)', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Array<{ id?: string }> };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasResend = providers.some((p) => p?.id === 'resend');
    expect(hasResend, 'resend provider missing from authConfig.providers').toBe(true);
  });

  it('Chinese email template reachable via @/lib/auth/magic-link-email (Task 1)', async () => {
    const mod = (await import('@/lib/auth/magic-link-email' as string)) as Record<
      string,
      unknown
    >;
    expect(mod.sendChineseMagicLink).toBeDefined();
  });
});
