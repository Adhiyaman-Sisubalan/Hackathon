// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../../src/renderer/features/dashboard/Dashboard.js';

describe('dashboard query failure', () => {
  afterEach(cleanup);
  it('keeps the start action visible and restores focus to Retry before retrying in place', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: false as const, error: { code: 'QUERY_FAILED', message: 'The dashboard could not be loaded.', retryable: true } })
      .mockResolvedValueOnce({ ok: true as const, data: { summary: null } });
    render(<Dashboard api={{ get }} />);

    const retry = await screen.findByRole('button', { name: 'Retry dashboard query' });
    expect(screen.getByRole('button', { name: 'Run reconciliation' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(retry));
    fireEvent.click(retry);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/No reconciliation has been completed yet/)).toBeTruthy();
  });

  it('does not offer Retry for a non-retryable failure and keeps the run controls in context', async () => {
    const get = vi.fn().mockResolvedValue({ ok: false as const, error: { code: 'INVALID_REQUEST', message: 'Dashboard access is unavailable.', retryable: false } });
    render(<Dashboard api={{ get }} />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Retry dashboard query' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Run reconciliation' })).toBeTruthy();
  });

  it('renders a safe non-retryable error when the preload dashboard API is unavailable', async () => {
    render(<Dashboard />);
    expect((await screen.findByRole('alert')).textContent).toBe('Dashboard access is unavailable.');
    expect(screen.queryByRole('button', { name: 'Retry dashboard query' })).toBeNull();
  });
});
