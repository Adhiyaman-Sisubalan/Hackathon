import { formatPercentage } from '../../domain/metrics/reconciliation-metrics.js';
import type { ReconciliationRunSummary } from '../../shared/contracts/reconciliation.js';
import styles from './SummaryStrip.module.css';

export function SummaryStrip({ summary }: { summary: ReconciliationRunSummary }) {
  const { metrics, anomaly } = summary;
  return <section className={styles.strip} aria-label="Reconciliation summary">
    <dl className={styles.metrics}>
      <div><dt>Total</dt><dd>{metrics.total}</dd></div>
      <div><dt>Matched</dt><dd>{metrics.matched}</dd></div>
      <div><dt>Unresolved</dt><dd>{metrics.unresolved}</dd></div>
      <div><dt>Reconciliation rate</dt><dd>{formatPercentage(metrics.reconciliationRate)}</dd></div>
      <div><dt>Unresolved rate</dt><dd>{formatPercentage(metrics.unresolvedRate)}</dd></div>
    </dl>
    {anomaly.kind === 'warning' && <p className={styles.warning} role="status"><strong>Unresolved rate is higher than the seeded baseline.</strong> Current {formatPercentage(anomaly.currentUnresolvedRate)}; five-run baseline {formatPercentage(anomaly.baselineUnresolvedRate)}. Continue in Results to investigate.</p>}
    {anomaly.kind === 'insufficient-history' && <p className={styles.context} role="status">Seeded history is insufficient for an anomaly check ({anomaly.historyCount} of 5 runs available).</p>}
  </section>;
}
