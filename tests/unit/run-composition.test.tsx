// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RunComposition } from '../../src/renderer/components/RunComposition.js';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

const summary: ReconciliationRunSummary = {
  runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z',
  metrics: { total: 6, matched: 2, unresolved: 4, reconciliationRate: 1 / 3, unresolvedRate: 2 / 3 },
  statusCounts: { matched: 2, unmatched: 2, 'missing-from-broker': 1, 'missing-from-ot-murex': 1 },
  anomaly: { kind: 'normal', currentUnresolvedRate: 2 / 3, historyCount: 5, baselineUnresolvedRate: .11 }
};

/** Every plotted value must also be readable as text, so colour never carries it alone. */
function breakdownRowFor(label: string): HTMLElement {
  return screen.getByText(label).closest('li')!;
}

describe('RunComposition', () => {
  it('plots one arc per present status and reports the whole breakdown as text', () => {
    const { container } = render(<RunComposition summary={summary} />);
    expect(container.querySelectorAll('svg circle[data-status]')).toHaveLength(4);
    expect(within(breakdownRowFor('Matched')).getByText('2')).toBeTruthy();
    expect(within(breakdownRowFor('Matched')).getByText('33.3%')).toBeTruthy();
    expect(within(breakdownRowFor('Missing from Broker')).getByText('1')).toBeTruthy();
    expect(within(breakdownRowFor('Missing from OT/MUREX')).getByText('16.7%')).toBeTruthy();
  });

  it('names the composition for assistive technology without claiming a live region', () => {
    render(<RunComposition summary={summary} />);
    expect(screen.getByRole('img').getAttribute('aria-label'))
      .toBe('Reconciliation run composition. 6 results: 2 matched, 2 mismatched, 1 missing from broker, 1 missing from ot/murex.');
    // The strip's anomaly message owns the only status region; the chart must not add one.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('omits arcs a run has none of, while the breakdown still lists them at zero', () => {
    const allMatched = { ...summary, metrics: { total: 2, matched: 2, unresolved: 0, reconciliationRate: 1, unresolvedRate: 0 }, statusCounts: { matched: 2, unmatched: 0, 'missing-from-broker': 0, 'missing-from-ot-murex': 0 } };
    const { container } = render(<RunComposition summary={allMatched} />);
    expect(container.querySelectorAll('svg circle[data-status]')).toHaveLength(1);
    expect(within(breakdownRowFor('Mismatched')).getByText('0')).toBeTruthy();
    expect(within(breakdownRowFor('Mismatched')).getByText('0.0%')).toBeTruthy();
  });

  it('draws a zero-result run as an empty track without dividing by zero', () => {
    const empty = { ...summary, metrics: { total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 }, statusCounts: { matched: 0, unmatched: 0, 'missing-from-broker': 0, 'missing-from-ot-murex': 0 } };
    const { container } = render(<RunComposition summary={empty} />);
    expect(container.querySelectorAll('svg circle[data-status]')).toHaveLength(0);
    expect(container.textContent).not.toContain('NaN');
    // Four zero shares in the breakdown, plus the zero rate in the centre.
    expect(screen.getAllByText('0.0%')).toHaveLength(5);
    for (const label of ['Matched', 'Mismatched', 'Missing from Broker', 'Missing from OT/MUREX']) {
      expect(within(breakdownRowFor(label)).getByText('0.0%')).toBeTruthy();
    }
  });

  it('falls back to counting a snapshot that predates the persisted breakdown', () => {
    const { statusCounts: _dropped, ...withoutCounts } = summary;
    const workspace = {
      ...withoutCounts,
      metrics: { total: 2, matched: 1, unresolved: 1, reconciliationRate: .5, unresolvedRate: .5 },
      reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 1 },
      results: [
        { id: 'a', status: 'matched' as const, reason: null, reviewed: false, comment: null, mismatchReason: null, brokerTrade: null, otMurexTrade: null },
        { id: 'b', status: 'unmatched' as const, reason: 'amount-mismatch' as const, reviewed: false, comment: null, mismatchReason: null, brokerTrade: null, otMurexTrade: null }
      ]
    } as ReconciliationWorkspace;
    const { container } = render(<RunComposition summary={workspace} />);
    expect(container.querySelectorAll('svg circle[data-status]')).toHaveLength(2);
    expect(within(breakdownRowFor('Matched')).getByText('50.0%')).toBeTruthy();
  });

  it('renders nothing when a summary carries neither a breakdown nor Results', () => {
    const { statusCounts: _dropped, ...withoutCounts } = summary;
    const { container } = render(<RunComposition summary={withoutCounts as ReconciliationRunSummary} />);
    expect(container.firstChild).toBeNull();
  });
});
