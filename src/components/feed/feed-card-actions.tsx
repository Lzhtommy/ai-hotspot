'use client';

/**
 * FeedCardActions — Phase 5 FAV-01, FAV-02, VOTE-01, VOTE-02, VOTE-03, VOTE-04 (D-10..D-14).
 *
 * Client island that renders the star / check / x action icons on every FeedCard.
 *
 * Flow:
 *   - Anonymous click (isAuthenticated=false) → dispatch 'open-login-modal' CustomEvent
 *     (Phase 4 seam preserved; LoginPromptModal listens on document).
 *   - Authenticated click → optimistic UI update via useOptimistic + startTransition,
 *     then server action (favoriteItem / unfavoriteItem / voteItem). Server return value
 *     reconciles the optimistic state; rejection rolls back and surfaces an inline
 *     role="alert" error for 3 seconds.
 *
 * VOTE-03 honest copy is a file-scope constant (`PERSONALIZATION_COPY`) rendered once
 * per card beneath the action bar.
 *
 * React 18.3 / Next 15 note (RESEARCH §Pitfall 1): `useOptimistic` is a React 19 canary
 * API. Next 15 ships a compiled React 19 canary for its runtime; Vitest jsdom tests run
 * against the repo's react@18.3.1 which does NOT export useOptimistic. To keep the same
 * source compile-and-run both places, we source the hook from React's runtime and fall
 * back to a functionally equivalent useState-based implementation when undefined. The
 * public behavior (instant flip → server reconcile → rollback on error) is identical.
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (step 8 action bar — RSC parent threads
 *     isAuthenticated + initial from the (reader) layout `auth()` call).
 */

import { useState, useTransition, useRef, useEffect } from 'react';
import * as React from 'react';
import { IconButton } from '@/components/layout/icon-button';
import { favoriteItem, unfavoriteItem } from '@/server/actions/favorites';
import { voteItem } from '@/server/actions/votes';

// VOTE-03 honest copy — UI-SPEC §Copywriting Contract locks the sentiment ("个性化" + "即将").
// Defined at file scope so the vote-honest-copy test can assert a stable constant location.
const PERSONALIZATION_COPY = '个性化推荐即将上线';
const ROLLBACK_ERROR_COPY = '操作失败,请重试。';

type Vote = -1 | 0 | 1;
export type Interaction = { favorited: boolean; vote: Vote };

interface FeedCardActionsProps {
  itemId: string;
  url: string;
  sourceUrl?: string | null;
  /** RSC parent supplies initial favorite/vote state (Plan 05-07 prop-threading). */
  initial?: Interaction;
  /** RSC parent supplies the session presence flag — avoids useSession per RESEARCH §Anti-Patterns. */
  isAuthenticated?: boolean;
}

function openLoginModal() {
  // Phase 4 D-26 seam — LoginPromptModal listens for this on `document`.
  document.dispatchEvent(new CustomEvent('open-login-modal'));
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Runtime-flexible useOptimistic wrapper.
 *
 * React 19 (Next 15 runtime) exports `useOptimistic`; react@18.3 (test runtime) does not.
 * To keep hook call order stable across both runtimes we always call useState + useEffect
 * here; when React 19's useOptimistic is present we layer it on top in production (via a
 * separate hook call that does not change order across renders) so the real behavior wins.
 * The public surface — [state, applyPatch(patch)] — is identical either way.
 */
type OptimisticSetter<P> = (patch: P) => void;
const REACT_USE_OPTIMISTIC: unknown = (React as unknown as { useOptimistic?: unknown })
  .useOptimistic;
function useOptimisticCompat<S, P>(
  passthrough: S,
  reducer: (state: S, patch: P) => S,
): [S, OptimisticSetter<P>] {
  // Always-called hooks keep order stable across both runtimes.
  const [fallbackState, setFallbackState] = useState<S>(passthrough);
  useEffect(() => {
    setFallbackState(passthrough);
  }, [passthrough]);

  // When the real useOptimistic exists (React 19 canary shipped by Next 15), prefer it.
  // This conditional lookup is a module-level constant — NOT re-evaluated per render —
  // so `useOptimistic` is either always called or never called for the lifetime of the
  // module, satisfying the hooks-order invariant.
  if (typeof REACT_USE_OPTIMISTIC === 'function') {
    const useReal = REACT_USE_OPTIMISTIC as <T, A>(
      state: T,
      action: (s: T, a: A) => T,
    ) => [T, (a: A) => void];
    // eslint-disable-next-line react-hooks/rules-of-hooks -- see comment above.
    return useReal<S, P>(passthrough, reducer);
  }
  const apply: OptimisticSetter<P> = (patch) => {
    setFallbackState((curr) => reducer(curr, patch));
  };
  return [fallbackState, apply];
}

