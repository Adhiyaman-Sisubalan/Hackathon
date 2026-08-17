export interface ReconciliationMetrics {
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
  readonly unresolvedRate: number;
}

/** Per-status totals for the four canonical Status IDs. Presentation reads these; the
    engine keeps `ReconciliationMetrics` as the authoritative matched/unresolved split. */
export interface ReconciliationStatusCounts {
  readonly matched: number;
  readonly unmatched: number;
  readonly 'missing-from-broker': number;
  readonly 'missing-from-ot-murex': number;
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

export function statusCountsFor(statuses: readonly string[]): ReconciliationStatusCounts {
  const counts = { matched: 0, unmatched: 0, 'missing-from-broker': 0, 'missing-from-ot-murex': 0 };
  for (const status of statuses) {
    if (status in counts) counts[status as keyof ReconciliationStatusCounts] += 1;
  }
  return counts;
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
