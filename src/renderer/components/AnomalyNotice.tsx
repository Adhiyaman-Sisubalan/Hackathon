import { formatPercentage } from '../../domain/metrics/reconciliation-metrics.js';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import styles from './AnomalyNotice.module.css';

/**
 * The seeded-baseline check, on its own so both surfaces can carry it: Overview shows it
 * beside the charts, the Results workspace shows it under the summary metrics. It is a
 * warning for human judgement, never a run failure.
 */
export function AnomalyNotice({ summary }: { summary: ReconciliationRunSummary | ReconciliationWorkspace }) {
  const { anomaly } = summary;
  if (anomaly.kind === 'warning') {
    return <p className={styles.alert} role="status">
      <strong>Unresolved rate is higher than the seeded baseline.</strong> Current {formatPercentage(anomaly.currentUnresolvedRate)}; five-run baseline {formatPercentage(anomaly.baselineUnresolvedRate)}. Continue in Results to investigate.
    </p>;
  }
  if (anomaly.kind === 'insufficient-history') {
    return <p className={styles.context} role="status">Seeded history is insufficient for an anomaly check ({anomaly.historyCount} of 5 runs available).</p>;
  }
  return null;
}