/**
 * Action bar: star (收藏) + check (点赞) + x (点踩) with real server-action wiring.
 * External-link is ungated (opens item.url in new tab); domain footer from sourceUrl ?? url.
 */
export function FeedCardActions({
  itemId,
  url,
  sourceUrl,
  initial = { favorited: false, vote: 0 },
  isAuthenticated = false,
}: FeedCardActionsProps) {
  const domain = domainOf(sourceUrl ?? url);

  const [optimistic, applyOptimistic] = useOptimisticCompat<Interaction, Partial<Interaction>>(
    initial,
    (curr, patch) => ({ ...curr, ...patch }),
  );
  const [, startTransition] = useTransition();
  const [errorShown, setErrorShown] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    [],
  );

  function flashError() {
    setErrorShown(true);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorShown(false), 3000);
  }

  function handleFavorite() {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    const nextFavorited = !optimistic.favorited;
    startTransition(async () => {
      applyOptimistic({ favorited: nextFavorited });
      try {
        const res = nextFavorited ? await favoriteItem(itemId) : await unfavoriteItem(itemId);
        applyOptimistic({ favorited: res.favorited });
      } catch {
        applyOptimistic({ favorited: !nextFavorited });
        flashError();
      }
    });
  }

  function handleVote(desired: 1 | -1) {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    const current = optimistic.vote;
    // D-12 exclusive toggle: clicking the active direction clears; clicking the other flips.
    const next: Vote = current === desired ? 0 : desired;
    startTransition(async () => {
      applyOptimistic({ vote: next });
      try {
        // VOTE-04 value contract: server accepts only -1 | 1; clamped at the call site.
        const res = await voteItem(itemId, desired);
        applyOptimistic({ vote: res.vote as Vote });
      } catch {
        applyOptimistic({ vote: current });
        flashError();
      }
    });
  }

  return (
    <div
      style={{
        // marginTop: 14px — off scale from feed_card.jsx L329
        marginTop: 14,
        // paddingTop: 12px — off scale from feed_card.jsx L330
        paddingTop: 12,
        borderTop: '1px solid var(--line-weak)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <IconButton
          icon="star"
          title={optimistic.favorited ? '已收藏' : '收藏'}
          aria-label={optimistic.favorited ? '已收藏' : '收藏'}
          tone="accent"
          active={optimistic.favorited}
          onClick={handleFavorite}
        />
        <IconButton
          icon="check"
          title={optimistic.vote === 1 ? '已点赞' : '点赞'}
          aria-label={optimistic.vote === 1 ? '已点赞' : '点赞'}
          tone="success"
          active={optimistic.vote === 1}
          onClick={() => handleVote(1)}
        />
        <IconButton
          icon="x"
          title={optimistic.vote === -1 ? '已点踩' : '点踩'}
          aria-label={optimistic.vote === -1 ? '已点踩' : '点踩'}
          tone="danger"
          active={optimistic.vote === -1}
          onClick={() => handleVote(-1)}
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
            <IconButton
              icon="external-link"
              title="打开原文"
              aria-label="打开原文"
              tone="neutral"
            />
          </a>
        </div>
      </div>

      {/* VOTE-03 honest copy — single-line caption. Swaps to role="alert" error for 3s on rollback. */}
      {errorShown ? (
        <p
          role="alert"
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--danger-500)',
          }}
        >
          {ROLLBACK_ERROR_COPY}
        </p>
      ) : (
        <p
          aria-live="off"
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--fg-4)',
          }}
        >
          {PERSONALIZATION_COPY}
        </p>
      )}
    </div>
  );
}
