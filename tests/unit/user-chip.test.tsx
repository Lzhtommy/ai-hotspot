// Task 5-05-01 | Plan 05-05 | REQ-AUTH-06 | Threat T-5-07
// Nyquist stub — red until implementation lands.
//
// Asserts UserChip renders three states (anonymous, authed-with-image, authed-monogram).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserChip } from '@/components/layout/user-chip';

describe('UserChip three-state render', () => {
  it('TODO[5-05-01]: anonymous branch renders 登录 ghost chip', () => {
    // Phase 5 adds a `session` prop; Phase 4 stub takes no props — expected to fail typecheck until D-18 lands.
    // @ts-expect-error — session prop added in Plan 05-05
    render(<UserChip session={null} />);
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument();
  });

  it('TODO[5-05-01]: authenticated branch with image renders avatar + name', () => {
    // @ts-expect-error — session prop added in Plan 05-05
    render(
      <UserChip
        session={{
          id: 'u1',
          name: 'Alice',
          image: 'https://avatars.githubusercontent.com/u/1?v=4',
          email: 'a@b.c',
        }}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('TODO[5-05-01]: authed without image falls back to monogram', () => {
    // @ts-expect-error — session prop added in Plan 05-05
    render(<UserChip session={{ id: 'u2', name: '小明', image: null, email: 'x@y.z' }} />);
    expect(screen.getByText('小明')).toBeInTheDocument();
  });
});
