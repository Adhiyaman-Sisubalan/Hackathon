ALTER TABLE runs ADD COLUMN unresolved_rate REAL NOT NULL DEFAULT 0 CHECK (unresolved_rate >= 0 AND unresolved_rate <= 1);

UPDATE runs SET unresolved_rate = CASE WHEN total = 0 THEN 0 ELSE CAST(unresolved AS REAL) / total END;

CREATE TABLE IF NOT EXISTS seeded_run_history (
  seed_version TEXT NOT NULL,
  history_key TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  matched INTEGER NOT NULL CHECK (matched >= 0 AND matched <= total),
  unresolved INTEGER NOT NULL CHECK (unresolved >= 0 AND unresolved <= total),
  reconciliation_rate REAL NOT NULL CHECK (reconciliation_rate >= 0 AND reconciliation_rate <= 1),
  unresolved_rate REAL NOT NULL CHECK (unresolved_rate >= 0 AND unresolved_rate <= 1),
  PRIMARY KEY (seed_version, history_key)
);

CREATE INDEX IF NOT EXISTS seeded_run_history_version_idx ON seeded_run_history (seed_version, completed_at ASC, history_key ASC);
