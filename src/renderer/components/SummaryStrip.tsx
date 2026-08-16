import { formatPercentage } from '../../domain/metrics/reconciliation-metrics.js';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import styles from './SummaryStrip.module.css';

export function SummaryStrip({ summary }: { summary: ReconciliationRunSummary | ReconciliationWorkspace }) {
  const { metrics, anomaly } = summary;
  const review = 'reviewProgress' in summary ? summary.reviewProgress : undefined;
  const reviewed = review && review.totalUnmatched > 0 ? review.reviewedUnmatched / review.totalUnmatched : 1;
  return <section className={styles.strip} aria-label="Reconciliation summary">
    <dl className={styles.metrics}>
      <div className={styles.metric}><dt>Total</dt><dd>{metrics.total}</dd></div>
      <div className={styles.metric}><dt>Matched</dt><dd className={styles.success}>{metrics.matched}</dd></div>
      <div className={styles.metric}><dt>Unresolved</dt><dd className={metrics.unresolved > 0 ? styles.warning : undefined}>{metrics.unresolved}</dd></div>
      <div className={styles.metric}><dt>Reconciliation rate</dt><dd>{formatPercentage(metrics.reconciliationRate)}</dd></div>
      <div className={styles.metric}><dt>Unresolved rate</dt><dd>{formatPercentage(metrics.unresolvedRate)}</dd></div>
      {review && <div className={styles.metric}><dt>Unmatched reviewed</dt><dd>{review.reviewedUnmatched} / {review.totalUnmatched}<span className={styles.meter} aria-hidden="true"><span style={{ inlineSize: `${Math.round(reviewed * 100)}%` }} /></span></dd></div>}
    </dl>
    {anomaly.kind === 'warning' && <p className={styles.alert} role="status"><strong>Unresolved rate is higher than the seeded baseline.</strong> Current {formatPercentage(anomaly.currentUnresolvedRate)}; five-run baseline {formatPercentage(anomaly.baselineUnresolvedRate)}. Continue in Results to investigate.</p>}
    {anomaly.kind === 'insufficient-history' && <p className={styles.context} role="status">Seeded history is insufficient for an anomaly check ({anomaly.historyCount} of 5 runs available).</p>}
  </section>;
}
