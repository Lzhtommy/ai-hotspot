// Task 5-03-02 | Plan 05-03 | REQ-AUTH-03 | Threat T-5-05
// Nyquist stub — red until implementation lands.
//
// Asserts Resend email magic-link provider is registered and uses RESEND_FROM env.
import { describe, it, expect } from 'vitest';

describe('Phase 5 Resend magic-link provider', () => {
  it('TODO[5-03-02]: authConfig.providers includes resend provider', async () => {
    const cfg = (await import('@/lib/auth/config' as string)) as {
      authConfig: { providers?: Array<{ id?: string }> };
    };
    const providers = cfg.authConfig.providers ?? [];
    const hasResend = providers.some((p) => p?.id === 'resend');
    expect(hasResend, 'resend provider missing from authConfig.providers').toBe(true);
  });

  it('TODO[5-03-02]: Chinese email template reachable via @/lib/auth/magic-link-email', async () => {
    const mod = (await import('@/lib/auth/magic-link-email' as string)) as Record<string, unknown>;
    expect(mod.sendMagicLink ?? mod.magicLinkEmail ?? mod.renderMagicLink).toBeDefined();
  });
});
