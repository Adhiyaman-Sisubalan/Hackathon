ALTER TABLE runs ADD COLUMN as_of_date TEXT NOT NULL DEFAULT '2026-08-15';

CREATE TABLE IF NOT EXISTS source_trades (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('broker', 'ot-murex')),
  trade_id TEXT NOT NULL,
  isin TEXT NOT NULL,
  buy_sell TEXT NOT NULL CHECK (buy_sell IN ('buy', 'sell')),
  currency TEXT NOT NULL,
  settlement_date TEXT NOT NULL,
  amount TEXT NOT NULL,
  quantity TEXT NOT NULL,
  price TEXT NOT NULL,
  PRIMARY KEY (run_id, source, trade_id)
);

CREATE TABLE IF NOT EXISTS reconciliation_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('matched', 'unmatched', 'missing-from-broker', 'missing-from-ot-murex')),
  reason TEXT,
  broker_trade_id TEXT,
  ot_murex_trade_id TEXT
);

CREATE INDEX IF NOT EXISTS reconciliation_results_run_status_idx ON reconciliation_results(run_id, status);
