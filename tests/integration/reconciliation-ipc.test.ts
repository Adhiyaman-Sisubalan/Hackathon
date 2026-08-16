import { describe, expect, it, vi } from 'vitest';
import { registerReconciliationHandlers } from '../../src/main/ipc/reconciliation.js';
import { isTrustedRendererSender } from '../../src/main/ipc/dashboard.js';
import { DuplicateTradeIdError } from '../../src/domain/reconciliation/reconciliation.js';
import { ReconciliationChannels } from '../../src/shared/contracts/reconciliation.js';
import { ResultCommentNotEligibleError, ResultNotEligibleError, ResultNotFoundError } from '../../src/main/modules/runs/runs-service.js';

describe('reconciliation IPC boundary', () => {
  it('validates sender and payload, returns safe typed failures, and emits parsed progress', async () => {
    let handler: ((event: any, payload: unknown) => any) | undefined;
    const send = vi.fn();
    registerReconciliationHandlers({ handle: vi.fn((_channel, received) => { handler = received; }) }, {
      run: (_date, report) => { report({ asOfDate: '2026-08-15', phase: 'started' }); return { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 1, unresolved: 0, reconciliationRate: 1, unresolvedRate: 0 }, anomaly: { kind: 'normal' as const, currentUnresolvedRate: 0, historyCount: 5 as const, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 0 }, results: [] }; }
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

  it('exposes only typed run-history snapshots and maps a stale workspace to not found', async () => {
    const handlers = new Map<string, (event: any, payload: unknown) => any>();
    const workspace = { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 0, unresolved: 1, reconciliationRate: 0, unresolvedRate: 1 }, anomaly: { kind: 'warning' as const, currentUnresolvedRate: 1, historyCount: 5 as const, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 1 }, results: [] };
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, {
      run: () => workspace,
      listCompletedRuns: () => [{ runId: workspace.runId, asOfDate: workspace.asOfDate, completedAt: workspace.completedAt, metrics: workspace.metrics, anomaly: workspace.anomaly }],
      workspaceForRun: (runId) => runId === workspace.runId ? workspace : null
    }, () => true);
    const event = { sender: { send: vi.fn() } };
    expect(await handlers.get(ReconciliationChannels.listRuns)?.(event, { version: 1 })).toMatchObject({ ok: true, data: { runs: [{ runId: workspace.runId }] } });
    expect(await handlers.get(ReconciliationChannels.getWorkspace)?.(event, { version: 1, runId: workspace.runId })).toMatchObject({ ok: true, data: { workspace: { runId: workspace.runId } } });
    expect(await handlers.get(ReconciliationChannels.getWorkspace)?.(event, { version: 1, runId: '22222222-2222-4222-8222-222222222222' })).toEqual({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'This run is no longer available.', retryable: true } });
  });

  it('exposes the strict idempotent result-review channel and hides retryable persistence failures', async () => {
    const handlers = new Map<string, (event: any, payload: unknown) => any>();
    const workspace = { runId: '11111111-1111-4111-8111-111111111111', asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 0, unresolved: 1, reconciliationRate: 0, unresolvedRate: 1 }, anomaly: { kind: 'warning' as const, currentUnresolvedRate: 1, historyCount: 5 as const, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: 1, totalUnmatched: 1 }, results: [] };
    const reviewUnmatchedResult = vi.fn(() => workspace);
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => workspace, reviewUnmatchedResult }, () => true);
    const event = { sender: { send: vi.fn() } };
    expect(await handlers.get(ReconciliationChannels.reviewResult)?.(event, { version: 1, runId: workspace.runId, resultId: 'logical-result' })).toMatchObject({ ok: true, data: { workspace: { reviewProgress: { reviewedUnmatched: 1 } } } });
    expect(reviewUnmatchedResult).toHaveBeenCalledWith(workspace.runId, 'logical-result');
    expect(await handlers.get(ReconciliationChannels.reviewResult)?.(event, { version: 2, runId: workspace.runId, resultId: 'logical-result' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => workspace, reviewUnmatchedResult: () => { throw new Error('sqlite private detail'); } }, () => true);
    expect(await handlers.get(ReconciliationChannels.reviewResult)?.(event, { version: 1, runId: workspace.runId, resultId: 'logical-result' })).toEqual({ ok: false, error: { code: 'PERSISTENCE_FAILED', message: 'The result review could not be saved. Please retry.', retryable: true } });
    expect(ReconciliationChannels.reviewResult).toBe('result.review.v1');
  });

  it('rejects untrusted review callers and maps missing or ineligible result reviews without a retry', async () => {
    const handlers = new Map<string, (event: any, payload: unknown) => any>();
    const runId = '11111111-1111-4111-8111-111111111111';
    const register = (reviewUnmatchedResult: () => never) => registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => { throw new Error('unused'); }, reviewUnmatchedResult }, () => true);
    register(() => { throw new ResultNotFoundError(); });
    const handler = handlers.get(ReconciliationChannels.reviewResult)!;
    expect(await handler({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'missing' })).toEqual({ ok: false, error: { code: 'RESULT_NOT_FOUND', message: 'This result is no longer available.', retryable: false } });
    register(() => { throw new ResultNotEligibleError(); });
    expect(await handlers.get(ReconciliationChannels.reviewResult)!({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'matched' })).toEqual({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Only unmatched results can be reviewed.', retryable: false, field: 'resultId' } });
    registerReconciliationHandlers({ handle: vi.fn((channel, next) => { handlers.set(channel, next); }) }, { run: () => { throw new Error('unused'); }, reviewUnmatchedResult: () => { throw new Error('must not execute'); } }, () => false);
    expect(await handlers.get(ReconciliationChannels.reviewResult)!({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'blocked' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST', retryable: false } });
  });

  it('exposes the strict sender-validated comment command and hides persistence details', async () => {
    const handlers = new Map<string, (event: any, payload: unknown) => any>();
    const runId = '11111111-1111-4111-8111-111111111111';
    const workspace = { runId, asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 1, matched: 0, unresolved: 1, reconciliationRate: 0, unresolvedRate: 1 }, anomaly: { kind: 'warning' as const, currentUnresolvedRate: 1, historyCount: 5 as const, baselineUnresolvedRate: .1 }, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 1 }, results: [{ id: 'logical-result', status: 'unmatched' as const, reason: 'amount-mismatch' as const, reviewed: false, comment: 'Saved value', brokerTrade: null, otMurexTrade: null }] };
    const saveResultComment = vi.fn(() => workspace);
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => workspace, saveResultComment }, () => true);
    const event = { sender: { send: vi.fn() } };
    expect(await handlers.get(ReconciliationChannels.saveComment)?.(event, { version: 1, runId, resultId: 'logical-result', comment: 'Saved value' })).toMatchObject({ ok: true, data: { workspace: { results: [{ comment: 'Saved value' }] } } });
    expect(saveResultComment).toHaveBeenCalledWith(runId, 'logical-result', 'Saved value');
    expect(await handlers.get(ReconciliationChannels.saveComment)?.(event, { version: 1, runId, resultId: 'logical-result', comment: 'Saved value', unexpected: true })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => workspace, saveResultComment: () => { throw new Error('sqlite private detail'); } }, () => true);
    expect(await handlers.get(ReconciliationChannels.saveComment)?.(event, { version: 1, runId, resultId: 'logical-result', comment: 'Saved value' })).toEqual({ ok: false, error: { code: 'PERSISTENCE_FAILED', message: 'The comment could not be saved. Please retry.', retryable: true } });
    expect(ReconciliationChannels.saveComment).toBe('comment.save.v1');
  });

  it('rejects untrusted, missing, and matched comment requests without calling the command', async () => {
    const handlers = new Map<string, (event: any, payload: unknown) => any>();
    const runId = '11111111-1111-4111-8111-111111111111';
    const command = vi.fn(() => { throw new ResultNotFoundError(); });
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => { throw new Error('unused'); }, saveResultComment: command }, () => false);
    expect(await handlers.get(ReconciliationChannels.saveComment)!({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'blocked', comment: 'Nope' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST', retryable: false } });
    expect(command).not.toHaveBeenCalled();
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => { throw new Error('unused'); }, saveResultComment: () => { throw new ResultNotFoundError(); } }, () => true);
    expect(await handlers.get(ReconciliationChannels.saveComment)!({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'missing', comment: 'Nope' })).toEqual({ ok: false, error: { code: 'RESULT_NOT_FOUND', message: 'This result is no longer available.', retryable: false } });
    registerReconciliationHandlers({ handle: vi.fn((channel, handler) => { handlers.set(channel, handler); }) }, { run: () => { throw new Error('unused'); }, saveResultComment: () => { throw new ResultCommentNotEligibleError(); } }, () => true);
    expect(await handlers.get(ReconciliationChannels.saveComment)!({ sender: { send: vi.fn() } }, { version: 1, runId, resultId: 'matched', comment: 'Nope' })).toEqual({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Comments are only available for unresolved results.', retryable: false, field: 'resultId' } });
  });
});
