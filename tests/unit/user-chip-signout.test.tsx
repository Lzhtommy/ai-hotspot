// Plan 05-05 Task 2 — UserChip sign-out popover test.
//
// Asserts clicking 退出登录 menu item submits a form whose action is the
// signOutAction server action imported from @/server/actions/auth.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const signOutActionMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/server/actions/auth', () => ({
  signOutAction: signOutActionMock,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string; width?: number; height?: number }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src} alt={props.alt} width={props.width} height={props.height} />;
  },
}));

describe('UserChip sign-out', () => {
  it('clicking 退出登录 invokes signOutAction via form submission', async () => {
    signOutActionMock.mockClear();
    const { UserChip } = await import('@/components/layout/user-chip');
    render(
      <UserChip
        session={{
          user: {
            id: 'u1',
            email: 'alice@example.com',
            name: 'Alice',
            image: null,
            role: 'user',
          },
        }}
      />,
    );
    // Open the popover
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }));
    // 退出登录 menu item is present
    const item = await screen.findByRole('menuitem', { name: /退出登录/ });
    expect(item).toBeInTheDocument();
    // Click the menu item → form submits → onSubmit handler calls signOutAction
    fireEvent.click(item);
    expect(signOutActionMock).toHaveBeenCalledTimes(1);
  });

  it('popover exposes role="menu" with role="menuitem" for a11y', () => {
    return import('@/components/layout/user-chip').then(({ UserChip }) => {
      render(
        <UserChip
          session={{
            user: {
              id: 'u1',
              email: 'alice@example.com',
              name: 'Alice',
              image: null,
              role: 'user',
            },
          }}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Alice/ }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /退出登录/ })).toBeInTheDocument();
    });
  });
});
