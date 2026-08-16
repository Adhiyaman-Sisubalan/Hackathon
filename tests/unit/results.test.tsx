// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Results } from '../../src/renderer/features/results/Results.js';
import type { ReconciliationWorkspace } from '../../src/shared/contracts/reconciliation.js';

afterEach(() => { cleanup(); window.reconciliation = undefined; });

const brokerTrade = { source: 'broker' as const, tradeId: 'BRK-7', isin: 'US0000000001', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount: '1234.500', quantity: '20.00', price: '61.7250' };
const otTrade = { source: 'ot-murex' as const, tradeId: 'OT-9', isin: 'GB0000000002', buySell: 'sell' as const, currency: 'GBP', settlementDate: '2026-08-16', amount: '9.25', quantity: '2', price: '4.625' };

function workspace(results: ReconciliationWorkspace['results'] = [
  { id: 'matched', status: 'matched', reason: null, reviewed: false, comment: null, brokerTrade, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-7' } },
  { id: 'unmatched', status: 'unmatched', reason: 'amount-mismatch', reviewed: false, comment: null, brokerTrade: { ...brokerTrade, tradeId: 'BRK-8', amount: '10.1' }, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-8', amount: '10.2' } },
  { id: 'missing-broker', status: 'missing-from-broker', reason: null, reviewed: false, comment: null, brokerTrade: null, otMurexTrade: otTrade },
  { id: 'missing-ot', status: 'missing-from-ot-murex', reason: null, reviewed: false, comment: null, brokerTrade, otMurexTrade: null }
]): ReconciliationWorkspace {
  const matched = results.filter((result) => result.status === 'matched').length;
  return { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: results.length, matched, unresolved: results.length - matched, reconciliationRate: matched / results.length, unresolvedRate: (results.length - matched) / results.length }, anomaly: { kind: 'warning', currentUnresolvedRate: .75, historyCount: 5, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: results.filter((result) => result.status === 'unmatched' && result.reviewed).length, totalUnmatched: results.filter((result) => result.status === 'unmatched').length }, results };
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
    expect(within(row).getByRole('button', { name: /Selected/ }).getAttribute('aria-pressed')).toBeNull();
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
      { id: 'one', status: 'matched', reason: null, reviewed: false, comment: null, brokerTrade, otMurexTrade: { ...brokerTrade, source: 'ot-murex', tradeId: 'OT-7' } }
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
      reason: index % 2 === 0 ? null : 'amount-mismatch' as const, reviewed: false, comment: null,
      brokerTrade: { ...brokerTrade, tradeId: `BRK-${index}`, amount: String(index + 1) }, otMurexTrade: null
    }));
    render(<Results workspace={workspace(results)} initialSelected={[]} />);
    expect(screen.getByText('Showing 0 results.')).toBeTruthy();
    expect(screen.getByText('1000 total results.')).toBeTruthy();
  });

  it('inspects paired and missing-side evidence and replaces review state only after main confirms it', async () => {
    const initial = workspace();
    const updated = workspace(initial.results.map((result) => result.id === 'unmatched' ? { ...result, reviewed: true } : result));
    window.reconciliation = { runs: { reviewResult: vi.fn(async () => ({ ok: true as const, data: { workspace: updated } })) } } as never;
    const changed = vi.fn();
    render(<Results workspace={initial} onWorkspaceChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    expect(screen.getByText('Reconciliation key')).toBeTruthy();
    expect(screen.getByText('Broker evidence')).toBeTruthy();
    expect(screen.getByText('OT/MUREX evidence')).toBeTruthy();
    expect(screen.getByText('amount mismatch')).toBeTruthy();
    await waitFor(() => expect(changed).toHaveBeenCalledWith(updated));
    expect(screen.getByText('Reviewed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select OT-9' }));
    expect(screen.getByText('Broker evidence is not available for this Result.')).toBeTruthy();
  });

  it('prefills and saves an unresolved comment only after the authoritative workspace confirms it', async () => {
    const initial = workspace(workspace().results.map((result) => result.id === 'unmatched' ? { ...result, comment: 'Previously saved.' } : result));
    const updated = workspace(initial.results.map((result) => result.id === 'unmatched' ? { ...result, comment: 'Authoritative value.' } : result));
    const saveComment = vi.fn(async () => ({ ok: true as const, data: { workspace: updated } }));
    window.reconciliation = { runs: { reviewResult: vi.fn(async () => ({ ok: true as const, data: { workspace: initial } })), saveComment } } as never;
    const changed = vi.fn();
    render(<Results workspace={initial} onWorkspaceChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    const comment = screen.getByLabelText('Comment') as HTMLTextAreaElement;
    expect(comment.value).toBe('Previously saved.');
    fireEvent.change(comment, { target: { value: 'Awaiting broker response.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(saveComment).toHaveBeenCalledWith(initial.runId, 'unmatched', 'Awaiting broker response.'));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(updated));
    expect(comment.value).toBe('Authoritative value.');
    expect(screen.getByText('Comment saved.')).toBeTruthy();
  });

  it('offers and saves comments for both missing-record statuses with their exact Result IDs', async () => {
    const initial = workspace();
    const saveComment = vi.fn(async () => ({ ok: true as const, data: { workspace: initial } }));
    window.reconciliation = { runs: { saveComment } } as never;
    render(<Results workspace={initial} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select OT-9' }));
    const missingBrokerComment = screen.getByRole('textbox', { name: 'Comment' }) as HTMLTextAreaElement;
    expect(missingBrokerComment).toBeTruthy();
    fireEvent.change(missingBrokerComment, { target: { value: 'Find the broker trade.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(saveComment).toHaveBeenCalledWith(initial.runId, 'missing-broker', 'Find the broker trade.'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Select BRK-7' })[1]!);
    const missingOtComment = screen.getByRole('textbox', { name: 'Comment' }) as HTMLTextAreaElement;
    expect(missingOtComment).toBeTruthy();
    fireEvent.change(missingOtComment, { target: { value: 'Find the OT/MUREX trade.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(saveComment).toHaveBeenLastCalledWith(initial.runId, 'missing-ot', 'Find the OT/MUREX trade.'));
  });

  it('preserves an unresolved comment draft on retryable failure and explains why matched results cannot save one', async () => {
    const saveComment = vi.fn(async () => ({ ok: false as const, error: { code: 'PERSISTENCE_FAILED' as const, message: 'Please retry.', retryable: true } }));
    window.reconciliation = { runs: { reviewResult: vi.fn(async () => ({ ok: true as const, data: { workspace: workspace() } })), saveComment } } as never;
    render(<Results workspace={workspace()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    const comment = screen.getByLabelText('Comment') as HTMLTextAreaElement;
    fireEvent.change(comment, { target: { value: 'Keep this draft.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Please retry.');
    expect(comment.getAttribute('aria-invalid')).toBe('true');
    expect(comment.value).toBe('Keep this draft.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry comment save' }));
    await waitFor(() => expect(saveComment).toHaveBeenCalledTimes(2));
    expect(saveComment).toHaveBeenLastCalledWith(expect.any(String), 'unmatched', 'Keep this draft.');
    await screen.findByRole('alert');
    fireEvent.change(comment, { target: { value: 'Adjusted draft.' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(comment.getAttribute('aria-invalid')).toBe('false');
    fireEvent.click(screen.getAllByRole('button', { name: 'Select BRK-7' })[0]!);
    expect(screen.getByText('Comments are unavailable for matched Results.')).toBeTruthy();
    expect(saveComment).toHaveBeenCalledTimes(2);
  });

  it('disables in-flight editing and clears stale save feedback when a draft changes', async () => {
    let resolveSave!: (value: any) => void;
    const saveComment = vi.fn(() => new Promise<any>((resolve) => { resolveSave = resolve; }));
    const initial = workspace();
    window.reconciliation = { runs: { saveComment } } as never;
    render(<Results workspace={initial} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    const comment = screen.getByRole('textbox', { name: 'Comment' }) as HTMLTextAreaElement;
    fireEvent.change(comment, { target: { value: 'First draft.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    expect(comment.disabled).toBe(true);
    await waitFor(() => expect(saveComment).toHaveBeenCalledTimes(1));
    resolveSave({ ok: true, data: { workspace: workspace(initial.results.map((result) => result.id === 'unmatched' ? { ...result, comment: 'First draft.' } : result)) } });
    await waitFor(() => expect(screen.getByText('Comment saved.')).toBeTruthy());
    fireEvent.change(comment, { target: { value: 'New draft.' } });
    expect(screen.queryByText('Comment saved.')).toBeNull();
  });

  it('serializes review and comment workspace mutations so a late review cannot overwrite a newer comment', async () => {
    let resolveReview!: (value: any) => void;
    const initial = workspace();
    const reviewed = workspace(initial.results.map((result) => result.id === 'unmatched' ? { ...result, reviewed: true } : result));
    const commented = workspace(reviewed.results.map((result) => result.id === 'unmatched' ? { ...result, comment: 'Authoritative comment.' } : result));
    const reviewResult = vi.fn(() => new Promise<any>((resolve) => { resolveReview = resolve; }));
    const saveComment = vi.fn(async () => ({ ok: true as const, data: { workspace: commented } }));
    const changed = vi.fn();
    window.reconciliation = { runs: { reviewResult, saveComment } } as never;
    render(<Results workspace={initial} onWorkspaceChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    await waitFor(() => expect(reviewResult).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), { target: { value: 'Submitted draft.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    expect(saveComment).not.toHaveBeenCalled();
    resolveReview({ ok: true, data: { workspace: reviewed } });
    await waitFor(() => expect(saveComment).toHaveBeenCalledWith(initial.runId, 'unmatched', 'Submitted draft.'));
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(commented));
  });

  it('keeps selection and investigation context through a retryable review failure and restores compact inspector focus', async () => {
    const retry = vi.fn(async () => ({ ok: false as const, error: { code: 'PERSISTENCE_FAILED' as const, message: 'Please retry.', retryable: true } }));
    window.reconciliation = { runs: { reviewResult: retry } } as never;
    render(<Results workspace={workspace()} />);
    const select = screen.getByRole('button', { name: 'Select BRK-8' });
    fireEvent.click(select);
    expect((await screen.findByRole('alert')).textContent).toContain('Review could not be saved: Please retry.');
    expect(select.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry review' }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(2));
    const open = screen.getByRole('button', { name: 'Open inspector' });
    fireEvent.click(open);
    expect(document.activeElement?.textContent).toContain('Result detail');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(open));
  });

  it('guards repeated activation, keeps late failures with their initiating result, and respects non-retryable typed failures', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    let resolveSecond!: (value: any) => void;
    const first = new Promise<never>((_resolve, reject) => { rejectFirst = reject; });
    const second = new Promise<any>((resolve) => { resolveSecond = resolve; });
    const extra = { id: 'unmatched-2', status: 'unmatched' as const, reason: 'quantity-mismatch' as const, reviewed: false, comment: null, brokerTrade: { ...brokerTrade, tradeId: 'BRK-9' }, otMurexTrade: { ...brokerTrade, source: 'ot-murex' as const, tradeId: 'OT-10' } };
    const reviewResult = vi.fn((_runId: string, resultId: string) => resultId === 'unmatched' ? first : second);
    window.reconciliation = { runs: { reviewResult } } as never;
    render(<Results workspace={workspace([...workspace().results, extra])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Selected BRK-9' }));
    await waitFor(() => expect(reviewResult).toHaveBeenCalledTimes(1));
    rejectFirst(new Error('connection closed'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await waitFor(() => expect(reviewResult).toHaveBeenCalledTimes(2));
    resolveSecond({ ok: false, error: { code: 'RESULT_NOT_FOUND', message: 'This result is no longer available.', retryable: false } });
    expect((await screen.findByRole('alert')).textContent).toContain('This result is no longer available.');
    expect(screen.queryByRole('button', { name: 'Retry review' })).toBeNull();
  });

  it('keeps a confirmed review visible without a workspace replacement callback and restores focus when compact layout closes', async () => {
    const updated = workspace(workspace().results.map((result) => result.id === 'unmatched' ? { ...result, reviewed: true } : result));
    window.reconciliation = { runs: { reviewResult: vi.fn(async () => ({ ok: true as const, data: { workspace: updated } })) } } as never;
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => media) });
    render(<Results workspace={workspace()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select BRK-8' }));
    expect(await screen.findByText('Reviewed')).toBeTruthy();
    const open = screen.getByRole('button', { name: 'Open inspector' });
    fireEvent.click(open);
    const listener = media.addEventListener.mock.calls.find(([event]) => event === 'change')?.[1] as (() => void);
    media.matches = false;
    listener();
    await waitFor(() => expect(document.activeElement).toBe(open));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });
});
