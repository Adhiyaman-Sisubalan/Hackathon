import type { DashboardGetResult } from './dashboard.js';
import type { ReconciliationProgress, ReconciliationRunResult } from './reconciliation.js';

export interface ReconciliationApi {
  dashboard: { get(): Promise<DashboardGetResult> };
  reconciliation: {
    run(asOfDate: string): Promise<ReconciliationRunResult>;
    onProgress(listener: (progress: ReconciliationProgress) => void): () => void;
  };
}
