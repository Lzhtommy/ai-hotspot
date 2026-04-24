// Quick 260424-g2y — Sidebar admin nav gating tests.
//
// Verifies that the reader sidebar's "管理" section:
//   1. Is hidden for anonymous (session=null) users
//   2. Is hidden for authenticated non-admin (role=user) users
//   3. Renders 4 real NavRow links (信源/用户/成本/死信) for admin users
//      with canonical hrefs matching src/components/admin/admin-nav.tsx
//   4. Does not affect reader nav (精选/全部 AI 动态/收藏) for any session state
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Session } from 'next-auth';
import { Sidebar } from '@/components/layout/sidebar';

// Stub the server action module so importing UserChip does not blow up on 'use server'.
vi.mock('@/server/actions/auth', () => ({
  signOutAction: vi.fn().mockResolvedValue(undefined),
}));

// next/image in jsdom — pass through to a plain img.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

// next/link in jsdom — pass through to a plain anchor so we can query by href
// without a Next.js router.
vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: { href: string; children: React.ReactNode; [k: string]: unknown }) => {
    const { href, children, ...rest } = props;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

const ADMIN_HREFS = [
  '/admin/sources',
  '/admin/users',
  '/admin/costs',
  '/admin/dead-letter',
] as const;
const ADMIN_LABELS = ['信源', '用户', '成本', '死信'] as const;

function makeSession(role?: 'admin' | 'user'): Session {
  return {
    user: {
      id: 'u1',
      email: 'x@example.com',
      name: 'Tester',
      image: null,
      ...(role ? { role } : {}),
    },
    expires: '2099-01-01T00:00:00.000Z',
  } as unknown as Session;
}

describe('Sidebar admin nav gating (quick 260424-g2y)', () => {
  it('hides 管理 section when session is null', () => {
    render(<Sidebar pathname="/" session={null} pipelineStatus={null} />);
    expect(screen.queryByText('管理')).toBeNull();
    for (const href of ADMIN_HREFS) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });

  it('hides 管理 section for non-admin users (role=user)', () => {
    render(<Sidebar pathname="/" session={makeSession('user')} pipelineStatus={null} />);
    expect(screen.queryByText('管理')).toBeNull();
    for (const href of ADMIN_HREFS) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });

  it('renders 4 admin NavRows with canonical hrefs for admin users', () => {
    render(
      <Sidebar pathname="/admin/sources" session={makeSession('admin')} pipelineStatus={null} />,
    );
    expect(screen.getByText('管理')).toBeInTheDocument();
    for (let i = 0; i < ADMIN_HREFS.length; i++) {
      const link = document.querySelector(`a[href="${ADMIN_HREFS[i]}"]`);
      expect(link, `missing link for ${ADMIN_HREFS[i]}`).not.toBeNull();
      expect(link?.textContent).toContain(ADMIN_LABELS[i]);
    }
  });

  it('preserves reader nav for all session states', () => {
    // Anchor: regression guard against accidentally gating reader items.
    for (const session of [null, makeSession('user'), makeSession('admin')]) {
      const { unmount } = render(<Sidebar pathname="/" session={session} pipelineStatus={null} />);
      expect(screen.getByText('精选')).toBeInTheDocument();
      expect(screen.getByText('全部 AI 动态')).toBeInTheDocument();
      expect(screen.getByText('收藏')).toBeInTheDocument();
      unmount();
    }
  });
});
