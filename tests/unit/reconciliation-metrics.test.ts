import { describe, expect, it } from 'vitest';
import { anomalyContextFor, formatPercentage, reconciliationMetricsFor } from '../../src/domain/metrics/reconciliation-metrics.js';
import { reconciliationBootstrapConfig } from '../../src/main/bootstrap/reconciliation-config.js';

describe('reconciliation summary metrics', () => {
  it('returns safe zero metrics and one-decimal display values', () => {
    expect(reconciliationMetricsFor([])).toEqual({ total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 });
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(1 / 3)).toBe('33.3%');
  });

  it('evaluates the percentage-point threshold exactly without rounding or tolerance', () => {
    const thresholds = { minimumPercentagePointIncrease: .125, minimumBaselineMultiple: 1 };
    const rates = [.25, .25, .25, .25, .25];
    expect(anomalyContextFor(.374999, rates, thresholds)).toMatchObject({ kind: 'normal' });
    expect(anomalyContextFor(.375, rates, thresholds)).toMatchObject({ kind: 'warning' });
  });

  it('evaluates the baseline-multiple threshold exactly without rounding or tolerance', () => {
    const thresholds = { minimumPercentagePointIncrease: .01, minimumBaselineMultiple: 2 };
    const rates = [.25, .25, .25, .25, .25];
    expect(anomalyContextFor(.499999, rates, thresholds)).toMatchObject({ kind: 'normal' });
    expect(anomalyContextFor(.5, rates, thresholds)).toMatchObject({ kind: 'warning' });
  });

  it('uses the typed bootstrap thresholds for anomaly decisions', () => {
    expect(anomalyContextFor(.5, [.25, .25, .25, .25, .25], reconciliationBootstrapConfig.anomalyThresholds))
      .toMatchObject({ kind: 'warning', baselineUnresolvedRate: .25 });
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

  it('keeps an oversized seeded baseline calm and non-blocking', () => {
    expect(anomalyContextFor(.8, [.1, .1, .1, .1, .1, .1], { minimumPercentagePointIncrease: .05, minimumBaselineMultiple: 2 }))
      .toEqual({ kind: 'insufficient-history', currentUnresolvedRate: .8, historyCount: 6, baselineUnresolvedRate: null });
  });
});
