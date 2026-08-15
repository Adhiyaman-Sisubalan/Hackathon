// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Results } from '../../src/renderer/features/results/Results.js';
import type { ReconciliationWorkspace } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

const brokerTrade = { source: 'broker' as const, tradeId: 'BRK-7', isin: 'US0000000001', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount: '1234.500', quantity: '20.00', price: '61.7250' };
const otTrade = { source: 'ot-murex' as const, tradeId: 'OT-9', isin: 'GB0000000002', buySell: 'sell' as const, currency: 'GBP', settlementDate: '2026-08-16', amount: '9.25', quantity: '2', price: '4.625' };

function workspace(results: ReconciliationWorkspace['results'] = [
  { id: 'matched', status: 'matched', reason: null, brokerTrade, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-7' } },
  { id: 'unmatched', status: 'unmatched', reason: 'amount-mismatch', brokerTrade: { ...brokerTrade, tradeId: 'BRK-8', amount: '10.1' }, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-8', amount: '10.2' } },
  { id: 'missing-broker', status: 'missing-from-broker', reason: null, brokerTrade: null, otMurexTrade: otTrade },
  { id: 'missing-ot', status: 'missing-from-ot-murex', reason: null, brokerTrade, otMurexTrade: null }
]): ReconciliationWorkspace {
  const matched = results.filter((result) => result.status === 'matched').length;
  return { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: results.length, matched, unresolved: results.length - matched, reconciliationRate: matched / results.length, unresolvedRate: (results.length - matched) / results.length }, anomaly: { kind: 'warning', currentUnresolvedRate: .75, historyCount: 5, baselineUnresolvedRate: .1 }, results };
}

describe('Results workspace table', () => {
  it('renders one semantic table with default columns, source fallback, formatted values, and every status treatment', () => {
    render(<Results workspace={workspace()} />);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    for (const name of ['Counterparty', 'ISIN', 'Buy / sell', 'Amount', 'Quantity', 'Currency', 'Settlement date', 'Status']) expect(screen.getByRole('columnheader', { name })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Trade ID' })).toBeNull();
    expect(screen.getAllByText('1,234.5')).not.toHaveLength(0);
    expect(screen.getAllByText('15 Aug 2026')).not.toHaveLength(0);
    expect(screen.getByText('OT/MUREX source')).toBeTruthy();
    for (const status of ['Matched', 'Unmatched', 'Missing from Broker', 'Missing from OT/MUREX']) expect(screen.getAllByText(status).length).toBeGreaterThan(0);
    expect(screen.getByText(/Source values use Broker when present/)).toBeTruthy();
  });

  it('filters, sorts, exposes optional columns, and leaves the immutable workspace snapshot untouched', () => {
    const input = workspace();
    const before = JSON.stringify(input);
    render(<Results workspace={input} />);
    fireEvent.click(screen.getByLabelText('Matched'));
    expect(screen.getByText('Showing 3 results.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(screen.getByRole('columnheader', { name: /Amount/ }).getAttribute('aria-sort')).not.toBe('none');
    fireEvent.click(screen.getByLabelText('Trade ID'));
    expect(screen.getByRole('columnheader', { name: 'Trade ID' })).toBeTruthy();
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.click(within(row).getByRole('button', { name: /Select/ }));
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(JSON.stringify(input)).toBe(before);
  });

  it('keeps active filters visible and clears an empty result set', () => {
    render(<Results workspace={workspace()} initialSelected={[]} />);
    expect(screen.getByText('No matching records.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Showing 4 results.')).toBeTruthy();
  });

  it('retains summary and controls for an all-resolved run', () => {
    render(<Results initialSelected={['unmatched', 'missing-from-broker', 'missing-from-ot-murex']} workspace={workspace([
      { id: 'one', status: 'matched', reason: null, brokerTrade, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-7' } }
    ])} />);
    expect((screen.getByLabelText('Matched') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Showing 0 results. All results resolved.')).toBeTruthy();
    expect(screen.getByText('All results in this run are resolved. Matched records remain available.')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Matched'));
    expect(screen.getByText('Showing 1 results.')).toBeTruthy();
  });

  it('retains the selected workspace and summary when a refresh fails, with an in-place retry', () => {
    let retries = 0;
    render(<Results workspace={workspace()} loadError="Timed out" onRetry={() => { retries += 1; }} />);
    expect(screen.getByRole('alert').textContent).toContain('Results could not be refreshed: Timed out');
    expect(screen.getByLabelText('Reconciliation summary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retries).toBe(1);
  });

  it('keeps table feedback available for a 1,000-result fixture without virtualization', () => {
    const results = Array.from({ length: 1000 }, (_, index) => ({
      id: `result-${index}`, status: index % 2 === 0 ? 'matched' as const : 'unmatched' as const,
      reason: index % 2 === 0 ? null : 'amount-mismatch' as const,
      brokerTrade: { ...brokerTrade, tradeId: `BRK-${index}`, amount: String(index + 1) }, otMurexTrade: null
    }));
    render(<Results workspace={workspace(results)} initialSelected={[]} />);
    expect(screen.getByText('Showing 0 results.')).toBeTruthy();
    expect(screen.getByText('1000 total results.')).toBeTruthy();
  });
});
