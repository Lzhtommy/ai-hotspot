/**
 * Plan 06-02 Task 1 — unit tests for computeSourceHealth.
 *
 * Asserts the health threshold semantics per ADMIN-06:
 *   - green: neither counter >= 1
 *   - yellow: either counter >= 1 (warning)
 *   - red: either counter >= 3 (user-visible alarm)
 *
 * Red dominates yellow dominates green — if errorCount >= 3 the badge is red even
 * if emptyCount is 0, because a source that consistently errors is as bad as one
 * that consistently produces nothing.
 */
import { describe, it, expect } from 'vitest';
import { computeSourceHealth } from '@/lib/admin/sources-repo';

describe('computeSourceHealth', () => {
  it('returns green when both counters are 0', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 0, consecutiveErrorCount: 0 })).toBe(
      'green',
    );
  });

  it('returns yellow when emptyCount is 1 and errorCount is 0', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 1, consecutiveErrorCount: 0 })).toBe(
      'yellow',
    );
  });

  it('returns yellow when emptyCount is 0 and errorCount is 1', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 0, consecutiveErrorCount: 1 })).toBe(
      'yellow',
    );
  });

  it('returns yellow when both counters are 2 (still below red threshold)', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 2, consecutiveErrorCount: 2 })).toBe(
      'yellow',
    );
  });

  it('returns red when emptyCount is 3 and errorCount is 0', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 3, consecutiveErrorCount: 0 })).toBe(
      'red',
    );
  });

  it('returns red when emptyCount is 0 and errorCount is 3', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 0, consecutiveErrorCount: 3 })).toBe(
      'red',
    );
  });

  it('returns red when both counters are 5 (well past threshold)', () => {
    expect(computeSourceHealth({ consecutiveEmptyCount: 5, consecutiveErrorCount: 5 })).toBe(
      'red',
    );
  });
});
