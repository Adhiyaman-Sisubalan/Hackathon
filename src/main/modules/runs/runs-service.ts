import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import { reconciliationMetricsFor } from '../../../domain/metrics/reconciliation-metrics.js';
import { reconciliationBootstrapConfig } from '../../bootstrap/reconciliation-config.js';
import { ReconciliationRunAggregateSchema, type ReconciliationRunSummary, type ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import { DuplicateTradeIdError, reconcileTrades, type ReconciliationResult } from '../../../domain/reconciliation/reconciliation.js';
import type { Migration, SqliteDatabase } from '../../adapters/sqlite/database.js';

export interface SeedFixture { version: string; apply(database: SqliteDatabase): void; }
export interface Scenario { asOfDate: string; brokerTrades: readonly import('../../../domain/reconciliation/reconciliation.js').Trade[]; otMurexTrades: readonly import('../../../domain/reconciliation/reconciliation.js').Trade[]; }
export interface ScenarioRegistry { find(asOfDate: string): Scenario | undefined; }
export interface RunsDependencies { readonly clock: { now(): string }; readonly ids: { next(): string }; readonly scenarios: ScenarioRegistry; }
export type ProgressReporter = (progress: { runId?: string; asOfDate: string; phase: 'started' | 'completed' | 'failed' }) => void;

export class RunInProgressError extends Error { readonly code = 'RUN_IN_PROGRESS'; constructor() { super('A reconciliation is already running.'); } }
export class UnsupportedDateError extends Error { readonly code = 'UNAVAILABLE'; constructor() { super('No seeded data for this date.'); } }
export class ResultNotFoundError extends Error { readonly code = 'RESULT_NOT_FOUND'; constructor() { super('This result is no longer available.'); } }
export class ResultNotEligibleError extends Error { readonly code = 'INVALID_REQUEST'; constructor() { super('Only unmatched results can be reviewed.'); } }

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
    const outcome = this.database.reviewUnmatchedResult(runId, resultId);
    if (outcome === 'not-found') throw new ResultNotFoundError();
    if (outcome === 'not-eligible') throw new ResultNotEligibleError();
    const workspace = this.workspaceForRun(runId);
    if (!workspace) throw new ResultNotFoundError();
    return workspace;
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

function notify(report: ProgressReporter | undefined, progress: Parameters<ProgressReporter>[0]): void {
  try { report?.(progress); } catch { /* Progress delivery is observational and cannot alter a committed run. */ }
}

function metricsFor(results: readonly ReconciliationResult[]): ReconciliationWorkspace['metrics'] {
  return reconciliationMetricsFor(results.map((result) => result.status));
}
