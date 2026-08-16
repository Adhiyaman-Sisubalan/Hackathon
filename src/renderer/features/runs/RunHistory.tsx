import { useEffect, useRef, useState } from 'react';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import type { ReconciliationApi } from '../../../shared/contracts/preload.js';
import styles from './RunHistory.module.css';

type Destination = 'runs' | 'exceptions';
type HistoryError = { message: string; retryable: boolean };

export function RunHistory({ destination, api, onOpened, onStale, onOverview }: {
  destination: Destination;
  api?: Pick<ReconciliationApi['runs'], 'list' | 'getWorkspace'>;
  onOpened: (workspace: ReconciliationWorkspace, exceptionPreset: boolean) => void;
  onStale: () => void;
  onOverview: () => void;
}) {
  const [runs, setRuns] = useState<readonly ReconciliationRunSummary[] | undefined>();
  const [error, setError] = useState<HistoryError>();
  const [opening, setOpening] = useState<string>();
  const retryRef = useRef<HTMLButtonElement>(null);
  const runsApi = api ?? window.reconciliation?.runs;

  const openRun = async (runId: string, exceptionPreset = destination === 'exceptions') => {
    if (!runsApi) { setError({ message: 'Run history access is unavailable.', retryable: false }); return; }
    setOpening(runId); setError(undefined);
    try {
      const response = await runsApi.getWorkspace(runId);
      if (!response.ok) {
        setError({ message: response.error.message, retryable: response.error.retryable });
        if (response.error.code === 'RUN_NOT_FOUND') { onStale(); await loadHistory(true, false); }
        return;
      }
      onOpened(response.data.workspace, exceptionPreset);
    } catch { setError({ message: 'Run details could not be loaded. Please retry.', retryable: true }); }
    finally { setOpening(undefined); }
  };

  const loadHistory = async (preserveError = false, openLatest = true) => {
    if (!preserveError) setError(undefined);
    setRuns(undefined);
    if (!runsApi) { setError({ message: 'Run history access is unavailable.', retryable: false }); return; }
    try {
      const response = await runsApi.list();
      if (!response.ok) { setError({ message: response.error.message, retryable: response.error.retryable }); return; }
      setRuns(response.data.runs);
      if (destination === 'exceptions' && openLatest && response.data.runs[0]) await openRun(response.data.runs[0].runId, true);
    } catch { setError({ message: 'Run history could not be loaded. Please retry.', retryable: true }); }
  };

  useEffect(() => { void loadHistory(); }, [destination, runsApi]);
  useEffect(() => { if (error) retryRef.current?.focus(); }, [error]);

  const title = destination === 'runs' ? 'Reconciliation Runs' : 'Exceptions';
  const empty = destination === 'runs'
    ? 'No completed reconciliation runs yet. Open Overview to create one.'
    : 'No completed reconciliation runs are available. Open Overview to create one.';
  return <section aria-labelledby={`${destination}-title`} className={styles.history}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{destination === 'runs' ? 'Run history' : 'Current unresolved work'}</p><h1 id={`${destination}-title`}>{title}</h1></div></div>
    {runs === undefined && !error && <p role="status">Loading completed reconciliation runs…</p>}
    {error && <div className={styles.error} role="alert"><p>{error.message}</p>{error.retryable && <button ref={retryRef} type="button" onClick={() => void loadHistory()}>Retry run history</button>}</div>}
    {runs?.length === 0 && <div className={styles.empty}><p>{empty}</p><button type="button" onClick={onOverview}>Go to Overview</button></div>}
    {destination === 'exceptions' && runs && runs.length > 0 && opening && <p role="status">Opening the latest completed run…</p>}
    {destination === 'runs' && runs && runs.length > 0 && <ol className={styles.list} aria-label="Completed reconciliation runs">{runs.map((run) => <li key={run.runId}>
      <button type="button" onClick={() => void openRun(run.runId)} disabled={opening === run.runId} aria-label={`Open run ${run.runId}`}>
        <span>Run {run.runId}</span><span>As-of {run.asOfDate}</span><span>Completed {new Date(run.completedAt).toLocaleString()}</span>
        <span>Total {run.metrics.total}</span><span>Matched {run.metrics.matched}</span><span>Unresolved {run.metrics.unresolved}</span><span>Rate {Math.round(run.metrics.reconciliationRate * 100)}%</span>
      </button>
    </li>)}</ol>}
  </section>;
}
