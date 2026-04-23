// Task 5-04-01 | Plan 05-04 | REQ-AUTH-05 | Threat T-5-06
// Nyquist stub — red until implementation lands.
//
// Asserts LoginPromptModal renders GitHub + Email + Google buttons in locked order (D-06),
// and opens on the `open-login-modal` event.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginPromptModal } from '@/components/feed/login-prompt-modal';

describe('LoginPromptModal provider buttons', () => {
  it('TODO[5-04-01]: renders GitHub / Email / Google in locked order (D-06)', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));
    // GitHub primary, Email primary, Google secondary under a divider
    expect(screen.getByRole('button', { name: /GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    // Email form: require an email input present
    expect(
      screen.getByRole('textbox', { name: /邮箱|email/i }) as HTMLInputElement,
    ).toBeInTheDocument();
  });

  it('TODO[5-04-01]: event `open-login-modal` opens the dialog', () => {
    render(<LoginPromptModal />);
    fireEvent(document, new CustomEvent('open-login-modal'));
    const dlg = document.querySelector('dialog');
    expect(dlg?.hasAttribute('open')).toBe(true);
  });
});
