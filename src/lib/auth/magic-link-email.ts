/**
 * Chinese magic-link email sender — Phase 5 AUTH-03, D-07.
 *
 * Called by Auth.js Resend provider's sendVerificationRequest hook.
 * POSTs a Chinese-body email to Resend's HTTP API. Token TTL is controlled
 * by Auth.js (default 10 minutes); the copy references that TTL literally
 * per UI-SPEC §Email body.
 *
 * Design:
 *   - `provider.apiKey` + `provider.from` come from `Resend({ apiKey, from })`
 *     in authConfig; this function does NOT touch process.env (testable,
 *     matches RESEARCH §Pattern 2 verbatim).
 *   - Plain-text + HTML bodies per UI-SPEC §Email body. Text is deliverability
 *     primary; HTML is a progressive enhancement.
 *   - `deps.fetch` is injectable so unit tests can assert the request shape
 *     without hitting the network (mirrors src/lib/feed/get-feed.ts pattern).
 *
 * Consumed by:
 *   - src/lib/auth/config.ts (Resend({ sendVerificationRequest: sendChineseMagicLink }))
 *   - tests/unit/provider-resend.test.ts (body + error-path assertions)
 */

export interface SendMagicLinkDeps {
  fetch?: typeof globalThis.fetch;
}

export interface SendMagicLinkParams {
  identifier: string;
  url: string;
  provider: { apiKey?: string; from?: string };
  expires: Date;
}

export class MagicLinkError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MagicLinkError';
    this.status = status;
  }
}

const SUBJECT = 'AI Hotspot 登录链接';

function buildTextBody(url: string): string {
  return [
    '你好，',
    '',
    '请点击以下链接登录 AI Hotspot：',
    '',
    url,
    '',
    '链接 10 分钟内有效。如果你没有申请登录，请忽略此邮件。',
    '',
    'AI Hotspot 团队',
  ].join('\n');
}

function buildHtmlBody(url: string): string {
  // Inline styles only — email clients strip <style>/<link>.
  // Accent + ink colors mirror --accent-500 / --ink-900 from globals.css.
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;line-height:1.6;color:#3A3833;padding:24px;background:#FAF8F4;">',
    '<p>你好，</p>',
    '<p>请点击以下链接登录 AI Hotspot：</p>',
    `<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#D4911C;color:#ffffff;text-decoration:none;border-radius:4px;">登录 AI Hotspot</a></p>`,
    '<p style="color:#766F5B;font-size:14px;">链接 10 分钟内有效。如果你没有申请登录，请忽略此邮件。</p>',
    '<p style="color:#766F5B;font-size:14px;">— AI Hotspot 团队</p>',
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * POST a Chinese magic-link email to Resend.
 *
 * Auth.js v5 Resend provider calls this via `sendVerificationRequest`. The
 * `provider` arg carries `apiKey` + `from` from the provider config (passed
 * through by @auth/core; see RESEARCH §Pattern 2 / Resend source).
 *
 * @throws MagicLinkError if apiKey/from are missing or Resend returns non-OK.
 */
export async function sendChineseMagicLink(
  params: SendMagicLinkParams,
  deps?: SendMagicLinkDeps,
): Promise<void> {
  const fetchFn = deps?.fetch ?? globalThis.fetch;
  const { identifier, url, provider } = params;

  if (!provider.apiKey) {
    throw new MagicLinkError('Resend apiKey missing in provider config');
  }
  if (!provider.from) {
    throw new MagicLinkError('Resend from missing in provider config');
  }

  const res = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: provider.from,
      to: identifier,
      subject: SUBJECT,
      text: buildTextBody(url),
      html: buildHtmlBody(url),
    }),
  });

  if (!res.ok) {
    // Swallow body read errors — status is the primary signal.
    await res.text().catch(() => '');
    throw new MagicLinkError(`Resend send failed: ${res.status}`, res.status);
  }
}
