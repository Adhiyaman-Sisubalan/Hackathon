/**
 * Shipped defaults for the editable settings tables, kept free of any main-process
 * imports so the SQLite seed and the browser preview load identical rows.
 *
 * These are starting values, not constants: the Settings screen can edit or delete any
 * row, and the seed is applied once per version so user changes are never overwritten.
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

export const settingsDefaults = {
  'source-header-mapping': sourceHeaderMappingDefaults,
  'data-enrichment': dataEnrichmentDefaults
} as const;

/** Bumping this replays the defaults into a database that has not seen the new version. */
export const settingsSeedVersion = 'settings-v1';
