import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { DashboardChannels, DashboardGetRequestSchema, DashboardGetResultSchema, type DashboardSummary } from '../../shared/contracts/dashboard.js';

export interface DashboardQuery { latestSummary(): DashboardSummary | null; }
export type SenderValidator = (event: IpcMainInvokeEvent) => boolean;

// Compared as parsed URLs, not raw strings: the Vite dev server constant is origin-only
// ("http://localhost:5173") while the loaded frame reports it normalised with a trailing
// slash, so a string equality check rejects every request in `npm start`.
function canonicalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return new URL(value).href; } catch { return undefined; }
}

export function isTrustedRendererSender(event: IpcMainInvokeEvent, expectedUrl: string): boolean {
  if (event.senderFrame?.parent !== null) return false;
  const expected = canonicalUrl(expectedUrl);
  return expected !== undefined && canonicalUrl(event.senderFrame.url) === expected;
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
