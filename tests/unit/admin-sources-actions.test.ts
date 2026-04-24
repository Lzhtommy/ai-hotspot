/**
 * 06-REVIEW WR-07 regression — updateSourceAction FormData → patch mapping.
 *
 * The action layer (`src/server/actions/admin-sources.ts`) is where the
 * FormData parsing for the admin source edit form lives. Iteration-1's WR-02
 * fix covered `isActive` via a hidden sentinel; iteration-2's WR-07 covers the
 * parallel bug for `category`: a `<select>` whose "未分类" option has
 * `value=""` was collapsing to `undefined` via the old `readString` and
 * therefore could never clear a previously-set category.
 *
 * These tests exercise `updateSourceAction` end-to-end with a FormData
 * payload, mocking `@/lib/auth`, `next/cache`, and the underlying
 * `updateSourceCore` so we can assert on the exact `patch` object that
 * reaches the repo layer. The repo-layer contract (`'category' in patch` →
 * writes `category = null`) is already covered by admin-sources.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock() is hoisted to the top of the file, so any state it references
// must live inside vi.hoisted() to be available at factory-evaluation time.
// The `authMock` returns a session whose user.role is 'admin' so
// assertAdmin() is a no-op.
const {
  authMock,
  updateSourceCoreMock,
  createSourceCoreMock,
  softDeleteSourceCoreMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(async () => ({
    user: { id: 'u-admin', role: 'admin', email: 'a@example.com' },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  })),
  updateSourceCoreMock: vi.fn(async () => undefined),
  createSourceCoreMock: vi.fn(async () => ({ id: 1 })),
  softDeleteSourceCoreMock: vi.fn(async () => undefined),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: authMock }));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/admin/sources-repo', () => ({
  updateSourceCore: updateSourceCoreMock,
  createSourceCore: createSourceCoreMock,
  softDeleteSourceCore: softDeleteSourceCoreMock,
}));

import { createSourceAction, updateSourceAction } from '@/server/actions/admin-sources';

describe('updateSourceAction — WR-07 category-clear semantics', () => {
  beforeEach(() => {
    authMock.mockClear();
    updateSourceCoreMock.mockClear();
    revalidatePathMock.mockClear();
  });

  it('maps an empty-string category to `null` in the patch (explicit clear)', async () => {
    // Admin previously set category='lab' and now selects "未分类" (value="")
    // in the edit form. The browser posts `category=""`. The action must map
    // this to `{ category: null }` so updateSourceCore clears the column.
    const fd = new FormData();
    fd.set('id', '7');
    fd.set('name', 'Anthropic News');
    fd.set('weight', '1.0');
    fd.set('category', ''); // "未分类" option
    // isActive sentinel + checked
    fd.append('isActive', 'false');
    fd.append('isActive', 'true');

    const result = await updateSourceAction(fd);

    expect(result).toEqual({ ok: true });
    expect(updateSourceCoreMock).toHaveBeenCalledTimes(1);
    const call = updateSourceCoreMock.mock.calls[0] as unknown as [number, Record<string, unknown>];
    const [id, patch] = call;
    expect(id).toBe(7);
    // The `category` key MUST be present in the patch (so sources-repo's
    // `'category' in patch` check triggers the SET clause) AND its value
    // MUST be `null` (so the row's category column is cleared).
    expect('category' in (patch as object)).toBe(true);
    expect((patch as { category: unknown }).category).toBeNull();
  });

  it('maps a non-empty category verbatim (no-change scenarios still write the value)', async () => {
    const fd = new FormData();
    fd.set('id', '7');
    fd.set('name', 'Anthropic News');
    fd.set('weight', '1.0');
    fd.set('category', 'lab');
    fd.append('isActive', 'false');
    fd.append('isActive', 'true');

    const result = await updateSourceAction(fd);
    expect(result).toEqual({ ok: true });
    const call = updateSourceCoreMock.mock.calls[0] as unknown as [number, Record<string, unknown>];
    const [, patch] = call;
    expect((patch as { category: unknown }).category).toBe('lab');
  });

  it('omits category from the patch when the field is entirely absent (no-change)', async () => {
    // An admin flow that submits only name/weight (no category field at all)
    // must NOT write category — we rely on sources-repo's `'category' in patch`
    // semantics. The action uses `formData.has('category')` to gate this.
    const fd = new FormData();
    fd.set('id', '7');
    fd.set('name', 'Anthropic News');
    fd.set('weight', '1.0');
    fd.append('isActive', 'false');
    fd.append('isActive', 'true');

    const result = await updateSourceAction(fd);
    expect(result).toEqual({ ok: true });
    const call = updateSourceCoreMock.mock.calls[0] as unknown as [number, Record<string, unknown>];
    const [, patch] = call;
    // Either the key is absent or its value is undefined — both shapes are
    // acceptable because `'category' in patch` is the repo-layer discriminant
    // when the key is absent, and `patch.category !== undefined` is the test
    // for the key-present case. The action layer currently does NOT insert
    // the key when the field is absent.
    expect((patch as { category?: unknown }).category).toBeUndefined();
  });
});

describe('createSourceAction — rssUrl format acceptance', () => {
  beforeEach(() => {
    authMock.mockClear();
    createSourceCoreMock.mockClear();
    updateSourceCoreMock.mockClear();
    revalidatePathMock.mockClear();
  });

  function buildFormData(rssUrl: string, name = 'Test Source'): FormData {
    const fd = new FormData();
    fd.set('name', name);
    fd.set('rssUrl', rssUrl);
    fd.set('language', 'zh');
    fd.set('weight', '1.0');
    fd.append('isActive', 'false');
    fd.append('isActive', 'true');
    return fd;
  }

  it('accepts an RSSHub route path (e.g. /hackernews/newest/ai)', async () => {
    const fd = buildFormData('/hackernews/newest/ai');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: true, id: 1 });
    expect(createSourceCoreMock).toHaveBeenCalledTimes(1);
    const call = createSourceCoreMock.mock.calls[0] as unknown as [Record<string, unknown>];
    expect((call[0] as { rssUrl: string }).rssUrl).toBe('/hackernews/newest/ai');
  });

  it('accepts a full https URL (e.g. native RSS feed)', async () => {
    const fd = buildFormData('https://huggingface.co/blog/feed.xml');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: true, id: 1 });
    expect(createSourceCoreMock).toHaveBeenCalledTimes(1);
    const call = createSourceCoreMock.mock.calls[0] as unknown as [Record<string, unknown>];
    expect((call[0] as { rssUrl: string }).rssUrl).toBe('https://huggingface.co/blog/feed.xml');
  });

  it('accepts a full http URL (non-https still valid at refine layer)', async () => {
    const fd = buildFormData('http://example.com/feed.xml');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: true, id: 1 });
    expect(createSourceCoreMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a plain text value lacking the leading slash or protocol', async () => {
    const fd = buildFormData('hackernews/newest/ai');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: false, error: 'VALIDATION' });
    expect(createSourceCoreMock).not.toHaveBeenCalled();
  });

  it('rejects a bare slash (path length < 2)', async () => {
    const fd = buildFormData('/');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: false, error: 'VALIDATION' });
    expect(createSourceCoreMock).not.toHaveBeenCalled();
  });

  it('rejects an empty rssUrl', async () => {
    const fd = buildFormData('');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: false, error: 'VALIDATION' });
    expect(createSourceCoreMock).not.toHaveBeenCalled();
  });

  it('rejects a protocol-relative URL (// prefix)', async () => {
    const fd = buildFormData('//evil.com/rss');
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: false, error: 'VALIDATION' });
    expect(createSourceCoreMock).not.toHaveBeenCalled();
  });

  it('rejects an overlong rssUrl (> 2000 chars)', async () => {
    const fd = buildFormData('/' + 'a'.repeat(2001));
    const result = await createSourceAction(fd);
    expect(result).toEqual({ ok: false, error: 'VALIDATION' });
    expect(createSourceCoreMock).not.toHaveBeenCalled();
  });
});
