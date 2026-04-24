/**
 * Admin sources repo — Phase 6 Plan 06-02 (ADMIN-02 … ADMIN-06).
 *
 * Pure DB access layer for /admin/sources. Mirrors the core/adapter split
 * established by src/lib/ingest/fetch-source-core.ts: the real Drizzle `db`
 * is injected so unit tests can pass a lightweight mock that records calls
 * and asserts on the SQL-fragment shape without spinning up Neon.
 *
 * All functions accept an optional `deps.db` so a test can substitute a
 * fake chain-builder. Production callers omit the dep and receive the real
 * singleton via the module-level import.
 *
 * Soft-delete semantics (ADMIN-05 / D-unwind):
 *   - `softDeleteSourceCore(id)` sets deleted_at = now() and is_active = false.
 *   - `listSourcesForAdmin()` filters `deleted_at IS NULL`, so the row
 *     vanishes from the admin table while items FK'd to the source remain
 *     in place (no cascade on soft-delete).
 *   - The ingestion poller ALSO filters `deleted_at IS NULL` — a source
 *     soft-deleted mid-hour is not polled on the next tick. That filter
 *     lives in `src/trigger/ingest-hourly.ts`; this module is not
 *     responsible for enforcing it at the enumeration boundary.
 *
 * Health thresholds (ADMIN-06):
 *   - red   ≥ 3 consecutive empty OR error polls — user-visible alarm
 *   - yellow ≥ 1 consecutive empty OR error poll — early warning
 *   - green otherwise
 *   The "red dominates yellow" rule keeps the badge deterministic regardless
 *   of which counter tripped first.
 *
 * Consumed by:
 *   - src/app/admin/sources/page.tsx                     (listSourcesForAdmin)
 *   - src/app/admin/sources/[id]/edit/page.tsx           (getSourceByIdForAdmin)
 *   - src/server/actions/admin-sources.ts                (*Core mutations)
 *   - src/components/admin/source-health-badge.tsx       (computeSourceHealth)
 *   - tests/unit/admin-sources.test.ts
 *   - tests/unit/source-health.test.ts
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';

export interface SourceAdminRow {
  id: number;
  name: string;
  rssUrl: string;
  language: string;
  weight: string;
  isActive: boolean;
  category: string | null;
  consecutiveEmptyCount: number;
  consecutiveErrorCount: number;
  lastFetchedAt: Date | null;
  createdAt: Date;
}

type Deps = { db?: typeof realDb };

/** Column selection shared by list + getById so both queries return the same shape. */
const SOURCE_ADMIN_COLUMNS = {
  id: sources.id,
  name: sources.name,
  rssUrl: sources.rssUrl,
  language: sources.language,
  weight: sources.weight,
  isActive: sources.isActive,
  category: sources.category,
  consecutiveEmptyCount: sources.consecutiveEmptyCount,
  consecutiveErrorCount: sources.consecutiveErrorCount,
  lastFetchedAt: sources.lastFetchedAt,
  createdAt: sources.createdAt,
} as const;

/**
 * List every non-soft-deleted source for the admin table, newest first.
 * The `deleted_at IS NULL` filter is the ADMIN-05 contract — a soft-deleted
 * source must disappear from this view (but its items remain in the feed).
 */
export async function listSourcesForAdmin(deps: Deps = {}): Promise<SourceAdminRow[]> {
  const d = deps.db ?? realDb;
  const rows = await d
    .select(SOURCE_ADMIN_COLUMNS)
    .from(sources)
    .where(isNull(sources.deletedAt))
    .orderBy(desc(sources.createdAt));
  return rows as SourceAdminRow[];
}

/**
 * Load a single source by id for the edit page. Returns null when the
 * source does not exist OR has been soft-deleted — admins should not be
 * able to stumble into editing a deleted source via a stale URL.
 */
