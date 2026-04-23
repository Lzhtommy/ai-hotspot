// Plan 05-05 Task 2 — UserChip three-state render tests.
//
// Covers UI-SPEC §UserChip + CONTEXT D-18:
//   1. Anonymous (session=null): ghost 登录 chip; click dispatches open-login-modal
//   2. Authenticated with image: renders <img> avatar (next/image → img in jsdom) + name + chevron
//   3. Authenticated without image: renders monogram with first char
//   4. Name truncation at 8 chars
//   5. a11y: chip button has aria-haspopup="menu" + aria-expanded
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserChip } from '@/components/layout/user-chip';

// Mock the server action module so import doesn't blow up on 'use server'
vi.mock('@/server/actions/auth', () => ({
  signOutAction: vi.fn().mockResolvedValue(undefined),
}));

// next/image in jsdom — pass through to a plain img
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={props.src}
        alt={props.alt}
        width={props.width}
        height={props.height}
        style={props.style}
      />
    );
  },
}));

describe('UserChip three-state render', () => {
  it('anonymous (session=null) renders 登录 ghost chip and dispatches open-login-modal on click', () => {
    const listener = vi.fn();
    document.addEventListener('open-login-modal', listener);
    try {
      render(<UserChip session={null} />);
      const btn = screen.getByRole('button', { name: /登录/ });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('open-login-modal', listener);
    }
  });

  it('authenticated with image renders <img> avatar + name + chevron', () => {
    render(
      <UserChip
        session={{
          user: {
            id: 'u1',
            email: 'alice@example.com',
            name: 'Alice',
            image: 'https://avatars.githubusercontent.com/u/1?v=4',
            role: 'user',
          },
        }}
      />,
    );
    // name
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // avatar image
    const img = document.querySelector('img[src*="avatars.githubusercontent.com"]');
    expect(img).not.toBeNull();
    // chip button exposes menu a11y
    const chip = screen.getByRole('button', { name: /Alice/ });
    expect(chip).toHaveAttribute('aria-haspopup', 'menu');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
  });

  it('authenticated without image renders monogram with first char', () => {
    render(
      <UserChip
        session={{
          user: {
            id: 'u2',
            email: 'xiaoming@example.com',
            name: '张三',
            image: null,
            role: 'user',
          },
        }}
      />,
    );
    // Name appears in the chip label
    expect(screen.getByText('张三')).toBeInTheDocument();
    // Monogram character '张' rendered as a role=img span with matching aria-label
    const monogram = document.querySelector('span[role="img"][aria-label="张"]');
    expect(monogram).not.toBeNull();
    expect(monogram?.textContent).toBe('张');
  });

  it('truncates long names to 8 chars with ellipsis', () => {
    render(
      <UserChip
        session={{
          user: {
            id: 'u3',
            email: 'longname@example.com',
            name: 'Abcdefghij',
            image: null,
            role: 'user',
          },
        }}
      />,
    );
    // 'Abcdefghij' (10 chars) → 'Abcdefgh…'
    expect(screen.getByText('Abcdefgh…')).toBeInTheDocument();
  });

  it('authenticated chip has aria-haspopup="menu" and aria-expanded toggling on click', () => {
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
    const chip = screen.getByRole('button', { name: /Alice/ });
    expect(chip).toHaveAttribute('aria-haspopup', 'menu');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    // role=menu appears after open
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
