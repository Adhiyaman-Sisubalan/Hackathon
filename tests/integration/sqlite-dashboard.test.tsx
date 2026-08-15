// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { initialSeed } from '../../fixtures/initial-seed.js';
import { reconciliationScenarios } from '../../fixtures/reconciliation-scenarios.js';
import { SqliteDatabase } from '../../src/main/adapters/sqlite/database.js';
import { RunsService } from '../../src/main/modules/runs/runs-service.js';
import { Dashboard } from '../../src/renderer/features/dashboard/Dashboard.js';
import { Results } from '../../src/renderer/features/results/Results.js';

const temporaryDirectories: string[] = [];
const migrations = ['001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql'].map((filename, index) => ({ version: index + 1, sql: readFileSync(`migrations/${filename}`, 'utf8') }));

afterEach(() => { cleanup(); for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('SQLite dashboard foundation', () => {
  it('records the first seed once across relaunches and maps the latest completed summary for display', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-sqlite-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'reconciliation.sqlite');
    const first = new SqliteDatabase({ path: databasePath });
    let applies = 0;
    const fixture = { version: 'initial-v1', apply: () => { applies += 1; } };
    const firstRuns = new RunsService(first, fixture);
    firstRuns.migrate(migrations);
    firstRuns.seed();
    expect(first.db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 3 });
    expect(first.db.prepare('SELECT version FROM seed_versions').all()).toEqual([{ version: 'initial-v1' }]);
    first.db.prepare(`INSERT INTO runs (id, status, completed_at, as_of_date, total, matched, unresolved, reconciliation_rate, unresolved_rate)
      VALUES (?, 'completed', ?, '2026-08-15', ?, ?, ?, ?, ?), (?, 'completed', ?, '2026-08-15', ?, ?, ?, ?, ?)`)
      .run('11111111-1111-4111-8111-111111111111', '2026-08-15T00:00:00.000Z', 8, 7, 1, .875, .125,
        '22222222-2222-4222-8222-222222222222', '2026-08-15T00:00:00.000Z', 12, 10, 2, .833333333333, .166666666667);
    expect(firstRuns.latestSummary()).toMatchObject({ runId: '22222222-2222-4222-8222-222222222222', metrics: { total: 12, matched: 10, unresolved: 2 } });
    first.close();

    const relaunched = new SqliteDatabase({ path: databasePath });
    const relaunchedRuns = new RunsService(relaunched, fixture);
    relaunchedRuns.migrate(migrations);
    relaunchedRuns.seed();
    expect(applies).toBe(1);
    const summary = relaunchedRuns.latestSummary();
    render(<Dashboard api={{ get: async () => ({ ok: true, data: { summary } }) }} />);
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    relaunched.close();
  });

  it('presents the same persisted summary and anomaly snapshot on Dashboard and Results', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-summary-surfaces-'));
    temporaryDirectories.push(directory);
    const database = new SqliteDatabase({ path: path.join(directory, 'reconciliation.sqlite') });
    const runs = new RunsService(database, initialSeed, {
      clock: { now: () => '2026-08-15T12:00:00.000Z' },
      ids: { next: () => '11111111-1111-4111-8111-111111111111' },
      scenarios: reconciliationScenarios
    });
    runs.migrate(migrations);
    runs.seed();
    const workspace = runs.run('2026-08-15');
    const summary = runs.latestSummary();
    expect(summary).toEqual({ runId: workspace.runId, asOfDate: workspace.asOfDate, completedAt: workspace.completedAt, metrics: workspace.metrics, anomaly: workspace.anomaly });

    render(<><Dashboard api={{ get: async () => ({ ok: true, data: { summary } }) }} /><Results workspace={workspace} /></>);
    await waitFor(() => expect(screen.getAllByLabelText('Reconciliation summary')).toHaveLength(2));
    expect(screen.getAllByText('33.3%', { exact: true })).toHaveLength(2);
    expect(screen.getAllByText('66.7%', { exact: true })).toHaveLength(2);
    const warnings = screen.getAllByRole('status').filter((element) => element.textContent?.includes('Unresolved rate is higher than the seeded baseline.'));
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) => warning.textContent?.includes('Current 66.7%; five-run baseline 11.0%'))).toBe(true);
    database.close();
  });
});
