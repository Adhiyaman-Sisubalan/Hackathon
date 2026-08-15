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
const migrations = [1, 2].map((version) => ({ version, sql: readFileSync(`migrations/00${version}-${version === 1 ? 'initial' : 'runs-and-results'}.sql`, 'utf8') }));
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function setup(registry: ScenarioRegistry = reconciliationScenarios) {
  const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-runs-'));
  directories.push(directory);
  const database = new SqliteDatabase({ path: path.join(directory, 'runs.sqlite') });
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  const runs = new RunsService(database, initialSeed, { clock: { now: () => '2026-08-15T12:00:00.000Z' }, ids: { next: () => ids.shift()! }, scenarios: registry });
  runs.migrate(migrations);
  return { database, runs };
}

describe('persisted reconciliation runs', () => {
  it('supports every seeded date and does not let an observing progress listener affect a committed run', () => {
    const { database, runs } = setup();
    const thirteenth = runs.run('2026-08-13', () => { throw new Error('renderer closed'); });
    const fourteenth = runs.run('2026-08-14');
    expect(thirteenth.metrics).toEqual({ total: 1, matched: 1, unresolved: 0, reconciliationRate: 1 });
    expect(fourteenth.results.map((result) => result.status)).toEqual(['unmatched', 'missing-from-ot-murex']);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 2 });
    database.close();
  });

  it('persists a deterministic full aggregate, produces all statuses, and preserves reruns', () => {
    const { database, runs } = setup();
    const first = runs.run('2026-08-15');
    const second = runs.run('2026-08-15');
    expect(first.metrics).toEqual({ total: 6, matched: 2, unresolved: 4, reconciliationRate: 1 / 3 });
    expect(first.results.map((result) => result.status)).toEqual(['matched', 'unmatched', 'matched', 'missing-from-ot-murex', 'missing-from-ot-murex', 'missing-from-broker']);
    expect(second.runId).not.toBe(first.runId);
    expect(database.db.prepare('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT count(*) AS count FROM source_trades WHERE run_id = ?').get(first.runId)).toEqual({ count: 9 });
    expect(database.db.prepare('SELECT count(*) AS count FROM reconciliation_results WHERE run_id = ?').get(first.runId)).toEqual({ count: 6 });
    expect(runs.latestSummary()).toMatchObject({ runId: second.runId, total: 6, matched: 2, unresolved: 4 });
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

  it('upgrades a v1 database without altering its existing run and assigns its deterministic default as-of date', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-upgrade-'));
    directories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'upgrade.sqlite') });
    database.migrate([migrations[0]!]);
    database.db.prepare(`INSERT INTO runs (id, status, completed_at, total, matched, unresolved, reconciliation_rate) VALUES (?, 'completed', ?, 1, 1, 0, 1)`)
      .run('99999999-9999-4999-8999-999999999999', '2026-08-15T00:00:00.000Z');
    database.migrate(migrations);
    expect(database.db.prepare('SELECT id, as_of_date AS asOfDate, total FROM runs').get()).toEqual({ id: '99999999-9999-4999-8999-999999999999', asOfDate: '2026-08-15', total: 1 });
    expect(database.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
    database.close();
  });
});
