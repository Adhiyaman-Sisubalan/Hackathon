import { describe, expect, it } from 'vitest';
import { dashboardState } from '../../src/renderer/features/dashboard/dashboard-model.js';

describe('dashboard state', () => {
  it('keeps loading, first-use, summary, and retryable failure distinct', () => {
    expect(dashboardState(undefined).kind).toBe('loading');
    expect(dashboardState(null).kind).toBe('first-use');
    expect(dashboardState(null, { message: 'Could not load', retryable: true }).kind).toBe('error');
    expect(dashboardState({ runId: '9e25f079-3a08-4504-b8a4-7f711d0d9e5e', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 10, matched: 9, unresolved: 1, reconciliationRate: .9, unresolvedRate: .1 }, anomaly: { kind: 'normal', currentUnresolvedRate: .1, historyCount: 5, baselineUnresolvedRate: .1 } }).kind).toBe('summary');
  });
});
