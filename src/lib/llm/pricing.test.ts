import { describe, it, expect } from 'vitest';
import { computeHaikuCostUsd, computeVoyageCostUsd } from './pricing';

describe('computeHaikuCostUsd', () => {
  it('1M input tokens = $1.00', () => {
    expect(
      computeHaikuCostUsd({
        input_tokens: 1_000_000,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
    ).toBeCloseTo(1.0);
  });

  it('1M output tokens = $5.00', () => {
    expect(
      computeHaikuCostUsd({
        input_tokens: 0,
        output_tokens: 1_000_000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
    ).toBeCloseTo(5.0);
  });

  it('1M cache read tokens = $0.10 (10% of input rate)', () => {
    expect(
      computeHaikuCostUsd({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 1_000_000,
        cache_creation_input_tokens: 0,
      }),
    ).toBeCloseTo(0.1);
  });

  it('1M cache write tokens = $1.25 (125% of input rate)', () => {
    expect(
      computeHaikuCostUsd({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 1_000_000,
      }),
    ).toBeCloseTo(1.25);
  });

  it('all four token types combined', () => {
    const cost = computeHaikuCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(1.0 + 5.0 + 0.1 + 1.25);
  });

  it('zero tokens = $0.00', () => {
    expect(
      computeHaikuCostUsd({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
    ).toBe(0);
  });
});

describe('computeVoyageCostUsd', () => {
  it('1M tokens = $0.06', () => {
    expect(computeVoyageCostUsd(1_000_000)).toBeCloseTo(0.06);
  });

  it('0 tokens = $0.00', () => {
    expect(computeVoyageCostUsd(0)).toBe(0);
  });

  it('500k tokens = $0.03', () => {
    expect(computeVoyageCostUsd(500_000)).toBeCloseTo(0.03);
  });
});
