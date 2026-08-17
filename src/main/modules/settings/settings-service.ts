import { settingsSeedBatches } from '../../../../fixtures/settings-defaults.js';
import { settingsTableDefinition, type SettingsRow, type SettingsTableId, type SettingsValues } from '../../../shared/contracts/settings.js';
import type { SqliteDatabase } from '../../adapters/sqlite/database.js';

export class SettingsRowNotFoundError extends Error {
  readonly code = 'SETTINGS_ROW_NOT_FOUND';
  constructor() { super('This settings row is no longer available.'); }
}

export class SettingsValuesInvalidError extends Error {
  readonly code = 'INVALID_REQUEST';
  constructor(message: string) { super(message); }
}

/**
 * Owns the editable reference tables. Every mutation revalidates the submitted columns
 * against the table definition and answers with the reloaded table, so the renderer's
 * form state is never the authority for what is stored.
 */
export class SettingsService {
  constructor(private readonly database: SqliteDatabase) {}

  /**
   * Applied once per batch version, so edits and deletions are never overwritten and a
   * database seeded before a batch existed still receives that batch on the next launch.
   */
  seed(): void {
    this.database.transaction(() => {
      for (const batch of settingsSeedBatches) {
        if (this.database.hasSeed(batch.version)) continue;
        for (const [table, rows] of Object.entries(batch.tables)) {
          for (const row of rows) this.database.createSettingsRow(table as SettingsTableId, row.values);
        }
        this.database.recordSeed(batch.version);
      }
    });
  }

  list(table: SettingsTableId): readonly SettingsRow[] {
    return this.database.listSettingsRows(table);
  }

  create(table: SettingsTableId, values: SettingsValues): readonly SettingsRow[] {
    this.database.createSettingsRow(table, this.validated(table, values));
    return this.list(table);
  }

  update(table: SettingsTableId, id: number, values: SettingsValues): readonly SettingsRow[] {
    if (!this.database.updateSettingsRow(table, id, this.validated(table, values))) throw new SettingsRowNotFoundError();
    return this.list(table);
  }

  remove(table: SettingsTableId, id: number): readonly SettingsRow[] {
    if (!this.database.deleteSettingsRow(table, id)) throw new SettingsRowNotFoundError();
    return this.list(table);
  }

  /**
   * Keeps exactly the table's own columns. An unknown key is rejected rather than
   * dropped, so a renderer sending the wrong table's shape fails loudly.
   */
  private validated(table: SettingsTableId, values: SettingsValues): SettingsValues {
    const definition = settingsTableDefinition(table);
    const allowed = new Set(definition.columns.map((column) => column.id));
    const unknown = Object.keys(values).filter((key) => !allowed.has(key));
    if (unknown.length > 0) throw new SettingsValuesInvalidError(`Unknown ${definition.label} column: ${unknown.join(', ')}.`);
    // Optional columns are stored empty rather than refused; a group with nobody on copy is real.
    const missing = definition.columns.filter((column) => !column.optional && (values[column.id] ?? '').trim() === '');
    if (missing.length > 0) throw new SettingsValuesInvalidError(`${missing.map((column) => column.label).join(', ')} cannot be empty.`);
    return Object.fromEntries(definition.columns.map((column) => [column.id, (values[column.id] ?? '').trim()]));
  }
}
