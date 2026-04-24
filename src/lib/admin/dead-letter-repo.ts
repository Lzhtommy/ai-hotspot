/**
 * Admin dead-letter repo — Phase 6 Plan 06-05 (OPS-03).
 *
 * Pure, deps-injected queries for the `/admin/dead-letter` admin page.
 * Mirrors the Phase 5 core-logic / adapter split
 * (`src/lib/user-actions/favorites-core.ts`) so the Server-Action layer
 * stays a thin `'use server'` wrapper and the DB logic is unit-testable
 * with a mock db.
 *
 * Exports:
 *   - listDeadLetterItems({limit})   — read view for the RSC page
 *   - retryItemCore({itemId})        — single-item retry with race guard
 *   - retryAllCore({limit})          — bulk retry (capped)
 *
 * Race guard (T-6-52): every write carries `WHERE status = 'dead_letter'`,
 * so two admins clicking 重试 on the same row concurrently cause the second
 * UPDATE to match zero rows rather than double-increment `retry_count`.
 *
 * retry_count increment (correctness): the SET clause uses Drizzle
 * `sql\`${items.retryCount} + 1\`` so the increment happens in-DB. A
 * JS read-then-write would race under concurrent retries even when the
 * status guard succeeds on both branches (they'd read the same pre-increment
 * value).
 *
 * Consumed by:
 *   - src/server/actions/admin-dead-letter.ts  (Task 2 adapter)
 *   - src/app/admin/dead-letter/page.tsx       (Task 2 RSC)
 *   - tests/unit/admin-dead-letter.test.ts     (Task 1 RED)
 */
import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, sources } from '@/lib/db/schema';

export interface DeadLetterRow {
  /** items.id is bigint; serialised to string for safe RSC → client transport. */
  id: string;
  title: string;
  sourceName: string | null;
  failureReason: string | null;
  retryCount: number;
  processedAt: Date | null;
  ingestedAt: Date;
  url: string;
}

export interface Deps {
  db?: typeof realDb;
}

export async function listDeadLetterItems(
  opts: { limit: number },
  deps: Deps = {},
): Promise<DeadLetterRow[]> {
  const d = deps.db ?? realDb;
  const rows = await d
    .select({
      id: items.id,
      title: items.title,
      sourceName: sources.name,
      failureReason: items.failureReason,
      retryCount: items.retryCount,
      processedAt: items.processedAt,
      ingestedAt: items.ingestedAt,
      url: items.url,
    })
    .from(items)
    .leftJoin(sources, eq(sources.id, items.sourceId))
    .where(eq(items.status, 'dead_letter'))
    .orderBy(desc(items.processedAt))
    .limit(opts.limit);
  return rows.map((r) => ({ ...r, id: String(r.id) }));
}

export async function retryItemCore(
  input: { itemId: bigint },
  deps: Deps = {},
): Promise<{ retried: boolean }> {
  const d = deps.db ?? realDb;
  const updated = await d
    .update(items)
    .set({
      status: 'pending',
      failureReason: null,
      processedAt: null,
      retryCount: dsql`${items.retryCount} + 1`,
    })
    .where(and(eq(items.id, input.itemId), eq(items.status, 'dead_letter')))
    .returning({ id: items.id });
  return { retried: updated.length > 0 };
}

export async function retryAllCore(
  input: { limit: number },
  deps: Deps = {},
): Promise<{ count: number }> {
  const d = deps.db ?? realDb;
  // Step 1 — select candidate ids (ordered by most-recent failure so admins
  // retry the freshest rows first when the cap bites).
  const targets = await d
    .select({ id: items.id })
    .from(items)
    .where(eq(items.status, 'dead_letter'))
    .orderBy(desc(items.processedAt))
    .limit(input.limit);
  if (targets.length === 0) return { count: 0 };

  // Step 2 — bulk UPDATE via raw SQL. We use raw SQL (not the query builder)
  // because Drizzle's .update().set({retryCount: sql`... + 1`}) + inArray()
  // composition does not reliably include the `AND status = 'dead_letter'`
  // race guard in a single atomic UPDATE once the id list is already known
  // (the SELECT ran one roundtrip earlier). Raw SQL keeps the race guard
  // explicit and exact.
  const ids = targets.map((t) => t.id);
  await d.execute(dsql`
    UPDATE items
    SET status = 'pending',
        failure_reason = NULL,
        processed_at = NULL,
        retry_count = retry_count + 1
    WHERE id IN ${ids} AND status = 'dead_letter'
  `);
  return { count: ids.length };
}

// Silence unused-import warnings when tree-shaking picks only part of the file.
void inArray;
