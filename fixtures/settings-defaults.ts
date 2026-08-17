/**
 * Shipped defaults for the editable settings tables, kept free of any main-process
 * imports so the SQLite seed and the browser preview load identical rows.
 *
 * These are starting values, not constants: the Settings screen can edit or delete any
 * row, and each batch is applied once under its own version, so user changes are never
 * overwritten and a database seeded before a batch existed still receives it.
 */

const TRADITION = 'stpbroadcast@streamingedge.com';
const BGC = 'Do_Not_Reply@bgcpartners.com';

export interface SettingsDefaultRow { readonly values: Readonly<Record<string, string>>; }

function mapping(provider: string, sourceField: string, targetField: string, remarks: string): SettingsDefaultRow {
  return { values: { provider, sourceField, targetField, remarks } };
}

function enrichment(provider: string, field: string, source: string, target: string): SettingsDefaultRow {
  return { values: { provider, field, source, target } };
}

export const sourceHeaderMappingDefaults: readonly SettingsDefaultRow[] = [
  mapping(TRADITION, 'COUNTERPARTY', 'BROKER', 'Tradition'),
  mapping(TRADITION, 'ISIN', 'ISIN', 'Tradition'),
  mapping(TRADITION, 'INST_DESC', 'ISSUER', 'Tradition'),
  mapping(TRADITION, 'BUY/SELL', 'BUY/SELL', 'Tradition'),
  mapping(TRADITION, 'NOTIONAL', 'NOTIONAL', 'Tradition'),
  mapping(TRADITION, 'TRADE_CURRENCY', 'CURRENCY', 'Tradition'),
  mapping(TRADITION, 'CA-CIB TRADER', 'CACIB TRADER', 'Tradition'),
  mapping(TRADITION, 'VALUE_DATE', 'VALUE DATE', 'Tradition'),
  mapping(TRADITION, 'CLEAN_PRICE', 'CLEAN PRICE', 'Tradition'),
  mapping(TRADITION, 'NET_SETTLEMENT_AMT', 'SETTLEMENT', 'Tradition'),
  mapping(TRADITION, 'TRADE_DATE', 'TRADE DATE', 'Tradition'),
  mapping(BGC, 'COUNTERPARTY', 'BROKER', 'BGC'),
  mapping(BGC, 'ISIN', 'ISIN', 'BGC'),
  mapping(BGC, 'ISSUER, COUPON, MATURITY', 'ISSUER', 'BGC'),
  mapping(BGC, 'BUY/SELL', 'BUY/SELL', 'BGC'),
  mapping(BGC, 'NOTIONAL', 'NOTIONAL', 'BGC'),
  mapping(BGC, 'CURRENCY', 'CURRENCY', 'BGC'),
  mapping(BGC, 'CA-CIB TRADER', 'CACIB TRADER', 'BGC'),
  mapping(BGC, 'VALUE_DATE', 'VALUE DATE', 'BGC'),
  mapping(BGC, 'CLEAN_PRICE', 'CLEAN PRICE', 'BGC'),
  mapping(BGC, 'NET SETTLEMENT AMT', 'SETTLEMENT', 'BGC'),
  mapping(BGC, 'TRADE_DATE', 'TRADE DATE', 'BGC'),
  mapping(BGC, 'MIC CODE', 'MIC', 'BGC')
];

export const dataEnrichmentDefaults: readonly SettingsDefaultRow[] = [
  enrichment(TRADITION, 'COUNTERPARTY', 'TRADITION', 'TRADIASI'),
  enrichment(TRADITION, 'BUY/SELL', 'S', 'SELL'),
  enrichment(TRADITION, 'BUY/SELL', 'B', 'BUY')
];

export const emailGroupDefaults: readonly SettingsDefaultRow[] = [
  {
    values: {
      groupName: 'GFI / BGC / MINTPARTNERS',
      to: 'BondsDomestic@bgcpartners.com; MoneyMarket@bgcg.com; euroclearsettlements@bgcpartners.com; Support-PrincipalBondHK@bgcpartners.com; BGCFedWireSettlements@bgcpartners.com; BackOfficeOPS@bgcpartners.com; bondssupport2@aurel-bgc.com',
      cc: 'queries@mintpartners.com; Bondssupport2@aurel-bgc.com; moegbs@aurel-bgc.com; Euroclear_Settlements@GFIgroup.co.uk',
      remarks: '(0207 422 1176 or 0207 422 1354)'
    }
  },
  {
    values: {
      groupName: 'ICAP / GARSEC',
      to: 'unmatchedsetts@tpicap.com; Zowie.Coxedge@tpicap.com; TradeSupport@us.icap.com;',
      // This group is addressed without anyone on copy.
      cc: '',
      remarks: '(Escalation: Michael.Ball@tpicap.com; OpsBusinessPartnersEMEA@tpicap.com)'
    }
  }
];

export const autoValidationDefaults: readonly SettingsDefaultRow[] = [
  { values: { broker: 'BGC', criteria: 'CACIB_TRADER in (ELIAS,ARAS, DARASY KOL)', remarks: 'Not MO CDT trader', validated: 'Yes' } }
];

/**
 * Seeding is batched by version rather than by table: an installation that already
 * recorded an earlier batch keeps its edits and still receives the later batches.
 * Never re-point an existing version at different rows — add a new batch instead.
 */
export const settingsSeedBatches: readonly { readonly version: string; readonly tables: Readonly<Record<string, readonly SettingsDefaultRow[]>> }[] = [
  { version: 'settings-v1', tables: { 'source-header-mapping': sourceHeaderMappingDefaults, 'data-enrichment': dataEnrichmentDefaults } },
  { version: 'settings-v2', tables: { 'email-group': emailGroupDefaults, 'auto-validation': autoValidationDefaults } }
];

export const settingsDefaults = {
  'source-header-mapping': sourceHeaderMappingDefaults,
  'data-enrichment': dataEnrichmentDefaults,
  'email-group': emailGroupDefaults,
  'auto-validation': autoValidationDefaults
} as const;
