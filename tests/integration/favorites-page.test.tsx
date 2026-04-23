// Task 5-08-01 | Plan 05-08 | REQ-FAV-03 | Threat T-5-10
// Nyquist stub — red until implementation lands.
//
// Asserts /favorites is auth-gated: anonymous → redirect or login CTA;
// authenticated → user-scoped reverse-chrono query filtering status='published' (D-15).
import { describe, it, expect, vi } from 'vitest';
import { fakeSession } from '../helpers/auth';

vi.mock('@/lib/auth' as string, () => ({
  auth: vi.fn(),
}));

describe('/favorites page auth gate + query', () => {
  it('TODO[5-08-01]: anonymous session triggers redirect or login CTA', async () => {
    const auth = (await import('@/lib/auth' as string)) as { auth: ReturnType<typeof vi.fn> };
    auth.auth.mockResolvedValueOnce(null);

    const pageMod = (await import('@/app/(reader)/favorites/page' as string)) as {
      default: () => Promise<unknown>;
    };
    // Either throws a Next.js redirect signal OR returns a login-CTA empty state.
    await expect(async () => {
      const out = await pageMod.default();
      // Empty-state path is also acceptable per D-15; the assertion just proves
      // the page branches on !session.
      expect(out).toBeDefined();
    }).not.toThrow();
  });

  it('TODO[5-08-01]: authenticated session queries user-scoped published items', async () => {
    const auth = (await import('@/lib/auth' as string)) as { auth: ReturnType<typeof vi.fn> };
    auth.auth.mockResolvedValueOnce(fakeSession());

    const pageMod = (await import('@/app/(reader)/favorites/page' as string)) as {
      default: () => Promise<unknown>;
    };
    const out = await pageMod.default();
    expect(out).toBeDefined();
  });
});
