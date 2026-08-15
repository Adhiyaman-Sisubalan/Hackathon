import { DatabaseSync } from 'node:sqlite';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import type { ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
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

  close(): void { this.db.close(); }
}

function tradeRow(runId: string, trade: Trade): [string, string, string, string, string, string, string, string, string, string] {
  return [runId, trade.source, trade.tradeId, trade.isin, trade.buySell, trade.currency, trade.settlementDate, trade.amount, trade.quantity, trade.price];
}
