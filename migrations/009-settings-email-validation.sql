-- Two further editable reference tables shown on the Settings screen. Seeded once from
-- the settings-v2 batch in fixtures/settings-defaults.ts, so a database created before
-- these tables existed receives them without disturbing the settings-v1 rows.

CREATE TABLE IF NOT EXISTS email_group (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  to_recipients TEXT NOT NULL,
  -- A group can legitimately have nobody on copy, so this is stored empty rather than null.
  cc_recipients TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS email_group_name_idx ON email_group (group_name, id);

CREATE TABLE IF NOT EXISTS auto_validation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broker TEXT NOT NULL,
  criteria TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  validated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auto_validation_broker_idx ON auto_validation (broker, id);
