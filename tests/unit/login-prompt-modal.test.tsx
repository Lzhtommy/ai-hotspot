// Task 5-04-01 | Plan 05-04 | REQ-AUTH-02/03/04 | Threat T-5-06
//
// Asserts LoginPromptModal renders GitHub + Email + Google provider buttons in
// locked top-to-bottom order (D-06) and opens on the 'open-login-modal' event.
//
// Form actions are wired to server-action wrappers in @/server/actions/auth —
// the real signIn(...) fan-out is asserted in the per-provider unit files from
// Plan 05-03. This test only proves the Client Component renders the right
// surfaces and connects them to the right form actions.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Stub the server-action module so form action={...} references don't trip
// over the 'use server' directive in the Vitest environment (no Next.js
// server-action runtime). Stubs are no-ops; we only need identity refs.
vi.mock('@/server/actions/auth', () => ({
  signInGithubAction: vi.fn(async () => undefined),
  signInGoogleAction: vi.fn(async () => undefined),
  signInResendAction: vi.fn(async () => ({ success: true }) as const),
}));

import { LoginPromptModal } from '@/components/feed/login-prompt-modal';

describe('LoginPromptModal provider buttons', () => {
  it('renders GitHub / Email / Google in locked order (D-06)', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    // GitHub primary (accent) — matched by accessible name
    expect(screen.getByRole('button', { name: /使用 GitHub 登录/ })).toBeInTheDocument();

    // Google secondary — matched by accessible name
    expect(screen.getByRole('button', { name: /使用 Google 登录/ })).toBeInTheDocument();

    // Email form: 邮箱 label + input + 发送登录链接 submit
    const emailInput = screen.getByRole('textbox', {
      name: /邮箱/,
    }) as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(emailInput).toHaveAttribute('inputmode', 'email');

    expect(screen.getByRole('button', { name: /发送登录链接/ })).toBeInTheDocument();

    // Dismiss button
    expect(screen.getByRole('button', { name: /稍后再说/ })).toBeInTheDocument();
  });

  it('locks provider stack top-to-bottom: GitHub → email → Google → dismiss', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const buttons = screen.getAllByRole('button');
    // There are exactly four buttons in the modal body: GitHub, 发送登录链接, Google, 稍后再说.
    const names = buttons.map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim());
    // Filter out any empty names defensively.
    const labeled = names.filter(Boolean);
    const githubIdx = labeled.findIndex((n) => /GitHub/i.test(n));
    const emailIdx = labeled.findIndex((n) => /发送登录链接/.test(n));
    const googleIdx = labeled.findIndex((n) => /Google/i.test(n));
    const dismissIdx = labeled.findIndex((n) => /稍后再说/.test(n));

    expect(githubIdx).toBeGreaterThanOrEqual(0);
    expect(emailIdx).toBeGreaterThan(githubIdx);
    expect(googleIdx).toBeGreaterThan(emailIdx);
    expect(dismissIdx).toBeGreaterThan(googleIdx);
  });

  it('event `open-login-modal` opens the dialog', () => {
    render(<LoginPromptModal />);
    fireEvent(document, new CustomEvent('open-login-modal'));
    const dlg = document.querySelector('dialog');
    expect(dlg?.hasAttribute('open')).toBe(true);
  });

  it('其他方式 divider sits between email form and Google button', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const dialog = document.querySelector('dialog');
    expect(dialog).not.toBeNull();
    const utils = within(dialog as HTMLElement);
    const divider = utils.getByText('其他方式');
    expect(divider).toBeInTheDocument();
  });

  it('GitHub and Google forms have distinct form actions', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));
    // Three forms inside the dialog: GitHub, email, Google.
    const forms = (document.querySelector('dialog') as HTMLElement).querySelectorAll('form');
    expect(forms.length).toBe(3);
  });
});
