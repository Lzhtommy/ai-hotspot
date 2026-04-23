// Task 5-07-02 | Plan 05-07 | REQ-VOTE-03
// Nyquist stub — red until implementation lands.
//
// Asserts FeedCard surfaces Chinese honest copy containing 个性化 + 即将
// near the like/dislike icons (VOTE-03 locked sentiment).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedCardActions } from '@/components/feed/feed-card-actions';

describe('VOTE-03 honest copy', () => {
  it('TODO[5-07-02]: copy contains 个性化 and 即将', () => {
    // @ts-expect-error — new props added in Plan 05-07
    render(
      <FeedCardActions
        itemId="1"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated={false}
      />,
    );
    // The copy may live in a title attribute, tooltip, or inline footnote. The
    // test asserts it renders SOMEWHERE in the accessible tree.
    const text = screen.queryByText(/个性化/);
    expect(text, 'VOTE-03 copy missing 个性化').not.toBeNull();
    expect(screen.queryByText(/即将/), 'VOTE-03 copy missing 即将').not.toBeNull();
  });
});
