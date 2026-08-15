import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { DashboardChannels, DashboardGetRequestSchema, DashboardGetResultSchema, type DashboardSummary } from '../../shared/contracts/dashboard.js';

export interface DashboardQuery { latestSummary(): DashboardSummary | null; }
export type SenderValidator = (event: IpcMainInvokeEvent) => boolean;

export function isTrustedRendererSender(event: IpcMainInvokeEvent, expectedUrl: string): boolean {
  return event.senderFrame?.parent === null && event.senderFrame.url === expectedUrl;
}

export function registerDashboardHandlers(ipcMain: Pick<IpcMain, 'handle'>, query: DashboardQuery, validSender: SenderValidator): void {
  ipcMain.handle(DashboardChannels.get, (event, payload: unknown) => {
    if (!validSender(event) || !DashboardGetRequestSchema.safeParse(payload).success) {
      return DashboardGetResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'This request is not permitted.', retryable: false } });
    }
    try {
      return DashboardGetResultSchema.parse({ ok: true, data: { summary: query.latestSummary() } });
    } catch {
      return DashboardGetResultSchema.parse({ ok: false, error: { code: 'QUERY_FAILED', message: 'The dashboard could not be loaded.', retryable: true } });
    }
  });
}
