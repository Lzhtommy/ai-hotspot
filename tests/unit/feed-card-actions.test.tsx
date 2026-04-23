// Task 5-07-01 | Plan 05-07 | REQ-FAV-02, REQ-VOTE-02
// Nyquist stub — red until implementation lands.
//
// Asserts FeedCardActions wraps clicks in useOptimistic + useTransition and
// rolls back when the server action rejects.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const favoriteAction = vi.fn();
const voteAction = vi.fn();
vi.mock('@/server/actions/favorites' as string, () => ({ favoriteItem: favoriteAction }));
vi.mock('@/server/actions/votes' as string, () => ({ voteItem: voteAction }));

describe('FeedCardActions optimistic + rollback', () => {
  it('TODO[5-07-01]: rollback on server-action rejection', async () => {
    favoriteAction.mockRejectedValueOnce(new Error('boom'));

    const { FeedCardActions } = (await import('@/components/feed/feed-card-actions')) as {
      FeedCardActions: React.ComponentType<Record<string, unknown>>;
    };

    render(
      <FeedCardActions
        itemId="1"
        url="https://example.com"
        initial={{ favorited: false, vote: 0 }}
        isAuthenticated
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /收藏/ }));
    await waitFor(() => {
      // After optimistic flip + rejection, active state rolls back to "not favorited".
      expect(screen.getByRole('button', { name: /收藏/ }).getAttribute('aria-pressed')).not.toBe(
        'true',
      );
    });
  });
});
