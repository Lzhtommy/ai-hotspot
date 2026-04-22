/**
 * Tests for groupByHour — Asia/Shanghai hour-bucketing invariants.
 *
 * All `now` values and `publishedAt` timestamps are explicit UTC Dates so the
 * test suite is deterministic regardless of the machine's local timezone.
 */

import { describe, expect, it } from 'vitest';
import { groupByHour, type FeedItem } from './group-by-hour';

/** Helper: build a minimal FeedItem */
function makeItem(id: string, publishedAt: Date, score = 50): FeedItem {
  return { id, publishedAt, score };
}

// ============================================================================
// Test anchor:
//   now  = 2026-04-22T09:00:00+08:00 = 2026-04-22T01:00:00Z
// ============================================================================
const NOW = new Date('2026-04-22T01:00:00Z'); // 09:00 in Asia/Shanghai

describe('groupByHour', () => {
  it('returns empty array for empty input', () => {
    expect(groupByHour([], NOW)).toEqual([]);
  });

  it('produces one group when all items share the same hour', () => {
    const items = [
      makeItem('a', new Date('2026-04-22T00:00:00Z'), 80), // 08:00 Shanghai
      makeItem('b', new Date('2026-04-22T00:15:00Z'), 60), // 08:00 Shanghai
      makeItem('c', new Date('2026-04-22T00:45:00Z'), 90), // 08:00 Shanghai
    ];
    const groups = groupByHour(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].hourLabel).toBe('08:00');
    // items sorted score DESC: c(90) → a(80) → b(60)
    expect(groups[0].items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('produces one group when items have identical timestamps', () => {
    const ts = new Date('2026-04-22T00:30:00Z');
    const items = [makeItem('x', ts, 70), makeItem('y', ts, 70)];
    expect(groupByHour(items, NOW)).toHaveLength(1);
  });

  it('produces N groups for N distinct hours', () => {
    const items = [
      makeItem('h1', new Date('2026-04-22T00:00:00Z')), // 08:00 Shanghai
      makeItem('h2', new Date('2026-04-22T01:00:00Z')), // 09:00 Shanghai
      makeItem('h3', new Date('2026-04-22T02:00:00Z')), // 10:00 Shanghai
    ];
    const groups = groupByHour(items, NOW);
    expect(groups).toHaveLength(3);
  });

  it('groups sort newest-first', () => {
    const items = [
      makeItem('old', new Date('2026-04-22T00:00:00Z')), // 08:00 Shanghai
      makeItem('new', new Date('2026-04-22T02:00:00Z')), // 10:00 Shanghai
    ];
    const groups = groupByHour(items, NOW);
    expect(groups[0].hourLabel).toBe('10:00');
    expect(groups[1].hourLabel).toBe('08:00');
  });

  it('assigns dayLabel 今天 for items published today in Asia/Shanghai', () => {
    // publishedAt 2026-04-22T00:00:00Z = 08:00 Shanghai = "today"
    const items = [makeItem('today', new Date('2026-04-22T00:00:00Z'))];
    const groups = groupByHour(items, NOW);
    expect(groups[0].dayLabel).toBe('今天');
  });

  it('assigns dayLabel 昨天 for items from yesterday in Asia/Shanghai', () => {
    // 2026-04-21T00:00:00Z = 08:00 on 2026-04-21 in Shanghai = yesterday
    const items = [makeItem('yday', new Date('2026-04-21T00:00:00Z'))];
    const groups = groupByHour(items, NOW);
    expect(groups[0].dayLabel).toBe('昨天');
  });

  it('assigns M月D日 format for items older than yesterday', () => {
    // 2026-04-20 in Shanghai = 2 days ago
    const items = [makeItem('old', new Date('2026-04-20T00:00:00Z'))];
    const groups = groupByHour(items, NOW);
    expect(groups[0].dayLabel).toBe('4月20日');
  });

  it('assigns correct dayLabel and hourLabel for the canonical anchor case', () => {
    // RESEARCH Pattern 3 canonical example:
    //   publishedAt = 2026-04-22T00:00:00Z → in Shanghai = 2026-04-22T08:00 → "今天", "08:00"
    const items = [makeItem('anchor', new Date('2026-04-22T00:00:00Z'))];
    const groups = groupByHour(items, NOW);
    expect(groups[0].dayLabel).toBe('今天');
    expect(groups[0].hourLabel).toBe('08:00');
  });

  it('produces two groups for items exactly 24 hours apart', () => {
    const items = [
      makeItem('a', new Date('2026-04-21T00:00:00Z')), // 08:00 on Apr 21
      makeItem('b', new Date('2026-04-22T00:00:00Z')), // 08:00 on Apr 22
    ];
    const groups = groupByHour(items, NOW);
    expect(groups).toHaveLength(2);
    // Both at HH=08:00; day labels differ
    expect(groups[0].dayLabel).toBe('今天');
    expect(groups[1].dayLabel).toBe('昨天');
    expect(groups[0].hourLabel).toBe('08:00');
    expect(groups[1].hourLabel).toBe('08:00');
  });

  it('sorts items within a group by score DESC', () => {
    const ts = new Date('2026-04-22T00:00:00Z');
    const items = [
      makeItem('low', ts, 20),
      makeItem('high', ts, 95),
      makeItem('mid', ts, 55),
    ];
    const [group] = groupByHour(items, NOW);
    expect(group.items.map((i) => i.id)).toEqual(['high', 'mid', 'low']);
  });

  it('handles cross-day boundary: items spanning today and two days ago', () => {
    const items = [
      makeItem('today', new Date('2026-04-22T00:30:00Z')), // today Shanghai
      makeItem('ago2', new Date('2026-04-20T12:00:00Z')),  // 2 days ago Shanghai
    ];
    const groups = groupByHour(items, NOW);
    expect(groups).toHaveLength(2);

    const todayGroup = groups.find((g) => g.dayLabel === '今天');
    const ago2Group = groups.find((g) => g.dayLabel === '4月20日');
    expect(todayGroup).toBeDefined();
    expect(ago2Group).toBeDefined();
  });

  it('Asia/Shanghai has no DST — items in the same UTC day map to same bucket across 24h', () => {
    // Demonstrate that the bucket key is stable: two items in the same Shanghai hour
    // but 23min apart still land in the same bucket
    const items = [
      makeItem('a', new Date('2026-04-22T00:00:00Z')), // 08:00:00 Shanghai
      makeItem('b', new Date('2026-04-22T00:23:00Z')), // 08:23:00 Shanghai
    ];
    const groups = groupByHour(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].bucketKey).toBe('2026-04-22T08');
  });
});
