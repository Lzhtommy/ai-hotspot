// Plan 05-07 Task 2 — REQ-VOTE-03
//
// Asserts FeedCard surfaces VOTE-03 honest copy containing 个性化 + 即将
// (locked sentiment). Copy is rendered inline beneath the action bar
// on every card (authenticated or anonymous).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/server/actions/favorites', () => ({
  favoriteItem: vi.fn(),
  unfavoriteItem: vi.fn(),
}));
vi.mock('@/server/actions/votes', () => ({
  voteItem: vi.fn(),
}));

import { FeedCardActions } from '@/components/feed/feed-card-actions';

describe('VOTE-03 honest copy', () => {
  it('copy contains 个性化 and 即将', () => {
    render(
      <FeedCardActions
        itemId="1"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated={false}
      />,
    );
    // The copy renders as an aria-live="off" <p> below the action bar.
    expect(screen.queryByText(/个性化/), 'VOTE-03 copy missing 个性化').not.toBeNull();
    expect(screen.queryByText(/即将/), 'VOTE-03 copy missing 即将').not.toBeNull();
  });
});
