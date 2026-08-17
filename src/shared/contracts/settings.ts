import { z } from 'zod';
import { result } from './result.js';

/**
 * Editable reference tables behind the reconciliation run. Each table is described once
 * here and both sides read that description: the renderer builds its columns and form
 * from it, and main validates every submitted row against it. Adding a table is a change
 * to this list plus its physical mapping in the SQLite adapter — no new UI or handlers.
 */
export const settingsTableIds = ['source-header-mapping', 'data-enrichment', 'email-group', 'auto-validation'] as const;
export const SettingsTableIdSchema = z.enum(settingsTableIds);
export type SettingsTableId = z.infer<typeof SettingsTableIdSchema>;

export interface SettingsColumnDefinition {
  readonly id: string;
  readonly label: string;
  /** Blank is a real value for this column, so it is not required on save. */
  readonly optional?: boolean;
  /** Long free text — recipient lists and criteria — gets a textarea rather than a single line. */
  readonly multiline?: boolean;
}
export interface SettingsTableDefinition {
  readonly id: SettingsTableId;
  readonly label: string;
  readonly description: string;
  readonly columns: readonly SettingsColumnDefinition[];
}

export const settingsTableDefinitions: readonly SettingsTableDefinition[] = [
  {
    id: 'source-header-mapping',
    label: 'Source_Header_Mapping',
    description: 'Maps each provider’s incoming column headers onto the canonical trade fields.',
    columns: [
      { id: 'provider', label: 'Provider' },
      { id: 'sourceField', label: 'SourceField' },
      { id: 'targetField', label: 'TargetField' },
      { id: 'remarks', label: 'Remarks' }
    ]
  },
  {
    id: 'data-enrichment',
    label: 'Data_Enrichment',
    description: 'Rewrites incoming values onto the values the reconciliation engine expects.',
    columns: [
      { id: 'provider', label: 'Provider' },
      { id: 'field', label: 'Field' },
      { id: 'source', label: 'Source' },
      { id: 'target', label: 'Target' }
    ]
  },
  {
    id: 'email-group',
    label: 'Email_Group',
    description: 'Recipients used when a broker follow-up is addressed to a desk rather than one contact.',
    columns: [
      { id: 'groupName', label: 'Email Group Name' },
      { id: 'to', label: 'To', multiline: true },
      // A group can legitimately have nobody on copy.
      { id: 'cc', label: 'CC', optional: true, multiline: true },
      { id: 'remarks', label: 'Remarks', optional: true, multiline: true }
    ]
  },
  {
    id: 'auto-validation',
    label: 'Auto_Validation',
    description: 'Criteria that let a broker\u2019s trades be validated without manual review.',
    columns: [
      { id: 'broker', label: 'Broker' },
      { id: 'criteria', label: 'Criteria', multiline: true },
      { id: 'remarks', label: 'Remarks', optional: true },
      { id: 'validated', label: 'Validated' }
    ]
  }
];

export function settingsTableDefinition(id: SettingsTableId): SettingsTableDefinition {
  const definition = settingsTableDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown settings table: ${id}`);
  return definition;
}

/** Values are free text: these tables describe other systems' vocabulary, not ours. The
    ceiling is generous because a recipient list is one value holding many addresses. */
export const SettingsValueSchema = z.string().max(1_000);
export const SettingsValuesSchema = z.record(z.string(), SettingsValueSchema);
export const SettingsRowSchema = z.object({ id: z.number().int().positive(), values: SettingsValuesSchema }).readonly();

export const SettingsListRequestSchema = z.object({ version: z.literal(1), table: SettingsTableIdSchema }).strict();
export const SettingsCreateRequestSchema = z.object({ version: z.literal(1), table: SettingsTableIdSchema, values: SettingsValuesSchema }).strict();
export const SettingsUpdateRequestSchema = z.object({ version: z.literal(1), table: SettingsTableIdSchema, id: z.number().int().positive(), values: SettingsValuesSchema }).strict();
export const SettingsDeleteRequestSchema = z.object({ version: z.literal(1), table: SettingsTableIdSchema, id: z.number().int().positive() }).strict();

/** Every mutation answers with the reloaded table, so the renderer never guesses state. */
export const SettingsRowsResultSchema = result(z.object({ table: SettingsTableIdSchema, rows: z.array(SettingsRowSchema).readonly() }).readonly());

export const SettingsChannels = {
  list: 'settings.list.v1',
  create: 'settings.create.v1',
  update: 'settings.update.v1',
  remove: 'settings.delete.v1'
} as const;

export type SettingsRow = z.infer<typeof SettingsRowSchema>;
export type SettingsValues = z.infer<typeof SettingsValuesSchema>;
export type SettingsRowsResult = z.infer<typeof SettingsRowsResultSchema>;
