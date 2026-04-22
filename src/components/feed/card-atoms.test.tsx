/**
 * Card atoms smoke tests — Phase 4 FEED-03.
 *
 * Uses react-dom/server renderToString (Node-compatible, no jsdom required).
 * Verifies structure, text content, and aria attributes for each atom.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

// These imports will fail (RED) until the atoms are implemented
import { ScoreBadge } from './score-badge';
import { HotnessBar } from './hotness-bar';

describe('ScoreBadge', () => {
  it('renders score number', () => {
    const html = renderToString(<ScoreBadge score={75} />);
    expect(html).toContain('75');
    expect(html).toContain('/100');
  });

  it('renders HOT chip when score >= 80', () => {
    const html = renderToString(<ScoreBadge score={85} />);
    expect(html).toContain('HOT');
  });

  it('does NOT render HOT chip when score < 80', () => {
    const html = renderToString(<ScoreBadge score={79} />);
    expect(html).not.toContain('HOT');
  });

  it('has aria-label with score/100', () => {
    const html = renderToString(<ScoreBadge score={92} />);
    expect(html).toContain('热度评分 92/100');
  });
});

describe('HotnessBar', () => {
  it('renders a bar element', () => {
    const html = renderToString(<HotnessBar score={60} />);
    expect(html).toBeTruthy();
  });

  it('is aria-hidden', () => {
    const html = renderToString(<HotnessBar score={60} />);
    expect(html).toContain('aria-hidden');
  });
});
