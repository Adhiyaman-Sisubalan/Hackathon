ALTER TABLE reconciliation_results ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0, 1));

CREATE INDEX IF NOT EXISTS reconciliation_results_run_review_idx ON reconciliation_results(run_id, status, reviewed);
