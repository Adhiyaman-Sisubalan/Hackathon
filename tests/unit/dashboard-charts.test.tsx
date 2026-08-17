// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../../src/renderer/features/dashboard/Dashboard.js';
import type { ReconciliationRunSummary } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

const latest: ReconciliationRunSummary = {
  runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T12:00:00.000Z',
  metrics: { total: 6, matched: 2, unresolved: 4, reconciliationRate: 1 / 3, unresolvedRate: 2 / 3 },
  statusCounts: { matched: 2, unmatched: 2, 'missing-from-broker': 1, 'missing-from-ot-murex': 1 },
  reviewProgress: { reviewedUnmatched: 1, totalUnmatched: 2 },
  anomaly: { kind: 'warning', currentUnresolvedRate: 2 / 3, historyCount: 5, baselineUnresolvedRate: .11 }
};
const earlier: ReconciliationRunSummary = {
  ...latest, runId: '22222222-2222-4222-8222-222222222222', asOfDate: '2026-08-13', completedAt: '2026-08-13T12:00:00.000Z',
  metrics: { total: 2, matched: 2, unresolved: 0, reconciliationRate: 1, unresolvedRate: 0 },
  statusCounts: { matched: 2, unmatched: 0, 'missing-from-broker': 0, 'missing-from-ot-murex': 0 },
  reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 0 }
};

function renderOverview(runs: readonly ReconciliationRunSummary[] = [latest, earlier]) {
  return render(<Dashboard
    api={{ get: async () => ({ ok: true as const, data: { summary: latest } }) }}
    runsApi={{
      list: vi.fn(async () => ({ ok: true as const, data: { runs } })),
      getWorkspace: vi.fn(), reviewResult: vi.fn(), saveComment: vi.fn(), saveMismatchReason: vi.fn(), previewBrokerEmail: vi.fn(), saveReport: vi.fn()
    } as never}
  />);
}

describe('Overview charts', () => {
  it('shows both charts and drops the metric tiles that repeated them', async () => {
    renderOverview();
    expect(await screen.findByText('Run composition')).toBeTruthy();
    expect(await screen.findByText('Rates by as-of date')).toBeTruthy();
    // The tiles are the Results workspace's readout and must not appear here. The series
    // names still occur as chart legend labels, so the tile list itself is the marker.
    expect(screen.queryByLabelText('Reconciliation summary')).toBeNull();
    expect(document.querySelector('dl')).toBeNull();
  });

  it('keeps the anomaly warning, which neither chart carries', async () => {
    renderOverview();
    await screen.findByText('Run composition');
    const warning = screen.getByRole('status');
    expect(warning.textContent).toContain('Unresolved rate is higher than the seeded baseline.');
    expect(warning.textContent).toContain('Current 66.7%; five-run baseline 11.0%');
  });

  it('still states the run total that the tiles used to carry', async () => {
    renderOverview();
    const composition = (await screen.findByText('Run composition')).closest('figure')!;
    expect(within(composition).getByText('6 results')).toBeTruthy();
  });

  it('shows the composition alone until a second run gives the trend something to compare', async () => {
    renderOverview([]);
    expect(await screen.findByText('Run composition')).toBeTruthy();
    expect(screen.queryByText('Rates by as-of date')).toBeNull();
  });
});
