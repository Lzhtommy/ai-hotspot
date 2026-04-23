// Plan 05-07 Task 2 — REQ-FAV-02, REQ-VOTE-02
//
// Behavior assertions per 05-07-PLAN.md <behavior> tests 1-4:
//   Test 1: anonymous click dispatches 'open-login-modal'; does NOT call favoriteItem.
//   Test 2: authenticated star click calls favoriteItem and flips aria-pressed immediately.
//   Test 3: check (vote +1) click from neutral calls voteItem(itemId, 1).
//   Test 4: server-action rejection rolls back optimistic state and renders
//           role="alert" with the rollback copy.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const favoriteItemMock = vi.fn();
const unfavoriteItemMock = vi.fn();
const voteItemMock = vi.fn();

vi.mock('@/server/actions/favorites', () => ({
  favoriteItem: (id: string) => favoriteItemMock(id),
  unfavoriteItem: (id: string) => unfavoriteItemMock(id),
}));
vi.mock('@/server/actions/votes', () => ({
  voteItem: (id: string, v: number) => voteItemMock(id, v),
}));

import { FeedCardActions } from '@/components/feed/feed-card-actions';

beforeEach(() => {
  favoriteItemMock.mockReset();
  unfavoriteItemMock.mockReset();
  voteItemMock.mockReset();
});

describe('FeedCardActions — anonymous branch', () => {
  it('dispatches open-login-modal on star click and does NOT call favoriteItem', () => {
    const listener = vi.fn();
    document.addEventListener('open-login-modal', listener);
    try {
      render(
        <FeedCardActions
          itemId="1"
          url="https://example.com"
          initial={{ favorited: false, vote: 0 }}
          isAuthenticated={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /收藏/ }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(favoriteItemMock).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('open-login-modal', listener);
    }
  });
});

describe('FeedCardActions — authenticated branch', () => {
  it('authenticated star click calls favoriteItem and shows active state', async () => {
    favoriteItemMock.mockResolvedValueOnce({ favorited: true });
    render(
      <FeedCardActions
        itemId="42"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated
      />,
    );
    const star = screen.getByRole('button', { name: /收藏/ });
    await act(async () => {
      fireEvent.click(star);
    });
    await waitFor(() => {
      expect(favoriteItemMock).toHaveBeenCalledWith('42');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /已收藏/ }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('check (vote +1) click from neutral calls voteItem(itemId, 1)', async () => {
    voteItemMock.mockResolvedValueOnce({ vote: 1 });
    render(
      <FeedCardActions
        itemId="77"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated
      />,
    );
    const like = screen.getByRole('button', { name: /点赞/ });
    await act(async () => {
      fireEvent.click(like);
    });
    await waitFor(() => {
      expect(voteItemMock).toHaveBeenCalledWith('77', 1);
    });
  });
});

describe('FeedCardActions — rollback on rejection', () => {
  it('rolls back optimistic favorite and shows role=alert copy when server rejects', async () => {
    favoriteItemMock.mockRejectedValueOnce(new Error('boom'));
    render(
      <FeedCardActions
        itemId="1"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated
      />,
    );
    const star = screen.getByRole('button', { name: /收藏/ });
    await act(async () => {
      fireEvent.click(star);
    });

    // Alert renders after rejection; state rolls back to non-favorited.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    const starAfter = screen.getByRole('button', { name: /收藏/ });
    expect(starAfter.getAttribute('aria-pressed')).not.toBe('true');
  });
});
