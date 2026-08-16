import { DatabaseSync } from 'node:sqlite';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import { anomalyContextFor, type AnomalyThresholds } from '../../../domain/metrics/reconciliation-metrics.js';
import { BrokerEmailDraftSchema, ReconciliationRunSummarySchema, ReconciliationWorkspaceSchema, RunReportV1Schema, type BrokerEmailDraft, type ReconciliationRunSummary, type ReconciliationWorkspace, type RunReportV1 } from '../../../shared/contracts/reconciliation.js';
import type { Trade } from '../../../domain/reconciliation/reconciliation.js';

export interface DatabaseOptions { path: string; }
export interface Migration { version: number; sql: string; }
export interface SeededRunHistory {
  readonly historyKey: string;
  readonly asOfDate: string;
  readonly completedAt: string;
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
  readonly unresolvedRate: number;
}

export type ResultReviewOutcome = 'not-found' | 'not-eligible';
export type ResultCommentOutcome = 'not-found' | 'not-eligible';
export type BrokerPreviewOutcome = 'not-found' | 'not-eligible' | 'no-broker';
export type ReportPreparationOutcome = 'not-found' | { readonly kind: 'ineligible'; readonly outstanding: number };

export class SqliteDatabase {
  readonly db: DatabaseSync;

  constructor(options: DatabaseOptions) {
    this.db = new DatabaseSync(options.path);
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  migrate(migrations: readonly Migration[]): void {
    const ordered = [...migrations].sort((left, right) => left.version - right.version);
    if (ordered.some((migration, index) => migration.version < 1 || migration.version === ordered[index - 1]?.version)) {
      throw new Error('Migrations must use unique positive versions.');
    }
    const current = Number(this.db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const migration of ordered) {
        if (migration.version <= current) continue;
        this.db.exec(migration.sql);
        this.db.exec(`PRAGMA user_version = ${migration.version}`);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  persistRun(workspace: Omit<ReconciliationWorkspace, 'anomaly' | 'reviewProgress'>): void {
    this.transaction(() => {
      const metrics = workspace.metrics;
      this.db.prepare(`INSERT INTO runs (id, status, completed_at, as_of_date, total, matched, unresolved, reconciliation_rate, unresolved_rate)
        VALUES (?, 'completed', ?, ?, ?, ?, ?, ?, ?)`).run(workspace.runId, workspace.completedAt, workspace.asOfDate, metrics.total, metrics.matched, metrics.unresolved, metrics.reconciliationRate, metrics.unresolvedRate);
      const insertTrade = this.db.prepare(`INSERT INTO source_trades (run_id, source, trade_id, isin, buy_sell, currency, settlement_date, amount, quantity, price, broker_name, broker_recipient)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const seen = new Set<string>();
      for (const result of workspace.results) {
        for (const trade of [result.brokerTrade, result.otMurexTrade]) {
          if (!trade || seen.has(`${trade.source}\u0000${trade.tradeId}`)) continue;
          seen.add(`${trade.source}\u0000${trade.tradeId}`);
          insertTrade.run(...tradeRow(workspace.runId, trade));
        }
      }
      const insertResult = this.db.prepare(`INSERT INTO reconciliation_results (id, run_id, status, reason, broker_trade_id, ot_murex_trade_id)
        VALUES (?, ?, ?, ?, ?, ?)`);
      for (const result of workspace.results) {
        insertResult.run(`${workspace.runId}:${result.id}`, workspace.runId, result.status, result.reason, result.brokerTrade?.tradeId ?? null, result.otMurexTrade?.tradeId ?? null);
      }
    });
  }

  hasSeed(version: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM seed_versions WHERE version = ?').get(version));
  }

  recordSeed(version: string): void {
    this.db.prepare('INSERT INTO seed_versions (version) VALUES (?)').run(version);
  }

  replaceSeededHistory(seedVersion: string, histories: readonly SeededRunHistory[]): void {
    if (histories.length !== 5 || new Set(histories.map((history) => history.historyKey)).size !== 5 || histories.some((history) =>
      !Number.isInteger(history.total) || !Number.isInteger(history.matched) || !Number.isInteger(history.unresolved)
      || history.total < 0 || history.matched < 0 || history.unresolved < 0
      || history.matched + history.unresolved !== history.total
      || history.reconciliationRate !== (history.total === 0 ? 0 : history.matched / history.total)
      || history.unresolvedRate !== (history.total === 0 ? 0 : history.unresolved / history.total))) {
      throw new Error('Seeded reconciliation history must contain exactly five distinct runs.');
    }
    this.db.prepare('DELETE FROM seeded_run_history WHERE seed_version = ?').run(seedVersion);
    const insert = this.db.prepare(`INSERT INTO seeded_run_history (seed_version, history_key, as_of_date, completed_at, total, matched, unresolved, reconciliation_rate, unresolved_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const history of histories) {
      insert.run(seedVersion, history.historyKey, history.asOfDate, history.completedAt, history.total, history.matched, history.unresolved, history.reconciliationRate, history.unresolvedRate);
    }
  }

  latestSummary(seedVersion: string, thresholds: AnomalyThresholds): DashboardSummary | null {
    const row = this.db.prepare(`SELECT id AS runId, as_of_date AS asOfDate, completed_at AS completedAt, total, matched, unresolved,
      reconciliation_rate AS reconciliationRate, unresolved_rate AS unresolvedRate FROM runs WHERE status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT 1`).get() as unknown as RunSummaryRow | undefined;
    return row ? this.summarySnapshot(row, seedVersion, thresholds) : null;
  }

  listCompletedRuns(seedVersion: string, thresholds: AnomalyThresholds): readonly ReconciliationRunSummary[] {
    const rows = this.db.prepare(`SELECT id AS runId, as_of_date AS asOfDate, completed_at AS completedAt,
      total, matched, unresolved, reconciliation_rate AS reconciliationRate, unresolved_rate AS unresolvedRate
      FROM runs WHERE status = 'completed' ORDER BY completed_at DESC, id DESC`).all() as unknown as RunSummaryRow[];
    const historicalRates = this.seededHistoricalRates(seedVersion);
    return rows.map((row) => this.summarySnapshotFromRates(row, thresholds, historicalRates));
  }

  workspaceForRun(runId: string, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationWorkspace | null {
    return this.workspaceSnapshotForRun(runId, seedVersion, thresholds);
  }

  reviewUnmatchedResult(runId: string, resultId: string, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationWorkspace | ResultReviewOutcome {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT status FROM reconciliation_results WHERE id = ? AND run_id = ?').get(`${runId}:${resultId}`, runId) as { status: string } | undefined;
      if (!row) return 'not-found';
      if (row.status !== 'unmatched') return 'not-eligible';
      this.db.prepare("UPDATE reconciliation_results SET reviewed = 1 WHERE id = ? AND run_id = ? AND status = 'unmatched'").run(`${runId}:${resultId}`, runId);
      const workspace = this.workspaceSnapshotForRun(runId, seedVersion, thresholds);
      if (!workspace) throw new Error('Reviewed result could not be reloaded.');
      return workspace;
    });
  }

  saveResultComment(runId: string, resultId: string, comment: string | null, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationWorkspace | ResultCommentOutcome {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT status FROM reconciliation_results WHERE id = ? AND run_id = ?').get(`${runId}:${resultId}`, runId) as { status: string } | undefined;
      if (!row) return 'not-found';
      if (row.status === 'matched') return 'not-eligible';
      this.db.prepare("UPDATE reconciliation_results SET comment = ? WHERE id = ? AND run_id = ? AND status IN ('unmatched', 'missing-from-broker', 'missing-from-ot-murex')")
        .run(comment, `${runId}:${resultId}`, runId);
      const workspace = this.workspaceSnapshotForRun(runId, seedVersion, thresholds);
      if (!workspace) throw new Error('Commented result could not be reloaded.');
      return workspace;
    });
  }

  saveResultMismatchReason(runId: string, resultId: string, mismatchReason: string | null, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationWorkspace | ResultCommentOutcome {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT status FROM reconciliation_results WHERE id = ? AND run_id = ?').get(`${runId}:${resultId}`, runId) as { status: string } | undefined;
      if (!row) return 'not-found';
      if (row.status === 'matched') return 'not-eligible';
      this.db.prepare("UPDATE reconciliation_results SET mismatch_reason = ? WHERE id = ? AND run_id = ? AND status IN ('unmatched', 'missing-from-broker', 'missing-from-ot-murex')")
        .run(mismatchReason, `${runId}:${resultId}`, runId);
      const workspace = this.workspaceSnapshotForRun(runId, seedVersion, thresholds);
      if (!workspace) throw new Error('Result could not be reloaded after its mismatch reason changed.');
      return workspace;
    });
  }

  previewBrokerEmail(runId: string, resultId: string): BrokerEmailDraft | BrokerPreviewOutcome {
    const selected = this.db.prepare(`SELECT results.status, broker.broker_name AS brokerName, broker.broker_recipient AS brokerRecipient
      FROM reconciliation_results AS results
      LEFT JOIN source_trades AS broker ON broker.run_id = results.run_id AND broker.source = 'broker' AND broker.trade_id = results.broker_trade_id
      WHERE results.id = ? AND results.run_id = ?`).get(`${runId}:${resultId}`, runId) as BrokerPreviewSelectionRow | undefined;
    if (!selected) return 'not-found';
    if (selected.status !== 'unmatched') return 'not-eligible';
    if (!selected.brokerName || !selected.brokerRecipient) return 'no-broker';
    const rows = this.db.prepare(`SELECT broker.trade_id AS tradeId, broker.isin AS isin, broker.buy_sell AS buySell, broker.amount AS amount,
      broker.quantity AS quantity, broker.currency AS currency, broker.settlement_date AS settlementDate, results.reason AS mismatchReason, results.comment AS comment
      FROM reconciliation_results AS results
      INNER JOIN source_trades AS broker ON broker.run_id = results.run_id AND broker.source = 'broker' AND broker.trade_id = results.broker_trade_id
      WHERE results.run_id = ? AND results.status = 'unmatched' AND broker.broker_name = ? AND broker.broker_recipient = ?
      ORDER BY results.rowid ASC`).all(runId, selected.brokerName, selected.brokerRecipient) as unknown as BrokerPreviewRow[];
    return BrokerEmailDraftSchema.parse({
      status: 'Draft', brokerName: selected.brokerName, recipient: selected.brokerRecipient,
      subject: `Follow-up: unmatched trades for ${selected.brokerName}`,
      body: `Dear ${selected.brokerName} Operations,\n\nPlease review the unmatched trades listed below and confirm the appropriate resolution.\n\nKind regards,\nReconciliation Operations`,
      rows
    });
  }

  /** Produces the review gate and report data from the same SQLite transaction. */
  prepareVerifiedReport(runId: string, seedVersion: string, thresholds: AnomalyThresholds): RunReportV1 | ReportPreparationOutcome {
    return this.transaction(() => {
      const workspace = this.workspaceSnapshotForRun(runId, seedVersion, thresholds);
      if (!workspace) return 'not-found';
      const outstanding = workspace.reviewProgress.totalUnmatched - workspace.reviewProgress.reviewedUnmatched;
      if (outstanding > 0) return { kind: 'ineligible', outstanding };
      // Parse before freezing so an invalid database value can never reach the worker.
      return deepFreeze(RunReportV1Schema.parse({ version: 1, ...workspace }));
    });
  }

  private workspaceSnapshotForRun(runId: string, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationWorkspace | null {
    const run = this.db.prepare(`SELECT id AS runId, as_of_date AS asOfDate, completed_at AS completedAt,
      total, matched, unresolved, reconciliation_rate AS reconciliationRate, unresolved_rate AS unresolvedRate
      FROM runs WHERE id = ? AND status = 'completed'`).get(runId) as unknown as RunSummaryRow | undefined;
    if (!run) return null;
    const rows = this.db.prepare(`SELECT result_rowid, status, reason, reviewed, comment, mismatch_reason AS mismatchReason,
      broker.trade_id AS brokerTradeId, broker.isin AS brokerIsin, broker.buy_sell AS brokerBuySell, broker.currency AS brokerCurrency,
      broker.settlement_date AS brokerSettlementDate, broker.amount AS brokerAmount, broker.quantity AS brokerQuantity, broker.price AS brokerPrice, broker.broker_name AS brokerName, broker.broker_recipient AS brokerRecipient,
      ot_murex.trade_id AS otMurexTradeId, ot_murex.isin AS otMurexIsin, ot_murex.buy_sell AS otMurexBuySell, ot_murex.currency AS otMurexCurrency,
      ot_murex.settlement_date AS otMurexSettlementDate, ot_murex.amount AS otMurexAmount, ot_murex.quantity AS otMurexQuantity, ot_murex.price AS otMurexPrice
      FROM (SELECT rowid AS result_rowid, * FROM reconciliation_results WHERE run_id = ?) AS results
      LEFT JOIN source_trades AS broker ON broker.run_id = results.run_id AND broker.source = 'broker' AND broker.trade_id = results.broker_trade_id
      LEFT JOIN source_trades AS ot_murex ON ot_murex.run_id = results.run_id AND ot_murex.source = 'ot-murex' AND ot_murex.trade_id = results.ot_murex_trade_id
      ORDER BY result_rowid ASC`).all(runId) as unknown as HydratedResultRow[];
    return ReconciliationWorkspaceSchema.parse({
      ...this.summarySnapshotFromRates(run, thresholds, this.seededHistoricalRates(seedVersion)),
      results: rows.map((row) => {
        const brokerTrade = hydrateTrade(row, 'broker');
        const otMurexTrade = hydrateTrade(row, 'otMurex');
        return { id: JSON.stringify([brokerTrade?.tradeId ?? null, otMurexTrade?.tradeId ?? null]), status: row.status, reason: row.reason, reviewed: Boolean(row.reviewed), comment: row.comment, mismatchReason: row.mismatchReason, brokerTrade, otMurexTrade };
      }),
      reviewProgress: this.reviewProgressForRun(runId)
    });
  }

  close(): void { this.db.close(); }

  private summarySnapshot(row: RunSummaryRow, seedVersion: string, thresholds: AnomalyThresholds): ReconciliationRunSummary {
    return this.summarySnapshotFromRates(row, thresholds, this.seededHistoricalRates(seedVersion));
  }

  private seededHistoricalRates(seedVersion: string): readonly number[] {
    return (this.db.prepare(`SELECT unresolved_rate AS unresolvedRate FROM seeded_run_history
      WHERE seed_version = ? ORDER BY completed_at ASC, history_key ASC`).all(seedVersion) as unknown as { unresolvedRate: number }[])
      .map((history) => history.unresolvedRate);
  }

  private summarySnapshotFromRates(row: RunSummaryRow, thresholds: AnomalyThresholds, historicalRates: readonly number[]): ReconciliationRunSummary {
    const metrics = { total: row.total, matched: row.matched, unresolved: row.unresolved, reconciliationRate: row.reconciliationRate, unresolvedRate: row.unresolvedRate };
    return ReconciliationRunSummarySchema.parse({ ...row, metrics, anomaly: anomalyContextFor(metrics.unresolvedRate, historicalRates, thresholds) });
  }

  private reviewProgressForRun(runId: string): { reviewedUnmatched: number; totalUnmatched: number } {
    const row = this.db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status = 'unmatched' AND reviewed = 1 THEN 1 ELSE 0 END), 0) AS reviewedUnmatched,
      COALESCE(SUM(CASE WHEN status = 'unmatched' THEN 1 ELSE 0 END), 0) AS totalUnmatched
      FROM reconciliation_results WHERE run_id = ?`).get(runId) as { reviewedUnmatched: number; totalUnmatched: number };
    return row;
  }
}

interface HydratedResultRow {
  readonly status: 'matched' | 'unmatched' | 'missing-from-broker' | 'missing-from-ot-murex';
  readonly reason: 'amount-mismatch' | 'quantity-mismatch' | 'amount-and-quantity-mismatch' | null;
  readonly reviewed: number;
  readonly comment: string | null;
  readonly mismatchReason: string | null;
  readonly brokerTradeId: string | null; readonly brokerIsin: string | null; readonly brokerBuySell: 'buy' | 'sell' | null; readonly brokerCurrency: string | null;
  readonly brokerSettlementDate: string | null; readonly brokerAmount: string | null; readonly brokerQuantity: string | null; readonly brokerPrice: string | null;
  readonly brokerName: string | null; readonly brokerRecipient: string | null;
  readonly otMurexTradeId: string | null; readonly otMurexIsin: string | null; readonly otMurexBuySell: 'buy' | 'sell' | null; readonly otMurexCurrency: string | null;
  readonly otMurexSettlementDate: string | null; readonly otMurexAmount: string | null; readonly otMurexQuantity: string | null; readonly otMurexPrice: string | null;
}

interface BrokerPreviewSelectionRow { readonly status: string; readonly brokerName: string | null; readonly brokerRecipient: string | null; }
interface BrokerPreviewRow {
  readonly tradeId: string; readonly isin: string; readonly buySell: 'buy' | 'sell'; readonly amount: string; readonly quantity: string; readonly currency: string;
  readonly settlementDate: string; readonly mismatchReason: 'amount-mismatch' | 'quantity-mismatch' | 'amount-and-quantity-mismatch'; readonly comment: string | null;
}

interface RunSummaryRow {
  readonly runId: string;
  readonly asOfDate: string;
  readonly completedAt: string;
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
  readonly unresolvedRate: number;
}

function hydrateTrade(row: HydratedResultRow, prefix: 'broker' | 'otMurex'): Trade | null {
  const tradeId = row[`${prefix}TradeId`];
  if (!tradeId) return null;
  return {
    source: prefix === 'broker' ? 'broker' : 'ot-murex', tradeId,
    isin: row[`${prefix}Isin`]!, buySell: row[`${prefix}BuySell`]!, currency: row[`${prefix}Currency`]!,
    settlementDate: row[`${prefix}SettlementDate`]!, amount: row[`${prefix}Amount`]!, quantity: row[`${prefix}Quantity`]!, price: row[`${prefix}Price`]!,
    ...(prefix === 'broker' && row.brokerName && row.brokerRecipient ? { brokerContact: { name: row.brokerName, recipient: row.brokerRecipient } } : {})
  };
}

function tradeRow(runId: string, trade: Trade): [string, string, string, string, string, string, string, string, string, string, string | null, string | null] {
  return [runId, trade.source, trade.tradeId, trade.isin, trade.buySell, trade.currency, trade.settlementDate, trade.amount, trade.quantity, trade.price, trade.brokerContact?.name ?? null, trade.brokerContact?.recipient ?? null];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
