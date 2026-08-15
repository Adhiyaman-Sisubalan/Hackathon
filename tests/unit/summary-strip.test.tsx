// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SummaryStrip } from '../../src/renderer/components/SummaryStrip.js';
import type { ReconciliationRunSummary } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

const summary: ReconciliationRunSummary = {
  runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z',
  metrics: { total: 6, matched: 2, unresolved: 4, reconciliationRate: 1 / 3, unresolvedRate: 2 / 3 },
  anomaly: { kind: 'warning', currentUnresolvedRate: 2 / 3, historyCount: 5, baselineUnresolvedRate: .11 }
};

describe('SummaryStrip', () => {
  it('presents persisted one-decimal metrics and an accessible, non-blocking warning', () => {
    render(<SummaryStrip summary={summary} />);
    expect(screen.getByLabelText('Reconciliation summary')).toBeTruthy();
    expect(screen.getByText('33.3%')).toBeTruthy();
    expect(screen.getByText('66.7%')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Current 66.7%; five-run baseline 11.0%');
  });

  it('explains insufficient history without reporting an error', () => {
    render(<SummaryStrip summary={{ ...summary, anomaly: { kind: 'insufficient-history', currentUnresolvedRate: 2 / 3, historyCount: 4, baselineUnresolvedRate: null } }} />);
    expect(screen.getByRole('status').textContent).toContain('Seeded history is insufficient for an anomaly check (4 of 5 runs available).');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders an ordinary summary without warning or insufficient-history context', () => {
    render(<SummaryStrip summary={{ ...summary, anomaly: { kind: 'normal', currentUnresolvedRate: .1, historyCount: 5, baselineUnresolvedRate: .1 } }} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/seeded baseline|history is insufficient/i)).toBeNull();
  });

  it('displays both zero rates safely as 0.0%', () => {
    render(<SummaryStrip summary={{ ...summary, metrics: { total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 }, anomaly: { kind: 'normal', currentUnresolvedRate: 0, historyCount: 5, baselineUnresolvedRate: .1 } }} />);
    expect(screen.getAllByText('0.0%', { exact: true })).toHaveLength(2);
  });
});
