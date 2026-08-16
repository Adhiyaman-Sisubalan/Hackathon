// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunHistory } from '../../src/renderer/features/runs/RunHistory.js';

afterEach(cleanup);

const latest = { runId: '22222222-2222-4222-8222-222222222222', asOfDate: '2026-08-15', completedAt: '2026-08-15T12:00:00.000Z', metrics: { total: 2, matched: 1, unresolved: 1, reconciliationRate: .5, unresolvedRate: .5 }, anomaly: { kind: 'warning' as const, currentUnresolvedRate: .5, historyCount: 5 as const, baselineUnresolvedRate: .1 } };
const older = { ...latest, runId: '11111111-1111-4111-8111-111111111111', completedAt: '2026-08-14T12:00:00.000Z' };
const workspace = { ...latest, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 0 }, results: [] };

describe('run history destinations', () => {
  it('shows newest-first history and opens the persisted snapshot through a keyboard-reachable button', async () => {
    const getWorkspace = vi.fn(async () => ({ ok: true as const, data: { workspace } }));
    const opened = vi.fn();
    render(<RunHistory destination="runs" api={{ list: async () => ({ ok: true, data: { runs: [latest, older] } }), getWorkspace }} onOpened={opened} onStale={vi.fn()} onOverview={vi.fn()} />);
    const buttons = await screen.findAllByRole('button', { name: /Open run/ });
    expect(buttons[0]?.getAttribute('aria-label')).toContain(latest.runId);
    fireEvent.keyDown(buttons[0]!, { key: 'Enter' });
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(opened).toHaveBeenCalledWith(workspace, false));
    expect(getWorkspace).toHaveBeenCalledWith(latest.runId);
  });

  it('opens the latest completed run with the Exceptions preset and provides a calm empty state', async () => {
    const opened = vi.fn();
    render(<RunHistory destination="exceptions" api={{ list: async () => ({ ok: true, data: { runs: [latest] } }), getWorkspace: async () => ({ ok: true, data: { workspace } }) }} onOpened={opened} onStale={vi.fn()} onOverview={vi.fn()} />);
    await waitFor(() => expect(opened).toHaveBeenCalledWith(workspace, true));
    cleanup();
    render(<RunHistory destination="exceptions" api={{ list: async () => ({ ok: true, data: { runs: [] } }), getWorkspace: async () => ({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'unused', retryable: true } }) }} onOpened={vi.fn()} onStale={vi.fn()} onOverview={vi.fn()} />);
    expect(await screen.findByText(/No completed reconciliation runs are available/)).toBeTruthy();
  });

  it('clears stale state, refreshes history, announces the error, and retries in place', async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, data: { runs: [latest] } });
    const stale = vi.fn();
    render(<RunHistory destination="runs" api={{ list, getWorkspace: async () => ({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'This run is no longer available.', retryable: true } }) }} onOpened={vi.fn()} onStale={stale} onOverview={vi.fn()} />);
    const button = await screen.findByRole('button', { name: `Open run ${latest.runId}` });
    fireEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toContain('This run is no longer available.');
    await waitFor(() => expect(stale).toHaveBeenCalledOnce());
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Retry run history' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  });

  it('keeps its destination visible and retries a failed history query in place', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: false as const, error: { code: 'QUERY_FAILED', message: 'Run history could not be loaded. Please retry.', retryable: true } })
      .mockResolvedValueOnce({ ok: true as const, data: { runs: [] } });
    render(<RunHistory destination="runs" api={{ list, getWorkspace: async () => ({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'unused', retryable: true } }) }} onOpened={vi.fn()} onStale={vi.fn()} onOverview={vi.fn()} />);
    const retry = await screen.findByRole('button', { name: 'Retry run history' });
    expect(screen.getByRole('heading', { name: 'Reconciliation Runs' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(retry);
    expect(await screen.findByText(/No completed reconciliation runs yet/)).toBeTruthy();
  });
});
