ALTER TABLE source_trades ADD COLUMN broker_name TEXT;
ALTER TABLE source_trades ADD COLUMN broker_recipient TEXT;

UPDATE source_trades
SET broker_name = 'Atlas Securities',
    broker_recipient = 'operations@atlas-securities.example'
WHERE source = 'broker' AND (broker_name IS NULL OR broker_recipient IS NULL);

CREATE INDEX IF NOT EXISTS source_trades_run_broker_contact_idx
  ON source_trades (run_id, source, broker_name, broker_recipient);
