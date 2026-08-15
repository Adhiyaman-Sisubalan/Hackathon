import { DatabaseSync } from 'node:sqlite';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import { ReconciliationWorkspaceSchema, type ReconciliationRunSummary, type ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import type { Trade } from '../../../domain/reconciliation/reconciliation.js';

export interface DatabaseOptions { path: string; }
export interface Migration { version: number; sql: string; }

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

  transaction(action: () => void): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      action();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  persistRun(workspace: ReconciliationWorkspace): void {
    this.transaction(() => {
      const metrics = workspace.metrics;
      this.db.prepare(`INSERT INTO runs (id, status, completed_at, as_of_date, total, matched, unresolved, reconciliation_rate)
        VALUES (?, 'completed', ?, ?, ?, ?, ?, ?)`).run(workspace.runId, workspace.completedAt, workspace.asOfDate, metrics.total, metrics.matched, metrics.unresolved, metrics.reconciliationRate);
      const insertTrade = this.db.prepare(`INSERT INTO source_trades (run_id, source, trade_id, isin, buy_sell, currency, settlement_date, amount, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
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

  latestSummary(): DashboardSummary | null {
    const row = this.db.prepare(`SELECT id AS runId, completed_at AS completedAt, total, matched, unresolved,
      reconciliation_rate AS reconciliationRate FROM runs WHERE status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT 1`).get() as DashboardSummary | undefined;
    return row ?? null;
  }

  listCompletedRuns(): readonly ReconciliationRunSummary[] {
    const rows = this.db.prepare(`SELECT id AS runId, as_of_date AS asOfDate, completed_at AS completedAt,
      total, matched, unresolved, reconciliation_rate AS reconciliationRate
      FROM runs WHERE status = 'completed' ORDER BY completed_at DESC, id DESC`).all() as unknown as RunSummaryRow[];
    return rows.map((row) => ({ runId: row.runId, asOfDate: row.asOfDate, completedAt: row.completedAt, metrics: {
      total: row.total, matched: row.matched, unresolved: row.unresolved, reconciliationRate: row.reconciliationRate
    } }));
  }

  workspaceForRun(runId: string): ReconciliationWorkspace | null {
    const run = this.db.prepare(`SELECT id AS runId, as_of_date AS asOfDate, completed_at AS completedAt,
      total, matched, unresolved, reconciliation_rate AS reconciliationRate
      FROM runs WHERE id = ? AND status = 'completed'`).get(runId) as unknown as RunSummaryRow | undefined;
    if (!run) return null;
    const rows = this.db.prepare(`SELECT result_rowid, status, reason,
      broker.trade_id AS brokerTradeId, broker.isin AS brokerIsin, broker.buy_sell AS brokerBuySell, broker.currency AS brokerCurrency,
      broker.settlement_date AS brokerSettlementDate, broker.amount AS brokerAmount, broker.quantity AS brokerQuantity, broker.price AS brokerPrice,
      ot_murex.trade_id AS otMurexTradeId, ot_murex.isin AS otMurexIsin, ot_murex.buy_sell AS otMurexBuySell, ot_murex.currency AS otMurexCurrency,
      ot_murex.settlement_date AS otMurexSettlementDate, ot_murex.amount AS otMurexAmount, ot_murex.quantity AS otMurexQuantity, ot_murex.price AS otMurexPrice
      FROM (SELECT rowid AS result_rowid, * FROM reconciliation_results WHERE run_id = ?) AS results
      LEFT JOIN source_trades AS broker ON broker.run_id = results.run_id AND broker.source = 'broker' AND broker.trade_id = results.broker_trade_id
      LEFT JOIN source_trades AS ot_murex ON ot_murex.run_id = results.run_id AND ot_murex.source = 'ot-murex' AND ot_murex.trade_id = results.ot_murex_trade_id
      ORDER BY result_rowid ASC`).all(runId) as unknown as HydratedResultRow[];
    return ReconciliationWorkspaceSchema.parse({
      runId: run.runId, asOfDate: run.asOfDate, completedAt: run.completedAt,
      metrics: { total: run.total, matched: run.matched, unresolved: run.unresolved, reconciliationRate: run.reconciliationRate },
      results: rows.map((row) => {
        const brokerTrade = hydrateTrade(row, 'broker');
        const otMurexTrade = hydrateTrade(row, 'otMurex');
        return { id: JSON.stringify([brokerTrade?.tradeId ?? null, otMurexTrade?.tradeId ?? null]), status: row.status, reason: row.reason, brokerTrade, otMurexTrade };
      })
    });
  }

  close(): void { this.db.close(); }
}

interface HydratedResultRow {
  readonly status: 'matched' | 'unmatched' | 'missing-from-broker' | 'missing-from-ot-murex';
  readonly reason: 'amount-mismatch' | 'quantity-mismatch' | 'amount-and-quantity-mismatch' | null;
  readonly brokerTradeId: string | null; readonly brokerIsin: string | null; readonly brokerBuySell: 'buy' | 'sell' | null; readonly brokerCurrency: string | null;
  readonly brokerSettlementDate: string | null; readonly brokerAmount: string | null; readonly brokerQuantity: string | null; readonly brokerPrice: string | null;
  readonly otMurexTradeId: string | null; readonly otMurexIsin: string | null; readonly otMurexBuySell: 'buy' | 'sell' | null; readonly otMurexCurrency: string | null;
  readonly otMurexSettlementDate: string | null; readonly otMurexAmount: string | null; readonly otMurexQuantity: string | null; readonly otMurexPrice: string | null;
}

interface RunSummaryRow {
  readonly runId: string;
  readonly asOfDate: string;
  readonly completedAt: string;
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
}

function hydrateTrade(row: HydratedResultRow, prefix: 'broker' | 'otMurex'): Trade | null {
  const tradeId = row[`${prefix}TradeId`];
  if (!tradeId) return null;
  return {
    source: prefix === 'broker' ? 'broker' : 'ot-murex', tradeId,
    isin: row[`${prefix}Isin`]!, buySell: row[`${prefix}BuySell`]!, currency: row[`${prefix}Currency`]!,
    settlementDate: row[`${prefix}SettlementDate`]!, amount: row[`${prefix}Amount`]!, quantity: row[`${prefix}Quantity`]!, price: row[`${prefix}Price`]!
  };
}

function tradeRow(runId: string, trade: Trade): [string, string, string, string, string, string, string, string, string, string] {
  return [runId, trade.source, trade.tradeId, trade.isin, trade.buySell, trade.currency, trade.settlementDate, trade.amount, trade.quantity, trade.price];
}
