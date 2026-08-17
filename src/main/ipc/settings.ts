import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  SettingsChannels, SettingsCreateRequestSchema, SettingsDeleteRequestSchema, SettingsListRequestSchema,
  SettingsRowsResultSchema, SettingsUpdateRequestSchema, type SettingsRow, type SettingsTableId, type SettingsValues
} from '../../shared/contracts/settings.js';
import { SettingsRowNotFoundError, SettingsValuesInvalidError } from '../modules/settings/settings-service.js';
import type { SenderValidator } from './dashboard.js';

export interface SettingsCommand {
  list(table: SettingsTableId): readonly SettingsRow[];
  create(table: SettingsTableId, values: SettingsValues): readonly SettingsRow[];
  update(table: SettingsTableId, id: number, values: SettingsValues): readonly SettingsRow[];
  remove(table: SettingsTableId, id: number): readonly SettingsRow[];
}

const invalidRequest = () => SettingsRowsResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: 'This request is not permitted.', retryable: false } });

/** Maps a thrown domain error onto the typed envelope; anything else stays retryable. */
function failure(error: unknown, fallback: string) {
  if (error instanceof SettingsRowNotFoundError) {
    return SettingsRowsResultSchema.parse({ ok: false, error: { code: 'SETTINGS_ROW_NOT_FOUND', message: error.message, retryable: true } });
  }
  if (error instanceof SettingsValuesInvalidError) {
    return SettingsRowsResultSchema.parse({ ok: false, error: { code: 'INVALID_REQUEST', message: error.message, retryable: false } });
  }
  return SettingsRowsResultSchema.parse({ ok: false, error: { code: 'QUERY_FAILED', message: fallback, retryable: true } });
}

export function registerSettingsHandlers(ipcMain: Pick<IpcMain, 'handle'>, command: SettingsCommand, validSender: SenderValidator): void {
  ipcMain.handle(SettingsChannels.list, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = SettingsListRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) return invalidRequest();
    try {
      return SettingsRowsResultSchema.parse({ ok: true, data: { table: request.data.table, rows: command.list(request.data.table) } });
    } catch (error) {
      return failure(error, 'Settings could not be loaded. Please retry.');
    }
  });

  ipcMain.handle(SettingsChannels.create, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = SettingsCreateRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) return invalidRequest();
    try {
      return SettingsRowsResultSchema.parse({ ok: true, data: { table: request.data.table, rows: command.create(request.data.table, request.data.values) } });
    } catch (error) {
      return failure(error, 'The settings row could not be added. Please retry.');
    }
  });

  ipcMain.handle(SettingsChannels.update, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = SettingsUpdateRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) return invalidRequest();
    try {
      return SettingsRowsResultSchema.parse({ ok: true, data: { table: request.data.table, rows: command.update(request.data.table, request.data.id, request.data.values) } });
    } catch (error) {
      return failure(error, 'The settings row could not be saved. Please retry.');
    }
  });

  ipcMain.handle(SettingsChannels.remove, (event: IpcMainInvokeEvent, payload: unknown) => {
    const request = SettingsDeleteRequestSchema.safeParse(payload);
    if (!validSender(event) || !request.success) return invalidRequest();
    try {
      return SettingsRowsResultSchema.parse({ ok: true, data: { table: request.data.table, rows: command.remove(request.data.table, request.data.id) } });
    } catch (error) {
      return failure(error, 'The settings row could not be deleted. Please retry.');
    }
  });
}
