import { contextBridge, ipcRenderer } from 'electron';
import { DashboardChannels, DashboardGetResultSchema } from '../shared/contracts/dashboard.js';
import { ReconciliationChannels, ReconciliationProgressSchema, ReconciliationRunResultSchema, ResultCommentSaveResultSchema, ResultReviewResultSchema, RunWorkspaceGetResultSchema, RunsListResultSchema } from '../shared/contracts/reconciliation.js';
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
  },
  runs: {
    async list() {
      const response: unknown = await ipcRenderer.invoke(ReconciliationChannels.listRuns, { version: 1 });
      return RunsListResultSchema.parse(response);
    },
    async getWorkspace(runId) {
      const response: unknown = await ipcRenderer.invoke(ReconciliationChannels.getWorkspace, { version: 1, runId });
      return RunWorkspaceGetResultSchema.parse(response);
    },
    async reviewResult(runId, resultId) {
      const response: unknown = await ipcRenderer.invoke(ReconciliationChannels.reviewResult, { version: 1, runId, resultId });
      return ResultReviewResultSchema.parse(response);
    },
    async saveComment(runId, resultId, comment) {
      const response: unknown = await ipcRenderer.invoke(ReconciliationChannels.saveComment, { version: 1, runId, resultId, comment });
      return ResultCommentSaveResultSchema.parse(response);
    }
  }
};

contextBridge.exposeInMainWorld('reconciliation', api);
