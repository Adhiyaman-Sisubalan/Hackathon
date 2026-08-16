import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reconciliationScenarios } from '../../fixtures/reconciliation-scenarios.js';
import { initialSeed } from '../../fixtures/initial-seed.js';
import { SqliteDatabase } from '../../src/main/adapters/sqlite/database.js';
import { DuplicateTradeIdError } from '../../src/domain/reconciliation/reconciliation.js';
import { RunsService, UnsupportedDateError, type ScenarioRegistry } from '../../src/main/modules/runs/runs-service.js';

const directories: string[] = [];
const migrationNames = ['001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql', '004-result-review.sql'];
const migrations = migrationNames.map((filename, index) => ({ version: index + 1, sql: readFileSync(`migrations/${filename}`, 'utf8') }));
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function setup(registry: ScenarioRegistry = reconciliationScenarios) {
  const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-runs-'));
  directories.push(directory);
  const database = new SqliteDatabase({ path: path.join(directory, 'runs.sqlite') });
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  const runs = new RunsService(database, initialSeed, { clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => ids.shift()! }, scenarios: registry });
  runs.migrate(migrations);
  runs.seed();
  return { database, runs, directory };
}

describe('persisted reconciliation runs', () => {
  it('supports every seeded date and does not let an observing progress listener affect a committed run', () => {
    const { database, runs } = setup();
    const thirteenth = runs.run('2026-08-13', () => { throw new Error('renderer closed'); });
    const fourteenth = runs.run('2026-08-14');
    expect(thirteenth.metrics).toEqual({ total: 1, matched: 1, unresolved: 0, reconciliationRate: 1, unresolvedRate: 0 });
    expect(fourteenth.results.map((result) => result.status)).toEqual(['unmatched', 'missing-from-ot-murex']);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 2 });
    database.close();
  });

  it('persists a deterministic full aggregate, produces all statuses, and preserves reruns', () => {
    const { database, runs } = setup();
    const first = runs.run('2026-08-15');
    const second = runs.run('2026-08-15');
    expect(first.metrics).toEqual({ total: 6, matched: 2, unresolved: 4, reconciliationRate: 1 / 3, unresolvedRate: 2 / 3 });
    expect(first.results.map((result) => result.status)).toEqual(['matched', 'unmatched', 'matched', 'missing-from-ot-murex', 'missing-from-ot-murex', 'missing-from-broker']);
    expect(second.runId).not.toBe(first.runId);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT count(*) AS count FROM source_trades WHERE run_id = ?').get(first.runId)).toEqual({ count: 9 });
    expect(database.db.prepare('SELECT count(*) AS count FROM reconciliation_results WHERE run_id = ?').get(first.runId)).toEqual({ count: 6 });
    expect(runs.latestSummary()).toMatchObject({ runId: second.runId, metrics: { total: 6, matched: 2, unresolved: 4 } });
    database.close();
  });

  it('writes neither a run nor evidence for unsupported, duplicate, or transaction-failing work', () => {
    const { database, runs } = setup();
    expect(() => runs.run('2026-08-16')).toThrow(UnsupportedDateError);
    database.db.exec(`CREATE TRIGGER reject_evidence BEFORE INSERT ON source_trades BEGIN SELECT RAISE(ABORT, 'test persistence failure'); END`);
    expect(() => runs.run('2026-08-15')).toThrow();
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 0 });
    database.close();

    const duplicate = { find: () => ({ asOfDate: '2026-08-15', brokerTrades: [{ source: 'broker' as const, tradeId: 'DUP', isin: 'US0000000001', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount: '1', quantity: '1', price: '1' }, { source: 'broker' as const, tradeId: 'DUP', isin: 'US0000000002', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount: '1', quantity: '1', price: '1' }], otMurexTrades: [] }) };
    const duplicateSetup = setup(duplicate);
    expect(() => duplicateSetup.runs.run('2026-08-15')).toThrow(DuplicateTradeIdError);
    expect(duplicateSetup.database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 0 });
    duplicateSetup.database.close();
  });

  it('upgrades a v1 database without altering its existing run, backfills its unresolved rate, and exposes authoritative snapshots', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-upgrade-'));
    directories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'upgrade.sqlite') });
    database.migrate([migrations[0]!]);
    const runId = '99999999-9999-4999-8999-999999999999';
    database.db.prepare(`INSERT INTO runs (id, status, completed_at, total, matched, unresolved, reconciliation_rate) VALUES (?, 'completed', ?, 5, 3, 2, .6)`)
      .run(runId, '2026-08-15T00:00:00.000Z');
    database.migrate(migrations);
    expect(database.db.prepare('SELECT id, as_of_date AS asOfDate, total, unresolved_rate AS unresolvedRate FROM runs').get()).toEqual({ id: runId, asOfDate: '2026-08-15', total: 5, unresolvedRate: .4 });
    expect(database.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 4 });
    const runs = new RunsService(database, initialSeed);
    runs.seed();
    expect(runs.latestSummary()).toMatchObject({ runId, metrics: { total: 5, matched: 3, unresolved: 2, reconciliationRate: .6, unresolvedRate: .4 } });
    expect(runs.workspaceForRun(runId)).toMatchObject({ runId, metrics: { unresolvedRate: .4 } });
    database.close();
  });

  it('backfills a zero-total legacy run with safe zero rates and a usable summary', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-zero-upgrade-'));
    directories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'upgrade.sqlite') });
    database.migrate([migrations[0]!]);
    const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    database.db.prepare(`INSERT INTO runs (id, status, completed_at, total, matched, unresolved, reconciliation_rate) VALUES (?, 'completed', ?, 0, 0, 0, 0)`)
      .run(runId, '2026-08-15T00:00:00.000Z');
    database.migrate(migrations);
    const runs = new RunsService(database, initialSeed);
    runs.seed();
    expect(database.db.prepare('SELECT unresolved_rate AS unresolvedRate FROM runs WHERE id = ?').get(runId)).toEqual({ unresolvedRate: 0 });
    expect(runs.latestSummary()).toMatchObject({ runId, metrics: { total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 } });
    expect(runs.workspaceForRun(runId)).toMatchObject({ runId, metrics: { reconciliationRate: 0, unresolvedRate: 0 } });
    database.close();
  });

  it('lists completed runs newest-first and hydrates their exact persisted evidence without reconciling again', () => {
    let scenarioLookups = 0;
    const registry: ScenarioRegistry = { find(asOfDate) { scenarioLookups += 1; return reconciliationScenarios.find(asOfDate); } };
    const { database, runs } = setup(registry);
    const first = runs.run('2026-08-15');
    const second = runs.run('2026-08-14');

    expect(runs.listCompletedRuns()).toEqual([
      { runId: second.runId, asOfDate: second.asOfDate, completedAt: second.completedAt, metrics: second.metrics, anomaly: second.anomaly },
      { runId: first.runId, asOfDate: first.asOfDate, completedAt: first.completedAt, metrics: first.metrics, anomaly: first.anomaly }
    ]);
    expect(runs.workspaceForRun(first.runId)).toEqual(first);
    expect(scenarioLookups).toBe(2);
    expect(runs.workspaceForRun('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull();
    database.close();
  });

  it('persists idempotent unmatched reviews per run without reviewing other statuses or reruns', () => {
    const { database, runs, directory } = setup();
    const first = runs.run('2026-08-15');
    const unmatched = first.results.find((result) => result.status === 'unmatched')!;
    const missing = first.results.find((result) => result.status === 'missing-from-broker')!;
    expect(first.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 1 });
    const reviewed = runs.reviewUnmatchedResult(first.runId, unmatched.id);
    expect(reviewed.results.find((result) => result.id === unmatched.id)?.reviewed).toBe(true);
    expect(reviewed.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 1 });
    expect(runs.reviewUnmatchedResult(first.runId, unmatched.id).reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 1 });
    expect(() => runs.reviewUnmatchedResult(first.runId, missing.id)).toThrow('Only unmatched results can be reviewed.');
    expect(runs.workspaceForRun(first.runId)?.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 1 });
    const rerun = runs.run('2026-08-15');
    expect(rerun.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 1 });
    database.close();
    const restoredDatabase = new SqliteDatabase({ path: path.join(directory, 'runs.sqlite') });
    const restoredRuns = new RunsService(restoredDatabase, initialSeed);
    restoredRuns.migrate(migrations);
    restoredRuns.seed();
    expect(restoredRuns.workspaceForRun(first.runId)?.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 1 });
    restoredDatabase.close();
  });

  it('backfills existing result rows as unreviewed when the review migration is applied', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-review-upgrade-'));
    directories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'upgrade.sqlite') });
    database.migrate(migrations.slice(0, 3));
    const runId = '99999999-9999-4999-8999-999999999999';
    const resultId = JSON.stringify([null, null]);
    database.db.prepare(`INSERT INTO runs (id, status, completed_at, as_of_date, total, matched, unresolved, reconciliation_rate, unresolved_rate)
      VALUES (?, 'completed', '2026-08-15T00:00:00.000Z', '2026-08-15', 1, 0, 1, 0, 1)`).run(runId);
    database.db.prepare(`INSERT INTO reconciliation_results (id, run_id, status, reason, broker_trade_id, ot_murex_trade_id)
      VALUES (?, ?, 'unmatched', 'amount-mismatch', NULL, NULL)`).run(`${runId}:${resultId}`, runId);
    database.migrate(migrations);
    expect(database.db.prepare('SELECT reviewed FROM reconciliation_results WHERE run_id = ?').get(runId)).toEqual({ reviewed: 0 });
    const runs = new RunsService(database, initialSeed);
    runs.seed();
    expect(runs.workspaceForRun(runId)).toMatchObject({ reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 1 }, results: [{ id: resultId, reviewed: false }] });
    database.close();
  });

  it('uses exactly five versioned seeded histories and excludes user runs and reruns from anomaly provenance', () => {
    const { database, runs } = setup();
    expect(database.db.prepare('SELECT count(*) AS count FROM seeded_run_history WHERE seed_version = ?').get(initialSeed.version)).toEqual({ count: 5 });
    const first = runs.run('2026-08-15');
    const second = runs.run('2026-08-15');
    expect(first.anomaly).toMatchObject({ kind: 'warning', historyCount: 5 });
    expect(first.anomaly.baselineUnresolvedRate).toBeCloseTo(.11);
    expect(second.anomaly).toEqual(first.anomaly);
    expect(database.db.prepare('SELECT count(*) AS count FROM seeded_run_history WHERE seed_version = ?').get(initialSeed.version)).toEqual({ count: 5 });
    database.close();
  });

  it('keeps a persisted run usable with calm insufficient-history context when a seeded-history row is unavailable', () => {
    const { database, runs } = setup();
    const run = runs.run('2026-08-15');
    database.db.prepare('DELETE FROM seeded_run_history WHERE seed_version = ? AND history_key = ?').run(initialSeed.version, 'history-05');
    expect(runs.latestSummary()).toMatchObject({ runId: run.runId, anomaly: { kind: 'insufficient-history', historyCount: 4, baselineUnresolvedRate: null } });
    expect(runs.workspaceForRun(run.runId)).toMatchObject({ runId: run.runId, anomaly: { kind: 'insufficient-history', historyCount: 4, baselineUnresolvedRate: null } });
    database.close();
  });

  it('keeps a persisted run usable with calm insufficient-history context when more than five rows exist', () => {
    const { database, runs } = setup();
    const run = runs.run('2026-08-15');
    database.db.prepare(`INSERT INTO seeded_run_history (seed_version, history_key, as_of_date, completed_at, total, matched, unresolved, reconciliation_rate, unresolved_rate)
      VALUES (?, 'history-06', '2026-08-13', '2026-08-13T18:00:00.000Z', 100, 90, 10, .9, .1)`).run(initialSeed.version);
    expect(runs.latestSummary()).toMatchObject({ runId: run.runId, anomaly: { kind: 'insufficient-history', historyCount: 6, baselineUnresolvedRate: null } });
    expect(runs.listCompletedRuns()).toMatchObject([{ runId: run.runId, anomaly: { kind: 'insufficient-history', historyCount: 6, baselineUnresolvedRate: null } }]);
    expect(runs.workspaceForRun(run.runId)).toMatchObject({ runId: run.runId, anomaly: { kind: 'insufficient-history', historyCount: 6, baselineUnresolvedRate: null } });
    database.close();
  });

  it('does not report failure after a durable run commits but its reload fails', () => {
    const { database, runs } = setup();
    const phases: string[] = [];
    database.workspaceForRun = () => { throw new Error('reload unavailable'); };
    expect(() => runs.run('2026-08-15', (event) => { phases.push(event.phase); })).toThrow('reload unavailable');
    expect(phases).toEqual(['started']);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 1 });
    database.close();
  });
});
