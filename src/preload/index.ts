import { contextBridge, ipcRenderer } from 'electron';
import { DashboardChannels, DashboardGetResultSchema } from '../shared/contracts/dashboard.js';
import type { ReconciliationApi } from '../shared/contracts/preload.js';

const api: ReconciliationApi = {
  dashboard: {
    async get() {
      const response: unknown = await ipcRenderer.invoke(DashboardChannels.get, { version: 1 });
      return DashboardGetResultSchema.parse(response);
    }
  }
};

contextBridge.exposeInMainWorld('reconciliation', api);
