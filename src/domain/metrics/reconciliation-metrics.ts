export interface ReconciliationMetrics {
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
  readonly unresolvedRate: number;
}

export interface AnomalyThresholds {
  readonly minimumPercentagePointIncrease: number;
  readonly minimumBaselineMultiple: number;
}

export type AnomalyContext =
  | { readonly kind: 'insufficient-history'; readonly currentUnresolvedRate: number; readonly historyCount: number; readonly baselineUnresolvedRate: null }
  | { readonly kind: 'normal'; readonly currentUnresolvedRate: number; readonly historyCount: 5; readonly baselineUnresolvedRate: number }
  | { readonly kind: 'warning'; readonly currentUnresolvedRate: number; readonly historyCount: 5; readonly baselineUnresolvedRate: number };

export function reconciliationMetricsFor(statuses: readonly string[]): ReconciliationMetrics {
  const total = statuses.length;
  const matched = statuses.filter((status) => status === 'matched').length;
  const unresolved = total - matched;
  return {
    total,
    matched,
    unresolved,
    reconciliationRate: total === 0 ? 0 : matched / total,
    unresolvedRate: total === 0 ? 0 : unresolved / total
  };
}

export function anomalyContextFor(currentUnresolvedRate: number, seededHistoricalUnresolvedRates: readonly number[], thresholds: AnomalyThresholds): AnomalyContext {
  if (seededHistoricalUnresolvedRates.length !== 5) {
    return { kind: 'insufficient-history', currentUnresolvedRate, historyCount: seededHistoricalUnresolvedRates.length, baselineUnresolvedRate: null };
  }
  const baselineUnresolvedRate = seededHistoricalUnresolvedRates.reduce((sum, rate) => sum + rate, 0) / seededHistoricalUnresolvedRates.length;
  const isWarning = currentUnresolvedRate - baselineUnresolvedRate >= thresholds.minimumPercentagePointIncrease
    && currentUnresolvedRate >= baselineUnresolvedRate * thresholds.minimumBaselineMultiple;
  return { kind: isWarning ? 'warning' : 'normal', currentUnresolvedRate, historyCount: 5, baselineUnresolvedRate };
}

export function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
