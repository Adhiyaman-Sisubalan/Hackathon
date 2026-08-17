// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RunTrend } from '../../src/renderer/components/RunTrend.js';
import type { ReconciliationRunSummary } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

function run(runId: string, asOfDate: string, completedAt: string, matched: number, total: number, reviewedUnmatched = 0, totalUnmatched = 0): ReconciliationRunSummary {
  const unresolved = total - matched;
  return {
    runId, asOfDate, completedAt,
    metrics: { total, matched, unresolved, reconciliationRate: total === 0 ? 0 : matched / total, unresolvedRate: total === 0 ? 0 : unresolved / total },
    statusCounts: { matched, unmatched: totalUnmatched, 'missing-from-broker': 0, 'missing-from-ot-murex': unresolved - totalUnmatched },
    reviewProgress: { reviewedUnmatched, totalUnmatched },
    anomaly: { kind: 'normal', currentUnresolvedRate: total === 0 ? 0 : unresolved / total, historyCount: 5, baselineUnresolvedRate: .11 }
  };
}

/** The hidden table is the chart's exact reading, so assertions go through it. */
function rowFor(date: string): HTMLElement {
  return screen.getByRole('rowheader', { name: date }).closest('tr')!;
}

describe('RunTrend', () => {
  it('plots one column per as-of date, oldest first, with a bar per series', () => {
    const { container } = render(<RunTrend runs={[
      run('11111111-1111-4111-8111-111111111111', '2026-08-15', '2026-08-15T12:00:00.000Z', 2, 6, 1, 2),
      run('22222222-2222-4222-8222-222222222222', '2026-08-13', '2026-08-13T12:00:00.000Z', 1, 2, 0, 1)
    ]} />);
    const labels = [...container.querySelectorAll('p')].map((node) => node.textContent);
    expect(labels).toEqual(['13 Aug', '15 Aug']);
    expect(container.querySelectorAll('span[data-series]')).toHaveLength(2 * 3 + 3); // three bars per column, plus the legend swatches
  });

  it('reads each rate and the review count into the table view', () => {
    render(<RunTrend runs={[run('11111111-1111-4111-8111-111111111111', '2026-08-15', '2026-08-15T12:00:00.000Z', 2, 6, 1, 2)]} />);
    const row = rowFor('15 Aug');
    expect(within(row).getByText('33.3%')).toBeTruthy();
    expect(within(row).getByText('66.7%')).toBeTruthy();
    expect(within(row).getByText('50.0%')).toBeTruthy();
    expect(within(row).getByText('1 of 2')).toBeTruthy();
  });

  it('keeps only the newest run for a date that was reconciled more than once', () => {
    render(<RunTrend runs={[
      run('11111111-1111-4111-8111-111111111111', '2026-08-15', '2026-08-15T18:00:00.000Z', 5, 5),
      run('22222222-2222-4222-8222-222222222222', '2026-08-15', '2026-08-15T09:00:00.000Z', 1, 5)
    ]} />);
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    // The 18:00 rerun reconciled everything; the 09:00 attempt's 20% must not survive.
    expect(within(rowFor('15 Aug')).getByText('0.0%')).toBeTruthy();
    expect(within(rowFor('15 Aug')).queryByText('20.0%')).toBeNull();
  });

  it('treats a run with nothing to review as fully reviewed rather than dividing by zero', () => {
    render(<RunTrend runs={[run('11111111-1111-4111-8111-111111111111', '2026-08-14', '2026-08-14T12:00:00.000Z', 4, 4, 0, 0)]} />);
    const row = rowFor('14 Aug');
    expect(within(row).getByText('0 of 0')).toBeTruthy();
    expect(row.textContent).not.toContain('NaN');
    expect(within(row).getAllByText('100.0%')).toHaveLength(2); // reconciliation rate and review progress
  });

  it('gives a zero-total run safe zero rates', () => {
    render(<RunTrend runs={[run('11111111-1111-4111-8111-111111111111', '2026-08-13', '2026-08-13T12:00:00.000Z', 0, 0)]} />);
    const row = rowFor('13 Aug');
    expect(row.textContent).not.toContain('NaN');
    expect(within(row).getAllByText('0.0%')).toHaveLength(2);
  });

  it('renders nothing when no run has been completed', () => {
    const { container } = render(<RunTrend runs={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
