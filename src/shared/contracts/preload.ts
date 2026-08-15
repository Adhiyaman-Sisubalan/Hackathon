import type { DashboardGetResult } from './dashboard.js';
import type { ReconciliationProgress, ReconciliationRunResult, RunWorkspaceGetResult, RunsListResult } from './reconciliation.js';

export interface ReconciliationApi {
  dashboard: { get(): Promise<DashboardGetResult> };
  reconciliation: {
    run(asOfDate: string): Promise<ReconciliationRunResult>;
    onProgress(listener: (progress: ReconciliationProgress) => void): () => void;
  };
  runs: {
    list(): Promise<RunsListResult>;
    getWorkspace(runId: string): Promise<RunWorkspaceGetResult>;
  };
}
