// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteDatabase } from '../../src/main/adapters/sqlite/database.js';
import { RunsService } from '../../src/main/modules/runs/runs-service.js';
import { Dashboard } from '../../src/renderer/features/dashboard/Dashboard.js';

const temporaryDirectories: string[] = [];
const migration = { version: 1, sql: readFileSync('migrations/001-initial.sql', 'utf8') };

afterEach(() => { for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('SQLite dashboard foundation', () => {
  it('records the first seed once across relaunches and maps the latest completed summary for display', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-sqlite-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'reconciliation.sqlite');
    const first = new SqliteDatabase({ path: databasePath });
    let applies = 0;
    const fixture = { version: 'initial-v1', apply: () => { applies += 1; } };
    const firstRuns = new RunsService(first, fixture);
    firstRuns.migrate([migration]);
    firstRuns.seed();
    expect(first.db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 1 });
    expect(first.db.prepare('SELECT version FROM seed_versions').all()).toEqual([{ version: 'initial-v1' }]);
    first.db.prepare(`INSERT INTO runs (id, status, completed_at, total, matched, unresolved, reconciliation_rate)
      VALUES (?, 'completed', ?, ?, ?, ?, ?), (?, 'completed', ?, ?, ?, ?, ?)`)
      .run('11111111-1111-4111-8111-111111111111', '2026-08-15T00:00:00.000Z', 8, 7, 1, .875,
        '22222222-2222-4222-8222-222222222222', '2026-08-15T00:00:00.000Z', 12, 10, 2, .833333333333);
    expect(firstRuns.latestSummary()).toMatchObject({ runId: '22222222-2222-4222-8222-222222222222', total: 12, matched: 10, unresolved: 2 });
    first.close();

    const relaunched = new SqliteDatabase({ path: databasePath });
    const relaunchedRuns = new RunsService(relaunched, fixture);
    relaunchedRuns.migrate([migration]);
    relaunchedRuns.seed();
    expect(applies).toBe(1);
    const summary = relaunchedRuns.latestSummary();
    render(<Dashboard api={{ get: async () => ({ ok: true, data: { summary } }) }} />);
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    relaunched.close();
  });
});
