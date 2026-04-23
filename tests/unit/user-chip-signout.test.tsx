// Task 5-05-02 | Plan 05-05 | REQ-AUTH-06
// Nyquist stub — red until implementation lands.
//
// Asserts the sign-out menu item invokes signOut() from @/lib/auth (NOT next-auth/react).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const signOutMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/lib/auth' as string, () => ({ signOut: signOutMock }));

describe('UserChip sign-out', () => {
  it('TODO[5-05-02]: clicking 退出登录 calls signOut()', async () => {
    const { UserChip } = (await import('@/components/layout/user-chip')) as {
      UserChip: React.ComponentType<Record<string, unknown>>;
    };
    render(
      <UserChip session={{ id: 'u1', name: 'Alice', image: null, email: 'a@b.c', role: 'user' }} />,
    );
    // Open the popover, then click 退出登录.
    fireEvent.click(screen.getByRole('button', { name: /Alice|用户/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /退出登录/ }));
    expect(signOutMock).toHaveBeenCalled();
  });
});
