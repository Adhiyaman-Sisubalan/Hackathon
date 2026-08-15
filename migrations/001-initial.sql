CREATE TABLE IF NOT EXISTS seed_versions (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (length(status) > 0),
  completed_at TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  matched INTEGER NOT NULL CHECK (matched >= 0 AND matched <= total),
  unresolved INTEGER NOT NULL CHECK (unresolved >= 0 AND unresolved <= total),
  reconciliation_rate REAL NOT NULL CHECK (reconciliation_rate >= 0 AND reconciliation_rate <= 1)
);

CREATE INDEX IF NOT EXISTS runs_latest_completed_idx ON runs (status, completed_at DESC, id DESC);
