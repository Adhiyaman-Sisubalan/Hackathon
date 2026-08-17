// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../../src/renderer/features/dashboard/Dashboard.js';
import type { ReconciliationRunResult } from '../../src/shared/contracts/reconciliation.js';

afterEach(cleanup);

describe('reconciliation dashboard form', () => {
  it('rejects unsupported dates before invoking main and returns focus to its labelled control', async () => {
    const run = vi.fn();
    render(<Dashboard api={{ get: async () => ({ ok: true as const, data: { summary: null } }) }} reconciliationApi={{ run, onProgress: () => () => undefined }} />);
    const date = await screen.findByLabelText('As-of date');
    fireEvent.change(date, { target: { value: '2026-08-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run reconciliation' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No seeded data for this date');
    expect(run).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(date));
    fireEvent.change(date, { target: { value: '2026-08-15' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(date.getAttribute('aria-describedby')).toBeNull();
  });

  it('keeps the date visible, disables duplicate submission, and renders the completed persisted snapshot without navigation', async () => {
    let resolve!: (value: ReconciliationRunResult) => void;
    const run = vi.fn(() => new Promise<ReconciliationRunResult>((done) => { resolve = done; }));
    const completed = vi.fn();
    render(<Dashboard api={{ get: async () => ({ ok: true as const, data: { summary: null } }) }} reconciliationApi={{ run, onProgress: () => () => undefined }} onCompleted={completed} />);
    const date = await screen.findByLabelText('As-of date');
    fireEvent.click(screen.getByRole('button', { name: 'Run reconciliation' }));
    expect((screen.getByRole('button', { name: 'Running reconciliation…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((date as HTMLInputElement).value).toBe('2026-08-15');
    expect(run).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { workspace: { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 1, unresolved: 0, reconciliationRate: 1, unresolvedRate: 0 }, anomaly: { kind: 'normal', currentUnresolvedRate: 0, historyCount: 5, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 0 }, results: [] } } });
    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
    // Overview states the run through its charts; the metric tiles belong to Results.
    expect(await screen.findByText('Run composition')).toBeTruthy();
    expect(screen.queryByLabelText('Reconciliation summary')).toBeNull();
    const composition = screen.getByText('Run composition').closest('figure')!;
    expect(within(composition).getByText('100.0%')).toBeTruthy();
    expect(within(composition).getByText('1 result')).toBeTruthy();
  });
});
