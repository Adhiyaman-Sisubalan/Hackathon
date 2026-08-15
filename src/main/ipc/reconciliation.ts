import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ReconciliationChannels, ReconciliationProgressSchema, ReconciliationRunRequestSchema, ReconciliationRunResultSchema, RunWorkspaceGetRequestSchema, RunWorkspaceGetResultSchema, RunsListRequestSchema, RunsListResultSchema, type ReconciliationRunSummary, type ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import { DuplicateTradeIdError } from '../../domain/reconciliation/reconciliation.js';
import { RunInProgressError, UnsupportedDateError } from '../modules/runs/runs-service.js';
import type { SenderValidator } from './dashboard.js';

export interface ReconciliationCommand {
  run(asOfDate: string, report: (progress: { runId?: string; asOfDate: string; phase: 'started' | 'completed' | 'failed' }) => void): ReconciliationWorkspace;
  listCompletedRuns?(): readonly ReconciliationRunSummary[];
  workspaceForRun?(runId: string): ReconciliationWorkspace | null;
}

export function registerReconciliationHandlers(ipcMain: Pick<IpcMain, 'handle'>, command: ReconciliationCommand, validSender: SenderValidator): void {
  ipcMain.handle(ReconciliationChannels.listRuns, (event: IpcMainInvokeEvent, payload: unknown) => {
    if (!validSender(event) || !RunsListRequestSchema.safeParse(payload).success) {
      return RunsListResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'This request is not permitted.', retryable: false } });
    }
    try {
      if (!command.listCompletedRuns) throw new Error('Run history is unavailable.');
      return RunsListResultSchema.parse({ ok: true, data: { runs: command.listCompletedRuns() } });
    } catch {
      return RunsListResultSchema.parse({ ok: false, error: { code: 'QUERY_FAILED', message: 'Run history could not be loaded. Please retry.', retryable: true } });
    }
  });
  ipcMain.handle(ReconciliationChannels.getWorkspace, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = RunWorkspaceGetRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) {
      return RunWorkspaceGetResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'This request is not permitted.', retryable: false } });
    }
    try {
      if (!command.workspaceForRun) throw new Error('Run workspace is unavailable.');
      const workspace = command.workspaceForRun(request.data.runId);
      if (!workspace) return RunWorkspaceGetResultSchema.parse({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'This run is no longer available.', retryable: true } });
      return RunWorkspaceGetResultSchema.parse({ ok: true, data: { workspace } });
    } catch {
      return RunWorkspaceGetResultSchema.parse({ ok: false, error: { code: 'QUERY_FAILED', message: 'Run details could not be loaded. Please retry.', retryable: true } });
    }
  });
  ipcMain.handle(ReconciliationChannels.run, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = ReconciliationRunRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) return ReconciliationRunResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'This request is not permitted.', retryable: false } });
    try {
      const workspace = command.run(request.data.asOfDate, (progress) => event.sender.send(ReconciliationChannels.progress, ReconciliationProgressSchema.parse(progress)));
      return ReconciliationRunResultSchema.parse({ ok: true, data: { workspace } });
    } catch (error) {
      if (error instanceof DuplicateTradeIdError) return ReconciliationRunResultSchema.parse({ ok: false, error: { code: 'DUPLICATE_TRADE_ID', message: 'Seeded trade IDs are not valid. Please retry.', retryable: true, field: 'asOfDate' } });
      if (error instanceof RunInProgressError) return ReconciliationRunResultSchema.parse({ ok: false, error: { code: 'RUN_IN_PROGRESS', message: 'A reconciliation is already running.', retryable: true } });
      if (error instanceof UnsupportedDateError) return ReconciliationRunResultSchema.parse({ ok: false, error: { code: 'UNAVAILABLE', message: 'No seeded data for this date.', retryable: false, field: 'asOfDate' } });
      return ReconciliationRunResultSchema.parse({ ok: false, error: { code: 'PERSISTENCE_FAILED', message: 'The reconciliation could not be saved. Please retry.', retryable: true } });
    }
  });
}
