import { describe, expect, it } from 'vitest';
import { anomalyContextFor, formatPercentage, reconciliationMetricsFor } from '../../src/domain/metrics/reconciliation-metrics.js';

describe('reconciliation summary metrics', () => {
  it('returns safe zero metrics and one-decimal display values', () => {
    expect(reconciliationMetricsFor([])).toEqual({ total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 });
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(1 / 3)).toBe('33.3%');
  });

  it('requires both anomaly boundaries against the unrounded five-run baseline', () => {
    const thresholds = { minimumPercentagePointIncrease: .05, minimumBaselineMultiple: 2 };
    const rates = [.1, .1, .1, .1, .11];
    const normal = anomalyContextFor(.203, rates, thresholds);
    const warning = anomalyContextFor(.204, rates, thresholds);
    expect(normal).toMatchObject({ kind: 'normal' });
    expect(warning).toMatchObject({ kind: 'warning' });
    expect(normal.baselineUnresolvedRate).toBeCloseTo(.102);
    expect(warning.baselineUnresolvedRate).toBeCloseTo(.102);
  });

  it('does not warn when the percentage-point increase passes but the baseline multiple fails', () => {
    expect(anomalyContextFor(.19, [.1, .1, .1, .1, .1], { minimumPercentagePointIncrease: .05, minimumBaselineMultiple: 2 }))
      .toMatchObject({ kind: 'normal', baselineUnresolvedRate: .1 });
  });

  it('does not warn when the baseline multiple passes but the percentage-point increase fails', () => {
    expect(anomalyContextFor(.08, [.04, .04, .04, .04, .04], { minimumPercentagePointIncrease: .05, minimumBaselineMultiple: 2 }))
      .toMatchObject({ kind: 'normal', baselineUnresolvedRate: .04 });
  });

  it('keeps an incomplete seeded baseline calm and non-blocking', () => {
    expect(anomalyContextFor(.8, [.1, .1, .1, .1], { minimumPercentagePointIncrease: .05, minimumBaselineMultiple: 2 }))
      .toEqual({ kind: 'insufficient-history', currentUnresolvedRate: .8, historyCount: 4, baselineUnresolvedRate: null });
  });
});
