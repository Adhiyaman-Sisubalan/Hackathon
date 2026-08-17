import { statusCountsFor } from '../../domain/metrics/reconciliation-metrics.js';
import { reconciliationStatuses, type ReconciliationStatus } from '../../domain/reconciliation/reconciliation.js';
import type { ReconciliationRunSummary, ReconciliationStatusCounts, ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import styles from './RunComposition.module.css';

const labels: Record<ReconciliationStatus, string> = {
  matched: 'Matched', unmatched: 'Unmatched', 'missing-from-broker': 'Missing from Broker', 'missing-from-ot-murex': 'Missing from OT/MUREX'
};

/** The same marker glyphs the Status pills use, so the chart never leans on colour alone. */
const markers: Record<ReconciliationStatus, string> = {
  matched: '✓', unmatched: '!', 'missing-from-broker': '◀', 'missing-from-ot-murex': '▶'
};

/** Plain-language gloss of what each Status means for the desk. */
const meanings: Record<ReconciliationStatus, string> = {
  matched: 'Agreed on both sides',
  unmatched: 'Paired but values differ',
  'missing-from-broker': 'In OT/MUREX only',
  'missing-from-ot-murex': 'In Broker only'
};

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** ~2px of surface between touching arcs at the rendered size, in viewBox units. */
const GAP = 1.5;
/** Keeps a single-record slice visible instead of collapsing it into the gap. */
const MINIMUM_ARC = 0.8;

function countsFor(summary: ReconciliationRunSummary | ReconciliationWorkspace): ReconciliationStatusCounts | null {
  if (summary.statusCounts) return summary.statusCounts;
  // A snapshot from before the breakdown existed still carries its Results.
  if ('results' in summary) return statusCountsFor(summary.results.map((result) => result.status));
  return null;
}

export function RunComposition({ summary }: { summary: ReconciliationRunSummary | ReconciliationWorkspace }) {
  const counts = countsFor(summary);
  if (!counts) return null;
  const total = summary.metrics.total;
  const rows = reconciliationStatuses.map((status) => ({
    status,
    count: counts[status],
    share: total === 0 ? 0 : counts[status] / total
  }));
  const drawn = rows.filter((row) => row.count > 0);
  // A lone slice is a closed ring: a gap there would read as a stray notch.
  const gap = drawn.length > 1 ? GAP : 0;
  let consumed = 0;
  const arcs = drawn.map((row) => {
    const length = Math.max(row.share * CIRCUMFERENCE - gap, MINIMUM_ARC);
    const arc = { status: row.status, length, offset: -consumed };
    consumed += row.share * CIRCUMFERENCE;
    return arc;
  });
  const description = total === 0
    ? 'No results in this run.'
    : `${total} results: ${rows.map((row) => `${row.count} ${labels[row.status].toLowerCase()}`).join(', ')}.`;

  return <figure className={styles.figure}>
    <figcaption className={styles.caption}>Run composition</figcaption>
    <div className={styles.body}>
      <div className={styles.chartCell}>
        <svg className={styles.donut} viewBox="0 0 100 100" role="img" aria-label={`Reconciliation run composition. ${description}`}>
          <circle className={styles.track} cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="11" />
          <g transform="rotate(-90 50 50)">
            {arcs.map((arc) => <circle
              key={arc.status}
              className={styles.arc}
              data-status={arc.status}
              cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="11"
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={arc.offset}
            />)}
          </g>
        </svg>
        {/* Proportional figures: the headline number is not part of a column. */}
        <p className={styles.centre} aria-hidden="true">
          <span className={styles.centreValue}>{(summary.metrics.reconciliationRate * 100).toFixed(1)}%</span>
          <span className={styles.centreLabel}>matched</span>
        </p>
      </div>
      <ul className={styles.legend}>
        {rows.map((row) => <li key={row.status} className={styles.legendRow}>
          <span className={styles.swatch} data-status={row.status} aria-hidden="true">{markers[row.status]}</span>
          <span className={styles.legendText}>
            <span className={styles.legendLabel}>{labels[row.status]}</span>
            <span className={styles.legendMeaning}>{meanings[row.status]}</span>
          </span>
          <span className={styles.legendCount}>{row.count}</span>
          <span className={styles.legendShare}>{(row.share * 100).toFixed(1)}%</span>
        </li>)}
      </ul>
    </div>
  </figure>;
}
