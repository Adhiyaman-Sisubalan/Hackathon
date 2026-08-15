import { contextBridge, ipcRenderer } from 'electron';
import { DashboardChannels, DashboardGetResultSchema } from '../shared/contracts/dashboard.js';
import { ReconciliationChannels, ReconciliationProgressSchema, ReconciliationRunResultSchema } from '../shared/contracts/reconciliation.js';
import type { ReconciliationApi } from '../shared/contracts/preload.js';

const api: ReconciliationApi = {
  dashboard: {
    async get() {
      const response: unknown = await ipcRenderer.invoke(DashboardChannels.get, { version: 1 });
      return DashboardGetResultSchema.parse(response);
    }
  },
  reconciliation: {
    async run(asOfDate) {
      const response: unknown = await ipcRenderer.invoke(ReconciliationChannels.run, { version: 1, asOfDate });
      return ReconciliationRunResultSchema.parse(response);
    },
    onProgress(listener) {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => listener(ReconciliationProgressSchema.parse(progress));
      ipcRenderer.on(ReconciliationChannels.progress, handler);
      return () => ipcRenderer.removeListener(ReconciliationChannels.progress, handler);
    }
  }
};

contextBridge.exposeInMainWorld('reconciliation', api);
