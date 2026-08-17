import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reconciliationScenarios } from '../../fixtures/reconciliation-scenarios.js';
import { initialSeed } from '../../fixtures/initial-seed.js';
import { SqliteDatabase } from '../../src/main/adapters/sqlite/database.js';
import { reconciliationBootstrapConfig } from '../../src/main/bootstrap/reconciliation-config.js';
import { DuplicateTradeIdError } from '../../src/domain/reconciliation/reconciliation.js';
import { BrokerPreviewNotEligibleError, RunsService, ResultCommentNotEligibleError, UnsupportedDateError, type ScenarioRegistry } from '../../src/main/modules/runs/runs-service.js';
import { createReportWorker, type ReportWorker } from '../../src/main/workers/report-worker-client.js';

const directories: string[] = [];
const migrationNames = ['001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql', '004-result-review.sql', '005-result-comment.sql', '006-broker-contact.sql', '007-result-mismatch-reason.sql'];
const migrations = migrationNames.map((filename, index) => ({ version: index + 1, sql: readFileSync(`migrations/${filename}`, 'utf8') }));
const reportSheetNames = ['Summary', 'Matched', 'Unmatched', 'Missing from Broker', 'Missing from OT-MUREX'] as const;
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
  it('rejects a report worker that exits cleanly without a valid receipt', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-worker-'));
    directories.push(directory);
    const workerPath = path.join(directory, 'no-receipt.cjs');
    writeFileSync(workerPath, "process.exit(0);\n");
    await expect(createReportWorker(workerPath).generate({} as never, path.join(directory, 'report.tmp.xlsx'))).rejects.toThrow('exited without a valid receipt');
  });

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
    expect(first.results.map((result) => result.status)).toEqual(['matched', 'unmatched', 'matched', 'missing-from-ot-murex', 'unmatched', 'missing-from-broker']);
    expect(second.runId).not.toBe(first.runId);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT count(*) AS count FROM source_trades WHERE run_id = ?').get(first.runId)).toEqual({ count: 10 });
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
    expect(database.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 7 });
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
      { runId: second.runId, asOfDate: second.asOfDate, completedAt: second.completedAt, metrics: second.metrics, statusCounts: second.statusCounts, reviewProgress: second.reviewProgress, anomaly: second.anomaly },
      { runId: first.runId, asOfDate: first.asOfDate, completedAt: first.completedAt, metrics: first.metrics, statusCounts: first.statusCounts, reviewProgress: first.reviewProgress, anomaly: first.anomaly }
    ]);
    // The listed progress is counted in SQL and must agree with the workspace snapshot.
    expect(first.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 2 });
    // The listed breakdown is counted in SQL; it must agree with the persisted Results.
    expect(second.statusCounts).toEqual({ matched: 0, unmatched: 1, 'missing-from-broker': 0, 'missing-from-ot-murex': 1 });
    expect(first.statusCounts).toEqual({ matched: 2, unmatched: 2, 'missing-from-broker': 1, 'missing-from-ot-murex': 1 });
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
    expect(first.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 2 });
    const reviewed = runs.reviewUnmatchedResult(first.runId, unmatched.id);
    expect(reviewed.results.find((result) => result.id === unmatched.id)?.reviewed).toBe(true);
    expect(reviewed.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 2 });
    expect(runs.reviewUnmatchedResult(first.runId, unmatched.id).reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 2 });
    expect(() => runs.reviewUnmatchedResult(first.runId, missing.id)).toThrow('Only unmatched results can be reviewed.');
    expect(runs.workspaceForRun(first.runId)?.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 2 });
    const rerun = runs.run('2026-08-15');
    expect(rerun.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 2 });
    database.close();
    const restoredDatabase = new SqliteDatabase({ path: path.join(directory, 'runs.sqlite') });
    const restoredRuns = new RunsService(restoredDatabase, initialSeed);
    restoredRuns.migrate(migrations);
    restoredRuns.seed();
    expect(restoredRuns.workspaceForRun(first.runId)?.reviewProgress).toEqual({ reviewedUnmatched: 1, totalUnmatched: 2 });
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

  it('persists idempotent unresolved comments per run and restores them without copying to reruns', () => {
    const { database, runs, directory } = setup();
    const first = runs.run('2026-08-15');
    const unmatched = first.results.find((result) => result.status === 'unmatched')!;
    const missing = first.results.find((result) => result.status === 'missing-from-broker')!;
    const missingOtMurex = first.results.find((result) => result.status === 'missing-from-ot-murex')!;
    const matched = first.results.find((result) => result.status === 'matched')!;

    const saved = runs.saveResultComment(first.runId, unmatched.id, 'Confirm broker allocation.');
    expect(saved.results.find((result) => result.id === unmatched.id)?.comment).toBe('Confirm broker allocation.');
    expect(runs.saveResultComment(first.runId, unmatched.id, 'Confirm broker allocation.').results.find((result) => result.id === unmatched.id)?.comment).toBe('Confirm broker allocation.');
    expect(runs.saveResultComment(first.runId, unmatched.id, '').results.find((result) => result.id === unmatched.id)?.comment).toBeNull();
    expect(runs.saveResultComment(first.runId, unmatched.id, 'Confirm broker allocation.').results.find((result) => result.id === unmatched.id)?.comment).toBe('Confirm broker allocation.');
    expect(runs.saveResultComment(first.runId, missing.id, 'Request missing broker trade.').results.find((result) => result.id === missing.id)?.comment).toBe('Request missing broker trade.');
    expect(runs.saveResultComment(first.runId, missingOtMurex.id, 'Request missing OT/MUREX trade.').results.find((result) => result.id === missingOtMurex.id)?.comment).toBe('Request missing OT/MUREX trade.');
    expect(() => runs.saveResultComment(first.runId, matched.id, 'Not permitted.')).toThrow(ResultCommentNotEligibleError);
    expect(database.db.prepare('SELECT count(*) AS count FROM reconciliation_results WHERE run_id = ?').get(first.runId)).toEqual({ count: 6 });

    const rerun = runs.run('2026-08-15');
    expect(rerun.results.find((result) => result.id === unmatched.id)?.comment).toBeNull();
    expect(rerun.results.find((result) => result.id === missingOtMurex.id)?.comment).toBeNull();
    database.close();

    const restoredDatabase = new SqliteDatabase({ path: path.join(directory, 'runs.sqlite') });
    const restoredRuns = new RunsService(restoredDatabase, initialSeed);
    restoredRuns.migrate(migrations);
    restoredRuns.seed();
    expect(restoredRuns.workspaceForRun(first.runId)?.results.find((result) => result.id === unmatched.id)?.comment).toBe('Confirm broker allocation.');
    expect(restoredRuns.workspaceForRun(first.runId)?.results.find((result) => result.id === missing.id)?.comment).toBe('Request missing broker trade.');
    expect(restoredRuns.workspaceForRun(first.runId)?.results.find((result) => result.id === missingOtMurex.id)?.comment).toBe('Request missing OT/MUREX trade.');
    restoredDatabase.close();
  });

  it('authoritatively builds an exact broker-scoped Draft from persisted comments', () => {
    const { database, runs } = setup();
    const run = runs.run('2026-08-15');
    const atlasRows = run.results.filter((result) => result.status === 'unmatched' && result.brokerTrade?.brokerContact?.name === 'Atlas Securities');
    expect(atlasRows).toHaveLength(2);
    runs.saveResultComment(run.runId, atlasRows[0]!.id, 'Confirm booking date.');
    runs.saveResultComment(run.runId, atlasRows[1]!.id, 'Confirm amount.');
    const draft = runs.previewBrokerEmail(run.runId, atlasRows[0]!.id);
    expect(draft).toMatchObject({ status: 'Draft', recipient: 'operations@atlas-securities.example', subject: 'Follow-up: unmatched trades for Atlas Securities' });
    expect(draft.body).toContain('Please review the unmatched trades');
    expect(draft.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ tradeId: 'BRK-202', comment: 'Confirm booking date.' }),
      expect.objectContaining({ tradeId: 'BRK-203', comment: 'Confirm amount.' })
    ]));
    expect(draft.rows).toHaveLength(2);
    expect(new Set(draft.rows.map((row) => row.tradeId)).size).toBe(2);
    expect(draft.rows.some((row) => row.tradeId === 'BRK-Z')).toBe(false);
    const missing = run.results.find((result) => result.status === 'missing-from-ot-murex')!;
    expect(() => runs.previewBrokerEmail(run.runId, missing.id)).toThrow(BrokerPreviewNotEligibleError);
    expect(() => runs.previewBrokerEmail(run.runId, 'stale')).toThrow('This result is no longer available.');
    database.close();
  });

  it('backfills existing result comments to null when the comment migration is applied', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-comment-upgrade-'));
    directories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'upgrade.sqlite') });
    database.migrate(migrations.slice(0, 4));
    const runId = '99999999-9999-4999-8999-999999999999';
    const resultId = JSON.stringify([null, null]);
    database.db.prepare(`INSERT INTO runs (id, status, completed_at, as_of_date, total, matched, unresolved, reconciliation_rate, unresolved_rate)
      VALUES (?, 'completed', '2026-08-15T00:00:00.000Z', '2026-08-15', 1, 0, 1, 0, 1)`).run(runId);
    database.db.prepare(`INSERT INTO reconciliation_results (id, run_id, status, reason, broker_trade_id, ot_murex_trade_id, reviewed)
      VALUES (?, ?, 'unmatched', 'amount-mismatch', NULL, NULL, 0)`).run(`${runId}:${resultId}`, runId);
    database.migrate(migrations);
    expect(database.db.prepare('SELECT comment FROM reconciliation_results WHERE run_id = ?').get(runId)).toEqual({ comment: null });
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

  it('builds a frozen report snapshot only after every unmatched result is reviewed', () => {
    const { database, runs } = setup();
    const run = runs.run('2026-08-15');
    const first = database.prepareVerifiedReport(run.runId, initialSeed.version, reconciliationBootstrapConfig.anomalyThresholds);
    expect(first).toEqual({ kind: 'ineligible', outstanding: 2 });
    for (const result of run.results.filter((item) => item.status === 'unmatched')) runs.reviewUnmatchedResult(run.runId, result.id);
    const prepared = database.prepareVerifiedReport(run.runId, initialSeed.version, reconciliationBootstrapConfig.anomalyThresholds);
    if (prepared === 'not-found' || ('kind' in prepared)) throw new Error('Expected report snapshot.');
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(prepared.results.map((result) => result.status)).toEqual(run.results.map((result) => result.status));
    expect(prepared.reviewProgress).toEqual({ reviewedUnmatched: 2, totalUnmatched: 2 });
    database.close();
  });

  it('refuses an unreviewed Run before handing data to the worker', async () => {
    const { database, runs, directory } = setup();
    const run = runs.run('2026-08-15');
    const worker: ReportWorker = { generate: async () => { throw new Error('The worker must not be called.'); } };
    const reporting = new RunsService(database, initialSeed, {
      clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => 'report-operation' }, scenarios: reconciliationScenarios,
      reports: { outputDirectory: path.join(directory, 'mock-output'), worker }
    });
    await expect(reporting.saveVerifiedReport(run.runId)).rejects.toMatchObject({ code: 'REPORT_INELIGIBLE', outstanding: 2 });
    expect(existsSync(path.join(directory, 'mock-output'))).toBe(false);
    database.close();
  });

  it('publishes a collision-safe verified report without changing the investigated Run', async () => {
    const { database, runs, directory } = setup();
    const run = runs.run('2026-08-15');
    const unmatched = run.results.filter((result) => result.status === 'unmatched');
    runs.saveResultComment(run.runId, unmatched[0]!.id, 'Persisted investigation note.');
    for (const result of unmatched) runs.reviewUnmatchedResult(run.runId, result.id);
    const before = runs.workspaceForRun(run.runId);
    const outputDirectory = path.join(directory, 'mock-output');
    const base = `reconciliation-${run.asOfDate}-${run.runId}`;
    const existing = path.join(outputDirectory, `${base}.xlsx`);
    const seen: unknown[] = [];
    const worker: ReportWorker = { generate: async (snapshot, temporaryPath) => {
      seen.push(snapshot);
      writeFileSync(temporaryPath, 'validated workbook');
      return { temporaryPath, sheetNames: reportSheetNames };
    } };
    const reporting = new RunsService(database, initialSeed, {
      clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => 'report-operation' }, scenarios: reconciliationScenarios,
      reports: { outputDirectory, worker }
    });
    // The existing report is a protected final artifact; publication must choose a suffix.
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(existing, 'existing final report');
    const destination = await reporting.saveVerifiedReport(run.runId);
    expect(destination).toBe(path.join(outputDirectory, `${base}-1.xlsx`));
    expect(readFileSync(existing, 'utf8')).toBe('existing final report');
    expect(readFileSync(destination, 'utf8')).toBe('validated workbook');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      reviewProgress: { reviewedUnmatched: 2, totalUnmatched: 2 },
      results: expect.arrayContaining([expect.objectContaining({ comment: 'Persisted investigation note.' })])
    });
    expect(runs.workspaceForRun(run.runId)).toEqual(before);
    expect(existsSync(path.join(outputDirectory, `.${base}-report-operation.tmp.xlsx`))).toBe(false);
    database.close();
  });

  it('cleans up only its temporary report artifact when worker generation fails', async () => {
    const { database, runs, directory } = setup();
    const run = runs.run('2026-08-15');
    for (const result of run.results.filter((item) => item.status === 'unmatched')) runs.reviewUnmatchedResult(run.runId, result.id);
    const before = runs.workspaceForRun(run.runId);
    const outputDirectory = path.join(directory, 'mock-output');
    const worker: ReportWorker = { generate: async (_snapshot, temporaryPath) => {
      writeFileSync(temporaryPath, 'partial workbook');
      throw new Error('reopen validation failed');
    } };
    const reporting = new RunsService(database, initialSeed, {
      clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => 'report-operation' }, scenarios: reconciliationScenarios,
      reports: { outputDirectory, worker }
    });
    await expect(reporting.saveVerifiedReport(run.runId)).rejects.toThrow('reopen validation failed');
    expect(existsSync(path.join(outputDirectory, `.${`reconciliation-${run.asOfDate}-${run.runId}`}-report-operation.tmp.xlsx`))).toBe(false);
    expect(runs.workspaceForRun(run.runId)).toEqual(before);
    database.close();
  });

  it('publishes a zero-unmatched Run without requiring any review', async () => {
    const { database, runs, directory } = setup();
    const run = runs.run('2026-08-13');
    expect(run.reviewProgress).toEqual({ reviewedUnmatched: 0, totalUnmatched: 0 });
    const outputDirectory = path.join(directory, 'mock-output');
    const worker: ReportWorker = { generate: async (_snapshot, temporaryPath) => {
      writeFileSync(temporaryPath, 'validated zero-unmatched workbook');
      return { temporaryPath, sheetNames: reportSheetNames };
    } };
    const reporting = new RunsService(database, initialSeed, {
      clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => 'report-operation' }, scenarios: reconciliationScenarios,
      reports: { outputDirectory, worker }
    });
    await expect(reporting.saveVerifiedReport(run.runId)).resolves.toBe(path.join(outputDirectory, `reconciliation-${run.asOfDate}-${run.runId}.xlsx`));
    database.close();
  });

  it('rejects malformed worker receipts and missing or empty temporary files without changing the Run', async () => {
    const { database, runs, directory } = setup();
    const run = runs.run('2026-08-15');
    for (const result of run.results.filter((item) => item.status === 'unmatched')) runs.reviewUnmatchedResult(run.runId, result.id);
    const before = runs.workspaceForRun(run.runId);
    const cases: ReadonlyArray<readonly [string, ReportWorker]> = [
      ['malformed', { generate: async (_snapshot, temporaryPath) => {
        writeFileSync(temporaryPath, 'partial workbook');
        return { temporaryPath, sheetNames: ['Summary', 'Wrong', 'Unmatched', 'Missing from Broker', 'Missing from OT-MUREX'] } as never;
      } }],
      ['missing', { generate: async (_snapshot, temporaryPath) => ({ temporaryPath, sheetNames: reportSheetNames }) }],
      ['empty', { generate: async (_snapshot, temporaryPath) => {
        writeFileSync(temporaryPath, '');
        return { temporaryPath, sheetNames: reportSheetNames };
      } }]
    ];
    for (const [name, worker] of cases) {
      const outputDirectory = path.join(directory, `mock-output-${name}`);
      const reporting = new RunsService(database, initialSeed, {
        clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => 'report-operation' }, scenarios: reconciliationScenarios,
        reports: { outputDirectory, worker }
      });
      await expect(reporting.saveVerifiedReport(run.runId)).rejects.toThrow();
      expect(existsSync(path.join(outputDirectory, `.${`reconciliation-${run.asOfDate}-${run.runId}`}-report-operation.tmp.xlsx`))).toBe(false);
      expect(runs.workspaceForRun(run.runId)).toEqual(before);
    }
    database.close();
  });
});
