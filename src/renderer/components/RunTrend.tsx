import { formatPercentage } from '../../domain/metrics/reconciliation-metrics.js';
import type { ReconciliationRunSummary } from '../../shared/contracts/reconciliation.js';
import styles from './RunTrend.module.css';

type SeriesId = 'matched' | 'mismatched' | 'reviewProgress';

const series: readonly { id: SeriesId; label: string; meaning: string }[] = [
  { id: 'matched', label: 'Matched', meaning: 'Matched over total' },
  { id: 'mismatched', label: 'Mismatched', meaning: 'Mismatched over total' },
  { id: 'reviewProgress', label: 'Mismatched reviewed', meaning: 'Reviewed over total mismatched' }
];

/**
 * The Mismatched status alone, not every unresolved Result: records missing from one side
 * are unresolved but are not mismatches, and plotting them here would not match the label.
 * `reviewProgress.totalUnmatched` counts the same population and covers a summary that
 * predates the persisted breakdown.
 */
function mismatchedCount(summary: ReconciliationRunSummary): number {
  return summary.statusCounts?.unmatched ?? summary.reviewProgress?.totalUnmatched ?? 0;
}

/** A run with no mismatched Results has nothing left to review, which the rest of the app already treats as satisfied. */
function reviewShare(summary: ReconciliationRunSummary): number {
  const progress = summary.reviewProgress;
  if (!progress || progress.totalUnmatched === 0) return 1;
  return progress.reviewedUnmatched / progress.totalUnmatched;
}

function reviewCount(summary: ReconciliationRunSummary): string {
  const progress = summary.reviewProgress;
  return progress ? `${progress.reviewedUnmatched} of ${progress.totalUnmatched}` : '—';
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date);
}

/**
 * One column per business date. Reruns of the same date replace each other, so the chart
 * answers "where does this date stand now" rather than stacking every attempt.
 */
function latestRunPerDate(runs: readonly ReconciliationRunSummary[]): readonly ReconciliationRunSummary[] {
  const byDate = new Map<string, ReconciliationRunSummary>();
  for (const run of runs) {
    const held = byDate.get(run.asOfDate);
    if (!held || held.completedAt < run.completedAt) byDate.set(run.asOfDate, run);
  }
  return [...byDate.values()].sort((left, right) => left.asOfDate.localeCompare(right.asOfDate));
}

const ticks = [100, 75, 50, 25, 0];

export function RunTrend({ runs }: { runs: readonly ReconciliationRunSummary[] }) {
  const columns = latestRunPerDate(runs);
  if (columns.length === 0) return null;
  const valueFor = (summary: ReconciliationRunSummary, id: SeriesId) =>
    id === 'matched' ? summary.metrics.reconciliationRate
      : id === 'mismatched' ? (summary.metrics.total === 0 ? 0 : mismatchedCount(summary) / summary.metrics.total)
      : reviewShare(summary);

  return <figure className={styles.figure}>
    <div className={styles.head}>
      <figcaption className={styles.caption}>Rates by as-of date</figcaption>
      <ul className={styles.legend}>
        {series.map((entry) => <li key={entry.id} className={styles.legendItem}>
          <span className={styles.swatch} data-series={entry.id} aria-hidden="true" />
          {entry.label}
        </li>)}
      </ul>
    </div>

    {/* The plot is decorative for assistive technology: the table below carries every
        value exactly, so nothing is reachable only by reading bar heights. */}
    <div className={styles.plot} aria-hidden="true">
      <div className={styles.axis}>
        {ticks.map((tick) => <span key={tick} className={styles.tick}>{tick}%</span>)}
      </div>
      <div className={styles.canvas}>
        <div className={styles.gridlines}>{ticks.map((tick) => <span key={tick} className={styles.gridline} />)}</div>
        <div className={styles.groups}>
          {columns.map((summary) => <div key={summary.runId} className={styles.group}>
            <div className={styles.bars}>
              {series.map((entry) => {
                const share = valueFor(summary, entry.id);
                return <span
                  key={entry.id}
                  className={styles.barSlot}
                  title={`${formatDate(summary.asOfDate)} · ${entry.label}: ${formatPercentage(share)}`}
                >
                  {/* A zero value keeps a hairline stub so the column never looks absent. */}
                  <span className={styles.bar} data-series={entry.id} style={{ blockSize: `max(2px, ${(share * 100).toFixed(2)}%)` }} />
                </span>;
              })}
            </div>
            <p className={styles.groupLabel}>{formatDate(summary.asOfDate)}</p>
          </div>)}
        </div>
      </div>
    </div>

    <table className={styles.visuallyHidden}>
      <caption>Matched, mismatched, and mismatched reviewed by as-of date</caption>
      <thead><tr>
        <th scope="col">As-of date</th>
        {series.map((entry) => <th key={entry.id} scope="col">{entry.label}</th>)}
        <th scope="col">Mismatched reviewed count</th>
      </tr></thead>
      <tbody>{columns.map((summary) => <tr key={summary.runId}>
        <th scope="row">{formatDate(summary.asOfDate)}</th>
        {series.map((entry) => <td key={entry.id}>{formatPercentage(valueFor(summary, entry.id))}</td>)}
        <td>{reviewCount(summary)}</td>
      </tr>)}</tbody>
    </table>
  </figure>;
}
