// Task 5-04-02 | Plan 05-04 | REQ-AUTH-03, AUTH-04
//
// Asserts the EmailMagicLinkForm calls signInResendAction (the thin
// server-action wrapper) and renders the three UX branches per UI-SPEC
// §LoginPromptModal / Copywriting Contract:
//   - idle:    label + input + 发送登录链接 submit + autocomplete=email, inputmode=email
//   - success: role="status" container with 链接已发送，请检查邮箱。+ 链接 10 分钟内有效。
//   - error:   role="alert" with 发送失败，请检查邮箱格式后重试。
//
// Mocks the server action directly (not signIn from @/lib/auth) — the modal
// imports from @/server/actions/auth per Plan 05-04 Task 1.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signInResendAction = vi.fn();

vi.mock('@/server/actions/auth', () => ({
  signInGithubAction: vi.fn(async () => undefined),
  signInGoogleAction: vi.fn(async () => undefined),
  signInResendAction: (formData: FormData) => signInResendAction(formData),
}));

import { LoginPromptModal } from '@/components/feed/login-prompt-modal';

describe('LoginPromptModal magic-link flow', () => {
  beforeEach(() => {
    signInResendAction.mockReset();
  });

  it('idle state renders label + input + submit with correct a11y attrs', () => {
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const input = screen.getByRole('textbox', { name: /邮箱/ }) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('inputmode', 'email');
    expect(input).toHaveAttribute('placeholder', '你的邮箱地址');

    expect(screen.getByRole('button', { name: /发送登录链接/ })).toBeInTheDocument();
  });

  it('successful submit replaces form with 链接已发送，请检查邮箱。 success container (role=status)', async () => {
    signInResendAction.mockResolvedValueOnce({ success: true });
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const input = screen.getByRole('textbox', { name: /邮箱/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/链接已发送，请检查邮箱。/)).toBeInTheDocument();
    });

    // role=status container
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    // sub-copy also present
    expect(screen.getByText(/链接 10 分钟内有效。/)).toBeInTheDocument();
    // form replaced (input gone)
    expect(screen.queryByRole('textbox', { name: /邮箱/ })).not.toBeInTheDocument();
  });

  it('failed submit renders inline role=alert error without replacing the form', async () => {
    signInResendAction.mockResolvedValueOnce({ error: 'SEND_FAILED' });
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const input = screen.getByRole('textbox', { name: /邮箱/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('发送失败，请检查邮箱格式后重试。');
    });

    // Form stays open so user can retry
    expect(screen.getByRole('textbox', { name: /邮箱/ })).toBeInTheDocument();
  });

  it('passes the typed email to signInResendAction via FormData', async () => {
    signInResendAction.mockResolvedValueOnce({ success: true });
    render(<LoginPromptModal />);
    document.dispatchEvent(new CustomEvent('open-login-modal'));

    const input = screen.getByRole('textbox', { name: /邮箱/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'someone@example.com' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(signInResendAction).toHaveBeenCalledTimes(1);
    });
    const [firstCallArg] = signInResendAction.mock.calls[0] as [FormData];
    expect(firstCallArg).toBeInstanceOf(FormData);
    expect(firstCallArg.get('email')).toBe('someone@example.com');
  });
});
