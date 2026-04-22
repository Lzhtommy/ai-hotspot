/**
 * EmptyState — Phase 4 FEED-06, feed_views.jsx lines 377–401.
 *
 * RSC empty state component used for:
 *   - /favorites when anonymous: heading "登录后可查看收藏", CTA opens login modal
 *   - / when no high-score items: heading "暂无精选动态", CTA navigates to /all
 *   - /all when no items: heading "还没有动态", no CTA
 *   - /all when filters return zero: heading "没有匹配的动态", CTA clears filters
 *   - 404 via not-found.tsx: heading "动态不存在"
 *
 * CTA accepts EITHER href (Link-wrapped Button) OR onClick (click handler).
 * When onClick is provided, consumers must render EmptyState inside a Client
 * Component boundary since the handler is a client-side function.
 *
 * Layout: centered, max-width 480px, 96px vertical padding per UI-SPEC Spacing.
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx (no items)
 *   - src/app/(reader)/all/page.tsx (no items, filter-zero)
 *   - src/app/(reader)/favorites/page.tsx (anonymous state)
 *   - src/app/not-found.tsx (404)
 */

import Link from 'next/link';
import { Button, type ButtonVariant } from '@/components/layout/button';

interface EmptyStateCta {
  label: string;
  /** When provided, CTA renders as a Link-wrapped Button */
  href?: string;
  /** When provided (without href), CTA renders a Button with onClick handler */
  onClick?: () => void;
  variant?: ButtonVariant;
}

interface EmptyStateProps {
  title: string;
  body: string;
  cta?: EmptyStateCta;
}

export function EmptyState({ title, body, cta }: EmptyStateProps) {
  return (
    // feed_views.jsx lines 377–401: centered container, 96px top/bottom padding
    <div
      style={{
        padding: '96px 32px', // UI-SPEC Spacing: 96px outer padding (space-24)
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Heading — 20px/600 per UI-SPEC Typography (EmptyState title) */}
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--ink-900)',
        }}
      >
        {title}
      </h2>

      {/* Body — 14px/400 per UI-SPEC Typography (card summary size) */}
      <p
        style={{
          marginTop: 12,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--ink-700)',
        }}
      >
        {body}
      </p>

      {/* CTA — either Link-wrapped (href) or click-handler Button (onClick) */}
      {cta && (
        <div style={{ marginTop: 24 }}>
          {cta.href ? (
            <Link href={cta.href} style={{ textDecoration: 'none' }}>
              <Button variant={cta.variant ?? 'primary'} size="md">
                {cta.label}
              </Button>
            </Link>
          ) : cta.onClick ? (
            <Button variant={cta.variant ?? 'primary'} size="md" onClick={cta.onClick}>
              {cta.label}
            </Button>
          ) : (
            // Fallback: CTA with no href and no onClick (static label only)
            <Button variant={cta.variant ?? 'primary'} size="md">
              {cta.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
