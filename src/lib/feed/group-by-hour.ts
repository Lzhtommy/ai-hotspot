/**
 * Timeline hour-bucketing utility — Phase 4 FEED-05, D-20, D-21.
 *
 * Groups feed items by their publication hour in Asia/Shanghai timezone,
 * sorts groups newest-first, sorts items within each group by score DESC.
 * Day labels are computed relative to the `now` anchor (default: current time)
 * so the function is deterministic in tests — pass a pinned Date as `now`.
 *
 * Invariants:
 *   - All time conversions use date-fns-tz `formatInTimeZone` / `toZonedTime`
 *     (never `toLocaleString`) to avoid server/client hydration mismatches.
 *   - Asia/Shanghai has no DST — bucket keys are stable across any wall-clock span.
 *   - Empty input returns an empty array with no side-effects.
 *
 * Consumed by:
 *   - src/components/feed/timeline.tsx
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

const TZ = 'Asia/Shanghai';

/** Minimal shape required from feed items. Downstream code may extend this. */
export type FeedItem = {
  id: string;
  publishedAt: Date;
  score: number;
  [key: string]: unknown;
};

export type TimelineGroup = {
  /** 'YYYY-MM-DDTHH' in Asia/Shanghai — unique bucket key */
  bucketKey: string;
  /** '今天' | '昨天' | 'M月D日' — relative to `now` in Asia/Shanghai */
  dayLabel: string;
  /** 'HH:00' — always 2-digit, 24h */
  hourLabel: string;
  /** Items within this hour, sorted by score DESC */
  items: FeedItem[];
};

/**
 * Groups `items` by publication hour in Asia/Shanghai timezone.
 *
 * @param items  Feed items to group. Must have `publishedAt` (UTC Date) and `score`.
 * @param now    Anchor for relative day labels. Defaults to current time; inject in tests.
 * @returns      Timeline groups sorted newest-first.
 */
export function groupByHour(items: FeedItem[], now: Date = new Date()): TimelineGroup[] {
  if (items.length === 0) return [];

  const nowZoned = toZonedTime(now, TZ);
  const today = startOfDay(nowZoned);

  // Bucket items by their Asia/Shanghai hour key
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = formatInTimeZone(item.publishedAt, TZ, "yyyy-MM-dd'T'HH");
    const existing = buckets.get(key);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)) // newest bucket first
    .map(([bucketKey, groupItems]) => {
      // Parse the bucket key back to a Date for label computation.
      // Append ':00:00+08:00' so the parse is unambiguous (Asia/Shanghai = UTC+8, no DST).
      const when = new Date(bucketKey + ':00:00+08:00');

      const whenZoned = toZonedTime(when, TZ);
      const diffDays = differenceInCalendarDays(today, startOfDay(whenZoned));

      const dayLabel =
        diffDays === 0 ? '今天' : diffDays === 1 ? '昨天' : formatInTimeZone(when, TZ, 'M月d日');

      const hourLabel = formatInTimeZone(when, TZ, 'HH:00');

      const sortedItems = [...groupItems].sort((a, b) => b.score - a.score);

      return { bucketKey, dayLabel, hourLabel, items: sortedItems };
    });
}
