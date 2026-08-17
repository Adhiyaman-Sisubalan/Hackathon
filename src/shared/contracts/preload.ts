import type { DashboardGetResult } from './dashboard.js';
import type { BrokerPreviewResult, ReconciliationProgress, ReconciliationRunResult, ReportSaveResult, ResultCommentSaveResult, ResultMismatchReasonSaveResult, ResultReviewResult, RunWorkspaceGetResult, RunsListResult } from './reconciliation.js';
import type { SettingsRowsResult, SettingsTableId, SettingsValues } from './settings.js';

export interface ReconciliationApi {
  dashboard: { get(): Promise<DashboardGetResult> };
  reconciliation: {
    run(asOfDate: string): Promise<ReconciliationRunResult>;
    onProgress(listener: (progress: ReconciliationProgress) => void): () => void;
  };
  runs: {
    list(): Promise<RunsListResult>;
    getWorkspace(runId: string): Promise<RunWorkspaceGetResult>;
    reviewResult(runId: string, resultId: string): Promise<ResultReviewResult>;
    saveComment(runId: string, resultId: string, comment: string): Promise<ResultCommentSaveResult>;
    saveMismatchReason(runId: string, resultId: string, mismatchReason: string): Promise<ResultMismatchReasonSaveResult>;
    previewBrokerEmail(runId: string, resultId: string): Promise<BrokerPreviewResult>;
    saveReport(runId: string): Promise<ReportSaveResult>;
  };
  settings: {
    list(table: SettingsTableId): Promise<SettingsRowsResult>;
    create(table: SettingsTableId, values: SettingsValues): Promise<SettingsRowsResult>;
    update(table: SettingsTableId, id: number, values: SettingsValues): Promise<SettingsRowsResult>;
    remove(table: SettingsTableId, id: number): Promise<SettingsRowsResult>;
  };
}
