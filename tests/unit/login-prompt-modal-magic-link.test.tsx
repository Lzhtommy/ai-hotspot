// Task 5-04-02 | Plan 05-04 | REQ-AUTH-05
// Nyquist stub — red until implementation lands.
//
// Asserts the email form calls signIn('resend', { email, redirect: false })
// and shows the inline "检查邮箱" success state.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth' as string, () => ({
  signIn: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('LoginPromptModal magic-link flow', () => {
  it('TODO[5-04-02]: submits email via signIn("resend") and shows 检查邮箱 success state', async () => {
    const { LoginPromptModal } = (await import('@/components/feed/login-prompt-modal')) as {
      LoginPromptModal: React.ComponentType;
    };
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const input = (await screen.findByRole('textbox', {
      name: /邮箱|email/i,
    })) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/检查邮箱/)).toBeInTheDocument();
    });
  });
});
