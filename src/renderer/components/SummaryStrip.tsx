import { formatPercentage } from '../../domain/metrics/reconciliation-metrics.js';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import { AnomalyNotice } from './AnomalyNotice.js';
import styles from './SummaryStrip.module.css';

export function SummaryStrip({ summary }: { summary: ReconciliationRunSummary | ReconciliationWorkspace }) {
  const { metrics } = summary;
  const review = 'reviewProgress' in summary ? summary.reviewProgress : undefined;
  const reviewed = review && review.totalUnmatched > 0 ? review.reviewedUnmatched / review.totalUnmatched : 1;
  // These tiles are the Results workspace's readout. Overview states the same numbers
  // through its charts, so it composes the anomaly notice on its own instead.
  return <section className={styles.strip} aria-label="Reconciliation summary">
    <dl className={styles.metrics}>
      <div className={styles.metric}><dt>Total</dt><dd>{metrics.total}</dd></div>
      <div className={styles.metric}><dt>Matched</dt><dd className={styles.success}>{metrics.matched}</dd></div>
      <div className={styles.metric}><dt>Unresolved</dt><dd className={metrics.unresolved > 0 ? styles.warning : undefined}>{metrics.unresolved}</dd></div>
      <div className={styles.metric}><dt>Reconciliation rate</dt><dd>{formatPercentage(metrics.reconciliationRate)}</dd></div>
      <div className={styles.metric}><dt>Unresolved rate</dt><dd>{formatPercentage(metrics.unresolvedRate)}</dd></div>
      {review && <div className={styles.metric}><dt>Mismatched reviewed</dt><dd>{review.reviewedUnmatched} / {review.totalUnmatched}<span className={styles.meter} aria-hidden="true"><span style={{ inlineSize: `${Math.round(reviewed * 100)}%` }} /></span></dd></div>}
    </dl>
    <AnomalyNotice summary={summary} />
  </section>;
}
