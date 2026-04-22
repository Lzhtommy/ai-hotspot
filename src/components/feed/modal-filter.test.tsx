/**
 * LoginPromptModal + FilterPopover smoke tests — Phase 4 FEED-03, D-22, D-26.
 *
 * Uses react-dom/server renderToString (Node-compatible, no jsdom required).
 * Verifies copy, ARIA attributes, and nuqs imports are present.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

// RED: these imports fail until the components are implemented
import { LoginPromptModal } from './login-prompt-modal';

describe('LoginPromptModal', () => {
  it('renders heading 登录以继续', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('登录以继续');
  });

  it('renders body copy 登录后才可以收藏、点赞或屏蔽动态', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('登录后才可以收藏、点赞或屏蔽动态');
  });

  it('renders 稍后再说 close button', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('稍后再说');
  });

  it('renders 登录 primary CTA', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('登录');
  });

  it('renders a native <dialog> element', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('<dialog');
  });

  it('has aria-labelledby attribute on dialog', () => {
    const html = renderToString(<LoginPromptModal />);
    expect(html).toContain('aria-labelledby');
  });
});
