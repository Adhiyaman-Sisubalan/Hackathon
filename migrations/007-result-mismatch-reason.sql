-- Analyst-supplied mismatch reason. Kept separate from `reason`, which stays the
-- engine-derived record of what actually differed between the two systems.
ALTER TABLE reconciliation_results ADD COLUMN mismatch_reason TEXT;

CREATE INDEX IF NOT EXISTS reconciliation_results_run_mismatch_reason_idx ON reconciliation_results(run_id) WHERE mismatch_reason IS NOT NULL;
