'use client';

/**
 * Card action bar — Phase 4 FEED-03, D-17 step 8, D-26, D-27.
 *
 * Client island wrapping the action icon-buttons.
 * Star/check/x buttons dispatch the 'open-login-modal' custom event (click-gated
 * per D-26; no localStorage persistence per D-27 — Phase 5 wires real actions).
 * The external-link button is a real <a> tag (not gated — opens item.url).
 * Domain footer derives hostname from the sourceUrl or item URL.
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (step 8 action bar)
 */

import { IconButton } from '@/components/layout/icon-button';

function openLoginModal() {
  // Dispatch custom event listened to by LoginPromptModal (D-26)
  document.dispatchEvent(new CustomEvent('open-login-modal'));
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

interface FeedCardActionsProps {
  itemId: string;
  url: string;
  sourceUrl?: string | null;
}

/**
 * Action bar: star (收藏) + check (Like) + x (Dislike) — all gated via login modal.
 * External-link (打开原文) is ungated — opens in new tab.
 * Domain footer derived from sourceUrl ?? url hostname.
 */
export function FeedCardActions({ itemId: _itemId, url, sourceUrl }: FeedCardActionsProps) {
  const domain = domainOf(sourceUrl ?? url);

  return (
    <div
      style={{
        // marginTop: 14px — off scale from feed_card.jsx L329
        marginTop: 14,
        // paddingTop: 12px — off scale from feed_card.jsx L330
        paddingTop: 12,
        borderTop: '1px solid var(--line-weak)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Gated action buttons — click opens login modal per D-26 */}
      <IconButton
        icon="star"
        title="收藏"
        aria-label="收藏"
        tone="accent"
        onClick={openLoginModal}
      />
      <IconButton
        icon="check"
        title="Like"
        aria-label="Like"
        tone="accent"
        onClick={openLoginModal}
      />
      <IconButton
        icon="x"
        title="Dislike"
        aria-label="Dislike"
        tone="danger"
        onClick={openLoginModal}
      />

      {/* Domain footer + external-link — ungated per D-17 step 8 */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {domain && (
          <span
            style={{
              // 11.5px fg-4 from feed_card.jsx L346
              fontSize: 11.5,
              color: 'var(--fg-4)',
            }}
          >
            {domain}
          </span>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="打开原文"
          style={{ display: 'inline-flex', textDecoration: 'none' }}
        >
          <IconButton icon="external-link" title="打开原文" aria-label="打开原文" tone="neutral" />
        </a>
      </div>
    </div>
  );
}
