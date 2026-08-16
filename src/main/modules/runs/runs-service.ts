import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import { mkdir, unlink, link, stat } from 'node:fs/promises';
import path from 'node:path';
import { reconciliationMetricsFor } from '../../../domain/metrics/reconciliation-metrics.js';
import { reconciliationBootstrapConfig } from '../../bootstrap/reconciliation-config.js';
import { ReportWorkerReceiptSchema, type BrokerEmailDraft, ReconciliationRunAggregateSchema, type ReconciliationRunSummary, type ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import { DuplicateTradeIdError, reconcileTrades, type ReconciliationResult } from '../../../domain/reconciliation/reconciliation.js';
import type { Migration, SqliteDatabase } from '../../adapters/sqlite/database.js';
import type { ReportWorker } from '../../workers/report-worker-client.js';

export interface SeedFixture { version: string; apply(database: SqliteDatabase): void; }
export interface Scenario { asOfDate: string; brokerTrades: readonly import('../../../domain/reconciliation/reconciliation.js').Trade[]; otMurexTrades: readonly import('../../../domain/reconciliation/reconciliation.js').Trade[]; }
export interface ScenarioRegistry { find(asOfDate: string): Scenario | undefined; }
export interface RunsDependencies { readonly clock: { now(): string }; readonly ids: { next(): string }; readonly scenarios: ScenarioRegistry; readonly reports?: { readonly outputDirectory: string; readonly worker: ReportWorker }; }
export type ProgressReporter = (progress: { runId?: string; asOfDate: string; phase: 'started' | 'completed' | 'failed' }) => void;

export class RunInProgressError extends Error { readonly code = 'RUN_IN_PROGRESS'; constructor() { super('A reconciliation is already running.'); } }
export class UnsupportedDateError extends Error { readonly code = 'UNAVAILABLE'; constructor() { super('No seeded data for this date.'); } }
export class ResultNotFoundError extends Error { readonly code = 'RESULT_NOT_FOUND'; constructor() { super('This result is no longer available.'); } }
export class ResultNotEligibleError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Only unmatched results can be reviewed.'); } }
export class ResultCommentNotEligibleError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Comments are only available for unresolved results.'); } }
export class ResultMismatchReasonNotEligibleError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Mismatch reasons are only available for unresolved results.'); } }
export class BrokerPreviewNotEligibleError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Only broker-backed unmatched results can be previewed.'); } }
export class BrokerUnavailableError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Broker details are unavailable for this result.'); } }
export class ReportNotEligibleError extends Error { readonly code = 'REPORT_INELIGIBLE'; constructor(readonly outstanding: number) { super(`${outstanding} unmatched ${outstanding === 1 ? 'result remains' : 'results remain'} to review before saving the verified report.`); } }
export class ReportUnavailableError extends Error { readonly code = 'UNAVAILABLE'; constructor() { super('Verified report saving is unavailable.'); } }

export class RunsService {
  private active = false;
  constructor(private readonly database: SqliteDatabase, private readonly fixture: SeedFixture, private readonly dependencies?: RunsDependencies) {}

  migrate(migrations: readonly Migration[]): void { this.database.migrate(migrations); }

  seed(): void {
    this.database.transaction(() => {
      if (this.database.hasSeed(this.fixture.version)) return;
      this.fixture.apply(this.database);
      this.database.recordSeed(this.fixture.version);
    });
  }

  latestSummary(): DashboardSummary | null { return this.database.latestSummary(this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds); }

  listCompletedRuns(): readonly ReconciliationRunSummary[] { return this.database.listCompletedRuns(this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds); }

  workspaceForRun(runId: string): ReconciliationWorkspace | null { return this.database.workspaceForRun(runId, this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds); }

  reviewUnmatchedResult(runId: string, resultId: string): ReconciliationWorkspace {
    const outcome = this.database.reviewUnmatchedResult(runId, resultId, this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds);
    if (outcome === 'not-found') throw new ResultNotFoundError();
    if (outcome === 'not-eligible') throw new ResultNotEligibleError();
    return outcome;
  }

  saveResultComment(runId: string, resultId: string, comment: string): ReconciliationWorkspace {
    const outcome = this.database.saveResultComment(runId, resultId, comment === '' ? null : comment, this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds);
    if (outcome === 'not-found') throw new ResultNotFoundError();
    if (outcome === 'not-eligible') throw new ResultCommentNotEligibleError();
    return outcome;
  }

  saveResultMismatchReason(runId: string, resultId: string, mismatchReason: string): ReconciliationWorkspace {
    const outcome = this.database.saveResultMismatchReason(runId, resultId, mismatchReason.trim() === '' ? null : mismatchReason, this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds);
    if (outcome === 'not-found') throw new ResultNotFoundError();
    if (outcome === 'not-eligible') throw new ResultMismatchReasonNotEligibleError();
    return outcome;
  }

  previewBrokerEmail(runId: string, resultId: string): BrokerEmailDraft {
    const outcome = this.database.previewBrokerEmail(runId, resultId);
    if (outcome === 'not-found') throw new ResultNotFoundError();
    if (outcome === 'not-eligible') throw new BrokerPreviewNotEligibleError();
    if (outcome === 'no-broker') throw new BrokerUnavailableError();
    return outcome;
  }

  async saveVerifiedReport(runId: string): Promise<string> {
    const reportDependencies = this.dependencies?.reports;
    if (!reportDependencies) throw new ReportUnavailableError();
    const prepared = this.database.prepareVerifiedReport(runId, this.fixture.version, reconciliationBootstrapConfig.anomalyThresholds);
    if (prepared === 'not-found') throw new ResultNotFoundError();
    if ('kind' in prepared) throw new ReportNotEligibleError(prepared.outstanding);
    await mkdir(reportDependencies.outputDirectory, { recursive: true });
    const base = `reconciliation-${prepared.asOfDate}-${prepared.runId}`;
    const temporaryPath = path.join(reportDependencies.outputDirectory, `.${base}-${this.dependencies?.ids.next() ?? 'report'}.tmp.xlsx`);
    try {
      const receiptResult = ReportWorkerReceiptSchema.safeParse(await reportDependencies.worker.generate(prepared, temporaryPath));
      if (!receiptResult.success || receiptResult.data.temporaryPath !== temporaryPath) throw new Error('Invalid report worker receipt.');
      if ((await stat(temporaryPath)).size <= 0) throw new Error('Report worker did not produce a workbook.');
      for (let suffix = 0; ; suffix += 1) {
        const destination = path.join(reportDependencies.outputDirectory, `${base}${suffix === 0 ? '' : `-${suffix}`}.xlsx`);
        try {
          // link(2) publishes atomically and fails with EEXIST, unlike rename which could overwrite.
          await link(temporaryPath, destination);
          await unlink(temporaryPath).catch(() => undefined);
          return destination;
        } catch (error) {
          if (isAlreadyExists(error)) continue;
          throw error;
        }
      }
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  run(asOfDate: string, report?: ProgressReporter): ReconciliationWorkspace {
    if (this.active) throw new RunInProgressError();
    const scenario = this.dependencies?.scenarios.find(asOfDate);
    if (!scenario || !this.dependencies) throw new UnsupportedDateError();
    this.active = true;
    let committed = false;
    try {
      notify(report, { asOfDate, phase: 'started' });
      const results = reconcileTrades(scenario.brokerTrades, scenario.otMurexTrades);
      const aggregate = ReconciliationRunAggregateSchema.parse({ runId: this.dependencies.ids.next(), asOfDate, completedAt: this.dependencies.clock.now(), metrics: metricsFor(results), results });
      this.database.persistRun(aggregate);
      committed = true;
      const workspace = this.workspaceForRun(aggregate.runId);
      if (!workspace) throw new Error('Committed reconciliation run cannot be reloaded.');
      notify(report, { runId: workspace.runId, asOfDate, phase: 'completed' });
      return workspace;
    } catch (error) {
      if (!committed) notify(report, { asOfDate, phase: 'failed' });
      if (error instanceof DuplicateTradeIdError) throw error;
      throw error;
    } finally {
      this.active = false;
    }
  }
}

function isAlreadyExists(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'EEXIST'; }

function notify(report: ProgressReporter | undefined, progress: Parameters<ProgressReporter>[0]): void {
  try { report?.(progress); } catch { /* Progress delivery is observational and cannot alter a committed run. */ }
}

function metricsFor(results: readonly ReconciliationResult[]): ReconciliationWorkspace['metrics'] {
  return reconciliationMetricsFor(results.map((result) => result.status));
}
