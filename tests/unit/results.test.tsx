// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Results } from '../../src/renderer/features/results/Results.js';

afterEach(cleanup);

describe('Results status filters', () => {
  it('uses operational labels, focuses the Results heading, and updates the visible status count', () => {
    render(<Results workspace={{ runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 2, matched: 1, unresolved: 1, reconciliationRate: .5 }, results: [
      { id: 'one', status: 'matched', reason: null, brokerTrade: null, otMurexTrade: null }, { id: 'two', status: 'unmatched', reason: 'amount-mismatch', brokerTrade: null, otMurexTrade: null }
    ] }} />);
    const heading = screen.getByRole('heading', { name: 'Results' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('Showing 2 results.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Matched'));
    expect(screen.getByText('Showing 1 results.')).toBeTruthy();
    expect(screen.getByLabelText('Missing from OT/MUREX')).toBeTruthy();
  });
});