export async function getSourceByIdForAdmin(
  id: number,
  deps: Deps = {},
): Promise<SourceAdminRow | null> {
  const d = deps.db ?? realDb;
  const rows = await d
    .select(SOURCE_ADMIN_COLUMNS)
    .from(sources)
    .where(and(eq(sources.id, id), isNull(sources.deletedAt)))
    .limit(1);
  const arr = rows as SourceAdminRow[];
  return arr[0] ?? null;
}

export interface CreateSourceInput {
  name: string;
  rssUrl: string;
  /** Defaults to 'zh' — matches schema default. */
  language?: 'zh' | 'en';
  /** Numeric string matching `numeric(3,1)` — e.g. '1.0', '2.5'. Defaults to '1.0'. */
  weight?: string;
  /** Taxonomy tag; free-form text per D-admin-taxonomy. */
  category?: string | null;
  /** Defaults to true (new sources start active). */
  isActive?: boolean;
}

/**
 * Insert a new source. Returns the generated id. Caller is responsible for
 * admin-role enforcement (see src/server/actions/admin-sources.ts).
 */
export async function createSourceCore(
  input: CreateSourceInput,
  deps: Deps = {},
): Promise<{ id: number }> {
  const d = deps.db ?? realDb;
  const values = {
    name: input.name,
    rssUrl: input.rssUrl,
    language: input.language ?? 'zh',
    weight: input.weight ?? '1.0',
    category: input.category ?? null,
    isActive: input.isActive ?? true,
  };
  const rows = (await d.insert(sources).values(values).returning({ id: sources.id })) as Array<{
    id: number;
  }>;
  return { id: rows[0]!.id };
}

/**
 * Patch the editable subset of a source row. Only the keys actually
 * present in `patch` are written — so `updateSourceCore(id, { weight: '2.0' })`
 * leaves `name`, `category`, `isActive` untouched.
 *
 * A call with an empty patch is a no-op: the builder is not invoked because
 * Drizzle rejects `.set({})` with "No values to set".
 */
export async function updateSourceCore(
  id: number,
  patch: Partial<Pick<SourceAdminRow, 'name' | 'weight' | 'isActive' | 'category'>>,
  deps: Deps = {},
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.weight !== undefined) set.weight = patch.weight;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  // category is nullable — explicitly accept null as a meaningful value
  if ('category' in patch) set.category = patch.category ?? null;

  if (Object.keys(set).length === 0) return;

  const d = deps.db ?? realDb;
  await d.update(sources).set(set).where(eq(sources.id, id));
}

/**
 * Soft-delete a source. Sets `deleted_at = now()` and flips `is_active`
 * to false so the ingestion poller (which filters both `deleted_at IS NULL`
 * AND `is_active = true`) skips the row at the next tick.
 *
 * The WHERE includes `deleted_at IS NULL` so a double-delete is a no-op —
 * we never overwrite an earlier deletion timestamp.
 */
export async function softDeleteSourceCore(id: number, deps: Deps = {}): Promise<void> {
  const d = deps.db ?? realDb;
  await d
    .update(sources)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(sources.id, id), isNull(sources.deletedAt)));
}

/**
 * Three-state health classifier for the admin row's badge. Red dominates
 * yellow dominates green — this ordering matters because if `errorCount`
 * is 3 while `emptyCount` is 0 we still want the red alarm (a source that
 * errors repeatedly is as broken as a silent one).
 *
 * Pure function — no IO, safe to call from an RSC or a Client Component.
 */
export function computeSourceHealth(
  s: Pick<SourceAdminRow, 'consecutiveEmptyCount' | 'consecutiveErrorCount'>,
): 'green' | 'yellow' | 'red' {
  if (s.consecutiveEmptyCount >= 3 || s.consecutiveErrorCount >= 3) return 'red';
  if (s.consecutiveEmptyCount >= 1 || s.consecutiveErrorCount >= 1) return 'yellow';
  return 'green';
}
