import { describe, expect, it, vi } from 'vitest';
import { registerReconciliationHandlers } from '../../src/main/ipc/reconciliation.js';
import { isTrustedRendererSender } from '../../src/main/ipc/dashboard.js';
import { DuplicateTradeIdError } from '../../src/domain/reconciliation/reconciliation.js';
import { ReconciliationChannels } from '../../src/shared/contracts/reconciliation.js';

describe('reconciliation IPC boundary', () => {
  it('validates sender and payload, returns safe typed failures, and emits parsed progress', async () => {
    let handler: ((event: any, payload: unknown) => any) | undefined;
    const send = vi.fn();
    registerReconciliationHandlers({ handle: vi.fn((_channel, received) => { handler = received; }) }, {
      run: (_date, report) => { report({ asOfDate: '2026-08-15', phase: 'started' }); return { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 1, unresolved: 0, reconciliationRate: 1 }, results: [] }; }
    }, () => true);
    expect(await handler?.({ sender: { send } }, { version: 1, asOfDate: '2026-08-16' })).toMatchObject({ ok: true });
    expect(send).toHaveBeenCalledWith(ReconciliationChannels.progress, { asOfDate: '2026-08-15', phase: 'started' });
    expect(await handler?.({ sender: { send } }, { version: 2, asOfDate: '2026-08-15' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(ReconciliationChannels.run).toBe('reconciliation.run.v1');
  });

  it('requires the exact trusted top-level sender and maps command failures to typed safe envelopes', async () => {
    let handler: ((event: any, payload: unknown) => any) | undefined;
    const expectedUrl = 'file:///app/index.html';
    registerReconciliationHandlers({ handle: vi.fn((_channel, received) => { handler = received; }) }, {
      run: () => { throw new DuplicateTradeIdError(); }
    }, (event) => isTrustedRendererSender(event as never, expectedUrl));
    const event = { senderFrame: { parent: null, url: expectedUrl }, sender: { send: vi.fn() } };
    expect(await handler?.(event, { version: 1, asOfDate: '2026-08-15' })).toMatchObject({ ok: false, error: { code: 'DUPLICATE_TRADE_ID', retryable: true, field: 'asOfDate' } });
    expect(await handler?.({ senderFrame: { parent: null, url: 'file:///other/index.html' }, sender: { send: vi.fn() } }, { version: 1, asOfDate: '2026-08-15' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST', retryable: false } });
    expect(await handler?.({ senderFrame: { parent: {}, url: expectedUrl }, sender: { send: vi.fn() } }, { version: 1, asOfDate: '2026-08-15' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('hides unexpected persistence details behind its retryable typed failure', async () => {
    let handler: ((event: any, payload: unknown) => any) | undefined;
    registerReconciliationHandlers({ handle: vi.fn((_channel, received) => { handler = received; }) }, { run: () => { throw new Error('sqlite path /private/internal'); } }, () => true);
    const result = await handler?.({ sender: { send: vi.fn() } }, { version: 1, asOfDate: '2026-08-15' });
    expect(result).toEqual({ ok: false, error: { code: 'PERSISTENCE_FAILED', message: 'The reconciliation could not be saved. Please retry.', retryable: true } });
  });
});
