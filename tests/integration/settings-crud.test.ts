import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SqliteDatabase, type Migration } from '../../src/main/adapters/sqlite/database.js';
import { SettingsRowNotFoundError, SettingsService, SettingsValuesInvalidError } from '../../src/main/modules/settings/settings-service.js';
import { dataEnrichmentDefaults, settingsSeedVersion, sourceHeaderMappingDefaults } from '../../fixtures/settings-defaults.js';

const directories: string[] = [];
afterAll(() => { for (const directory of directories) rmSync(directory, { recursive: true, force: true }); });

const migrationFiles = [
  '001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql', '004-result-review.sql',
  '005-result-comment.sql', '006-broker-contact.sql', '007-result-mismatch-reason.sql', '008-settings-tables.sql'
];

function migrations(): Migration[] {
  return migrationFiles.map((filename, index) => ({ version: index + 1, sql: readFileSync(path.resolve('migrations', filename), 'utf8') }));
}

function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), 'reconciliation-settings-'));
  directories.push(directory);
  const database = new SqliteDatabase({ path: path.join(directory, 'settings.sqlite') });
  database.migrate(migrations());
  const settings = new SettingsService(database);
  settings.seed();
  return { database, settings };
}

describe('settings reference tables', () => {
  it('seeds both tables with their shipped defaults, in order', () => {
    const { database, settings } = setup();
    const mappings = settings.list('source-header-mapping');
    const enrichment = settings.list('data-enrichment');

    expect(mappings).toHaveLength(sourceHeaderMappingDefaults.length);
    expect(enrichment).toHaveLength(dataEnrichmentDefaults.length);
    expect(mappings.map((row) => row.values)).toEqual(sourceHeaderMappingDefaults.map((row) => row.values));
    expect(enrichment.map((row) => row.values)).toEqual(dataEnrichmentDefaults.map((row) => row.values));

    // Spot-check the two provider blocks the mapping table is built from.
    expect(mappings[0]!.values).toEqual({ provider: 'stpbroadcast@streamingedge.com', sourceField: 'COUNTERPARTY', targetField: 'BROKER', remarks: 'Tradition' });
    expect(mappings.at(-1)!.values).toEqual({ provider: 'Do_Not_Reply@bgcpartners.com', sourceField: 'MIC CODE', targetField: 'MIC', remarks: 'BGC' });
    expect(enrichment[0]!.values).toEqual({ provider: 'stpbroadcast@streamingedge.com', field: 'COUNTERPARTY', source: 'TRADITION', target: 'TRADIASI' });
    database.close();
  });

  it('does not replay the seed over an operator’s edits and deletions', () => {
    const { database, settings } = setup();
    const [first, second] = settings.list('data-enrichment');
    settings.update('data-enrichment', first!.id, { ...first!.values, target: 'TRADITION ASIA' });
    settings.remove('data-enrichment', second!.id);

    settings.seed();

    const rows = settings.list('data-enrichment');
    expect(database.hasSeed(settingsSeedVersion)).toBe(true);
    expect(rows).toHaveLength(dataEnrichmentDefaults.length - 1);
    expect(rows[0]!.values.target).toBe('TRADITION ASIA');
    database.close();
  });

  it('creates, updates, and deletes rows, answering with the reloaded table each time', () => {
    const { database, settings } = setup();
    const created = settings.create('source-header-mapping', { provider: 'ops@example.com', sourceField: 'SETTLE_CCY', targetField: 'CURRENCY', remarks: 'Example' });
    expect(created).toHaveLength(sourceHeaderMappingDefaults.length + 1);
    const added = created.at(-1)!;
    expect(added.values).toEqual({ provider: 'ops@example.com', sourceField: 'SETTLE_CCY', targetField: 'CURRENCY', remarks: 'Example' });

    const updated = settings.update('source-header-mapping', added.id, { ...added.values, targetField: 'TRADE CURRENCY' });
    expect(updated.find((row) => row.id === added.id)!.values.targetField).toBe('TRADE CURRENCY');

    const remaining = settings.remove('source-header-mapping', added.id);
    expect(remaining).toHaveLength(sourceHeaderMappingDefaults.length);
    expect(remaining.some((row) => row.id === added.id)).toBe(false);
    database.close();
  });

  it('keeps the two tables independent', () => {
    const { database, settings } = setup();
    const before = settings.list('data-enrichment').length;
    settings.create('source-header-mapping', { provider: 'ops@example.com', sourceField: 'A', targetField: 'B', remarks: 'C' });
    expect(settings.list('data-enrichment')).toHaveLength(before);
    database.close();
  });

  it('rejects blank values, foreign columns, and rows that are already gone', () => {
    const { database, settings } = setup();
    expect(() => settings.create('source-header-mapping', { provider: 'ops@example.com', sourceField: '  ', targetField: 'B', remarks: 'C' })).toThrow(SettingsValuesInvalidError);
    // The other table's shape must not be accepted for this one.
    expect(() => settings.create('source-header-mapping', { provider: 'ops@example.com', field: 'X', source: 'Y', target: 'Z' })).toThrow(SettingsValuesInvalidError);
    expect(() => settings.update('data-enrichment', 9_999, { provider: 'a', field: 'b', source: 'c', target: 'd' })).toThrow(SettingsRowNotFoundError);
    expect(() => settings.remove('data-enrichment', 9_999)).toThrow(SettingsRowNotFoundError);
    database.close();
  });

  it('trims stored values so a stray space never becomes part of a mapping', () => {
    const { database, settings } = setup();
    const rows = settings.create('data-enrichment', { provider: ' ops@example.com ', field: ' BUY/SELL ', source: ' X ', target: ' BUY ' });
    expect(rows.at(-1)!.values).toEqual({ provider: 'ops@example.com', field: 'BUY/SELL', source: 'X', target: 'BUY' });
    database.close();
  });
});
