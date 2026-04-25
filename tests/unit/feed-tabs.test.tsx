// Quick task 260425-kg7 — Anonymous tab unification with card-star D-26 seam.
//
// Asserts FeedTabs renders the 收藏 tab as a <button> (not a Link) when the
// caller has not authenticated, and dispatches the same `open-login-modal`
// CustomEvent on `document` that LoginPromptModal listens for (Phase 4 D-26
// seam preserved by Phase 5 Plan 05-07).
//
// The 精选 / 全部动态 tabs always remain Links. Only the 收藏 tab swaps
// rendering to a button in the anonymous branch — this preserves deep-link
// fallback semantics: the server-side redirect at /favorites stays untouched.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { FeedTabs } from '@/components/feed/feed-tabs';

describe('FeedTabs anonymous favorites tab (260425-kg7)', () => {
  // afterEach cleanup is registered globally in tests/setup.ts. We additionally
  // remove any document-level event listeners attached per-test below.
  let registeredListeners: Array<() => void> = [];

  afterEach(() => {
    for (const off of registeredListeners) off();
    registeredListeners = [];
  });

  it('renders 收藏 as <button> with no href when isAuthenticated=false', () => {
    render(<FeedTabs pathname="/" isAuthenticated={false} />);

    const tab = screen.getByRole('button', { name: /收藏/ });
    expect(tab.tagName).toBe('BUTTON');
    expect(tab.hasAttribute('href')).toBe(false);
  });

  it('clicking anonymous 收藏 tab dispatches open-login-modal on document', () => {
    const spy = vi.fn();
    const listener = (() => {
      const handler = () => spy();
      document.addEventListener('open-login-modal', handler);
      return () => document.removeEventListener('open-login-modal', handler);
    })();
    registeredListeners.push(listener);

    render(<FeedTabs pathname="/" isAuthenticated={false} />);

    const tab = screen.getByRole('button', { name: /收藏/ });
    fireEvent.click(tab);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('renders 收藏 as <a href="/favorites"> when isAuthenticated=true', () => {
    render(<FeedTabs pathname="/" isAuthenticated={true} />);

    const tab = screen.getByRole('link', { name: /收藏/ });
    expect(tab.tagName).toBe('A');
    expect(tab.getAttribute('href')).toBe('/favorites');
  });

  it('defaults to anonymous (button) when isAuthenticated is omitted', () => {
    render(<FeedTabs pathname="/" />);
    const tab = screen.getByRole('button', { name: /收藏/ });
    expect(tab.tagName).toBe('BUTTON');
  });

  it('preserves aria-current="page" on active 收藏 tab in both branches', () => {
    // Anonymous: button branch on /favorites still gets aria-current
    const { rerender } = render(<FeedTabs pathname="/favorites" isAuthenticated={false} />);
    const buttonTab = screen.getByRole('button', { name: /收藏/ });
    expect(buttonTab.getAttribute('aria-current')).toBe('page');

    // Authenticated: link branch on /favorites also gets aria-current
    rerender(<FeedTabs pathname="/favorites" isAuthenticated={true} />);
    const linkTab = screen.getByRole('link', { name: /收藏/ });
    expect(linkTab.getAttribute('aria-current')).toBe('page');
  });

  it('精选 and 全部动态 remain Links in both auth branches', () => {
    const { rerender } = render(<FeedTabs pathname="/" isAuthenticated={false} />);
    expect(screen.getByRole('link', { name: /精选/ }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /全部动态/ }).getAttribute('href')).toBe('/all');

    rerender(<FeedTabs pathname="/" isAuthenticated={true} />);
    expect(screen.getByRole('link', { name: /精选/ }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /全部动态/ }).getAttribute('href')).toBe('/all');
  });
});
