import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { ReconciliationChannels, ReconciliationProgressSchema, ReconciliationRunRequestSchema, ReconciliationRunResultSchema, type ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import { DuplicateTradeIdError } from '../../domain/reconciliation/reconciliation.js';
import { RunInProgressError, UnsupportedDateError } from '../modules/runs/runs-service.js';
import type { SenderValidator } from './dashboard.js';

export interface ReconciliationCommand { run(asOfDate: string, report: (progress: { runId?: string; asOfDate: string; phase: 'started' | 'completed' | 'failed' }) => void): ReconciliationWorkspace; }

export function registerReconciliationHandlers(ipcMain: Pick<IpcMain, 'handle'>, command: ReconciliationCommand, validSender: SenderValidator): void {
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
