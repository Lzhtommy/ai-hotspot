// Quick task 260425-kg7 — Anonymous tab unification with card-star D-26 seam.
//
// Asserts FeedTabs renders the 收藏 tab as the SAME <a> (Link) as the other
// tabs in both auth branches. Anonymous click is intercepted via onClick +
// e.preventDefault() to dispatch `open-login-modal` on `document` instead of
// navigating; visual parity with the sibling Link tabs is preserved (no
// <button> user-agent defaults). The server-side `/favorites` redirect remains
// as the deep-link / middle-click fallback.

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

  it('renders 收藏 as <a href="/favorites"> with anonymous data-attr when isAuthenticated=false', () => {
    render(<FeedTabs pathname="/" isAuthenticated={false} />);

    const tab = screen.getByRole('link', { name: /收藏/ });
    expect(tab.tagName).toBe('A');
    expect(tab.getAttribute('href')).toBe('/favorites');
    expect(tab.getAttribute('data-anonymous-favorites')).toBe('true');
  });

  it('clicking anonymous 收藏 tab calls preventDefault and dispatches open-login-modal', () => {
    const spy = vi.fn();
    const listener = (() => {
      const handler = () => spy();
      document.addEventListener('open-login-modal', handler);
      return () => document.removeEventListener('open-login-modal', handler);
    })();
    registeredListeners.push(listener);

    render(<FeedTabs pathname="/" isAuthenticated={false} />);

    const tab = screen.getByRole('link', { name: /收藏/ });
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dispatched = tab.dispatchEvent(evt);

    expect(spy).toHaveBeenCalledTimes(1);
    // dispatchEvent returns false when default was prevented.
    expect(dispatched).toBe(false);
  });

  it('renders 收藏 as <a href="/favorites"> without anonymous data-attr when isAuthenticated=true', () => {
    render(<FeedTabs pathname="/" isAuthenticated={true} />);

    const tab = screen.getByRole('link', { name: /收藏/ });
    expect(tab.tagName).toBe('A');
    expect(tab.getAttribute('href')).toBe('/favorites');
    expect(tab.hasAttribute('data-anonymous-favorites')).toBe(false);
  });

  it('defaults to anonymous semantics when isAuthenticated is omitted', () => {
    render(<FeedTabs pathname="/" />);
    const tab = screen.getByRole('link', { name: /收藏/ });
    expect(tab.getAttribute('data-anonymous-favorites')).toBe('true');
  });

  it('preserves aria-current="page" on active 收藏 tab in both branches', () => {
    const { rerender } = render(<FeedTabs pathname="/favorites" isAuthenticated={false} />);
    const anonTab = screen.getByRole('link', { name: /收藏/ });
    expect(anonTab.getAttribute('aria-current')).toBe('page');
    expect(anonTab.getAttribute('data-anonymous-favorites')).toBe('true');

    rerender(<FeedTabs pathname="/favorites" isAuthenticated={true} />);
    const authTab = screen.getByRole('link', { name: /收藏/ });
    expect(authTab.getAttribute('aria-current')).toBe('page');
    expect(authTab.hasAttribute('data-anonymous-favorites')).toBe(false);
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
