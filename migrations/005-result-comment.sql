ALTER TABLE reconciliation_results ADD COLUMN comment TEXT;

CREATE INDEX IF NOT EXISTS reconciliation_results_run_comment_idx ON reconciliation_results(run_id) WHERE comment IS NOT NULL;
