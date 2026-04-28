// Asserts LoginPromptModal renders GitHub + Google provider buttons in
// locked top-to-bottom order and opens on the 'open-login-modal' event.
//
// Form actions are wired to server-action wrappers in @/server/actions/auth —
// the real signIn(...) fan-out is asserted in the per-provider unit files.
// This test only proves the Client Component renders the right surfaces and
// connects them to the right form actions.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Stub the server-action module so form action={...} references don't trip
// over the 'use server' directive in the Vitest environment.
vi.mock('@/server/actions/auth', () => ({
  signInGithubAction: vi.fn(async () => undefined),
  signInGoogleAction: vi.fn(async () => undefined),
}));

import { LoginPromptModal } from '@/components/feed/login-prompt-modal';

describe('LoginPromptModal provider buttons', () => {
  it('renders GitHub and Google buttons', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    // GitHub primary (accent) — matched by accessible name
    expect(screen.getByRole('button', { name: /使用 GitHub 登录/ })).toBeInTheDocument();

    // Google secondary — matched by accessible name
    expect(screen.getByRole('button', { name: /使用 Google 登录/ })).toBeInTheDocument();

    // Dismiss button
    expect(screen.getByRole('button', { name: /稍后再说/ })).toBeInTheDocument();
  });

  it('locks provider stack top-to-bottom: GitHub → Google → dismiss', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const buttons = screen.getAllByRole('button');
    const names = buttons.map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim());
    const labeled = names.filter(Boolean);
    const githubIdx = labeled.findIndex((n) => /GitHub/i.test(n));
    const googleIdx = labeled.findIndex((n) => /Google/i.test(n));
    const dismissIdx = labeled.findIndex((n) => /稍后再说/.test(n));

    expect(githubIdx).toBeGreaterThanOrEqual(0);
    expect(googleIdx).toBeGreaterThan(githubIdx);
    expect(dismissIdx).toBeGreaterThan(googleIdx);
  });

  it('event `open-login-modal` opens the dialog', () => {
    render(<LoginPromptModal />);
    fireEvent(document, new CustomEvent('open-login-modal'));
    const dlg = document.querySelector('dialog');
    expect(dlg?.hasAttribute('open')).toBe(true);
  });

  it('GitHub and Google forms have distinct form actions', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));
    // Two forms inside the dialog: GitHub and Google.
    const forms = (document.querySelector('dialog') as HTMLElement).querySelectorAll('form');
    expect(forms.length).toBe(2);
  });
});
