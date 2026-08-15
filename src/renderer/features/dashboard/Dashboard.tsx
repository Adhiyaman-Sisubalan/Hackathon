import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import type { ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import type { ReconciliationApi } from '../../../shared/contracts/preload.js';
import { dashboardState, type DashboardError } from './dashboard-model.js';
import { SummaryStrip } from '../../components/SummaryStrip.js';
import styles from './Dashboard.module.css';

const supportedDates = new Set(['2026-08-13', '2026-08-14', '2026-08-15']);
type DashboardProps = { api?: ReconciliationApi['dashboard']; reconciliationApi?: ReconciliationApi['reconciliation']; onCompleted?: (workspace: ReconciliationWorkspace) => void };
interface RunError { message: string; field?: 'asOfDate'; }

export function Dashboard({ api, reconciliationApi, onCompleted }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null | undefined>(undefined);
  const [error, setError] = useState<DashboardError>();
  const [asOfDate, setAsOfDate] = useState('2026-08-15');
  const [runError, setRunError] = useState<RunError>();
  const [progress, setProgress] = useState<string>();
  const [running, setRunning] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const dashboardApi = api ?? window.reconciliation?.dashboard;
  const runApi = reconciliationApi ?? window.reconciliation?.reconciliation;
  const load = async () => {
    setError(undefined); setSummary(undefined);
    if (!dashboardApi) { setError({ message: 'Dashboard access is unavailable.', retryable: false }); return; }
    try {
      const response = await dashboardApi.get();
      if (!response.ok) { setError({ message: response.error.message, retryable: response.error.retryable }); return; }
      setSummary(response.data.summary);
    } catch { setError({ message: 'The dashboard could not be loaded.', retryable: true }); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (error) retryRef.current?.focus(); }, [error]);
  useEffect(() => runApi?.onProgress((event) => {
    if (event.asOfDate !== asOfDate) return;
    setProgress(event.phase === 'started' ? 'Reconciliation is running…' : event.phase === 'completed' ? 'Reconciliation completed.' : 'Reconciliation could not be completed.');
  }), [runApi, asOfDate]);
  const state = dashboardState(summary, error);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunError(undefined); setProgress(undefined);
    if (!supportedDates.has(asOfDate)) { setRunError({ message: 'No seeded data for this date', field: 'asOfDate' }); dateRef.current?.focus(); return; }
    if (!runApi) { setRunError({ message: 'Reconciliation access is unavailable.' }); return; }
    setRunning(true); setProgress('Reconciliation is running…');
    try {
      const response = await runApi.run(asOfDate);
      if (!response.ok) { const field = response.error.field === 'asOfDate' ? 'asOfDate' : undefined; setRunError({ message: response.error.message, field }); if (field) dateRef.current?.focus(); return; }
      setProgress('Reconciliation completed.');
      onCompleted?.(response.data.workspace);
    } catch { setRunError({ message: 'The reconciliation could not be started. Please retry.' }); }
    finally { setRunning(false); }
  };
  return <section aria-labelledby="dashboard-title" className={styles.dashboard}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Overview</p><h1 id="dashboard-title">Dashboard</h1></div></div>
    {state.kind === 'loading' && <p role="status">Loading latest reconciliation summary…</p>}
    {state.kind === 'first-use' && <p>No reconciliation has been completed yet. Choose an as-of date and run reconciliation to create your first run.</p>}
    {state.kind === 'error' && <div role="alert" className={styles.error}><p>{state.message}</p>{state.retryable && <button ref={retryRef} type="button" onClick={() => void load()}>Retry dashboard query</button>}</div>}
    {state.kind === 'summary' && <SummaryStrip summary={state.summary} />}
    <form className={styles.runForm} onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="as-of-date">As-of date</label>
      <div className={styles.controls}><input ref={dateRef} id="as-of-date" type="date" value={asOfDate} onChange={(event) => { setAsOfDate(event.target.value); if (runError?.field === 'asOfDate') setRunError(undefined); }} aria-describedby={runError?.field === 'asOfDate' ? 'as-of-date-error' : undefined} aria-invalid={runError?.field === 'asOfDate'} disabled={running} /><button type="submit" className={styles.primary} disabled={running}>{running ? 'Running reconciliation…' : 'Run reconciliation'}</button></div>
      {runError && <p id={runError.field === 'asOfDate' ? 'as-of-date-error' : undefined} role="alert" className={styles.error}>{runError.message}</p>}
      <p className={styles.note} aria-live="polite">{progress ?? 'Select a seeded business date to create a persisted reconciliation run.'}</p>
    </form>
  </section>;
}
