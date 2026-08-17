-- Editable reference tables shown on the Settings screen. Rows are seeded once from
-- fixtures/settings-defaults.ts under their own seed version, so an operator's edits and
-- deletions survive every later launch.

CREATE TABLE IF NOT EXISTS source_header_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  remarks TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS source_header_mapping_provider_idx ON source_header_mapping (provider, id);

CREATE TABLE IF NOT EXISTS data_enrichment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  field TEXT NOT NULL,
  source_value TEXT NOT NULL,
  target_value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS data_enrichment_provider_idx ON data_enrichment (provider, id);
