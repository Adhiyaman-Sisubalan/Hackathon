import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import type { ReconciliationRunSummary, ReconciliationWorkspace } from '../../../shared/contracts/reconciliation.js';
import type { ReconciliationApi } from '../../../shared/contracts/preload.js';
import { dashboardState, type DashboardError } from './dashboard-model.js';
import { SummaryStrip } from '../../components/SummaryStrip.js';
import { RunComposition } from '../../components/RunComposition.js';
import { RunTrend } from '../../components/RunTrend.js';
import styles from './Dashboard.module.css';

// Mirrors reconciliationScenarios.supportedDates; fixtures are main-process seed data and
// are deliberately not bundled into the renderer.
const seededDates = ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-17'] as const;
const supportedDates = new Set<string>(seededDates);
type DashboardProps = {
  api?: ReconciliationApi['dashboard'];
  reconciliationApi?: ReconciliationApi['reconciliation'];
  runsApi?: ReconciliationApi['runs'];
  onCompleted?: (workspace: ReconciliationWorkspace) => void;
};
interface RunError { message: string; field?: 'asOfDate'; }

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatCompletedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function Dashboard({ api, reconciliationApi, runsApi, onCompleted }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null | undefined>(undefined);
  const [error, setError] = useState<DashboardError>();
  const [asOfDate, setAsOfDate] = useState('2026-08-15');
  const [runError, setRunError] = useState<RunError>();
  const [progress, setProgress] = useState<string>();
  const [running, setRunning] = useState(false);
  // History drives the per-date chart. A failure here never blocks the summary or a run.
  const [history, setHistory] = useState<readonly ReconciliationRunSummary[]>([]);
  const retryRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const dashboardApi = api ?? window.reconciliation?.dashboard;
  const runApi = reconciliationApi ?? window.reconciliation?.reconciliation;
  const historyApi = runsApi ?? window.reconciliation?.runs;
  const loadHistory = async () => {
    if (!historyApi) return;
    try {
      const response = await historyApi.list();
      setHistory(response.ok ? response.data.runs : []);
    } catch { setHistory([]); }
  };
  const load = async () => {
    setError(undefined); setSummary(undefined);
    if (!dashboardApi) { setError({ message: 'Dashboard access is unavailable.', retryable: false }); return; }
    try {
      const response = await dashboardApi.get();
      if (!response.ok) { setError({ message: response.error.message, retryable: response.error.retryable }); return; }
      setSummary(response.data.summary);
    } catch { setError({ message: 'The dashboard could not be loaded.', retryable: true }); }
  };
  useEffect(() => { void load(); void loadHistory(); }, []);
  useEffect(() => { if (error) retryRef.current?.focus(); }, [error]);
  useEffect(() => runApi?.onProgress((event) => {
    if (event.asOfDate !== asOfDate) return;
    setProgress(event.phase === 'started' ? 'Reconciliation is running…' : event.phase === 'completed' ? 'Reconciliation completed.' : 'Reconciliation could not be completed.');
  }), [runApi, asOfDate]);
  const state = dashboardState(summary, error);
  const chooseDate = (next: string) => {
    setAsOfDate(next);
    if (runError?.field === 'asOfDate') setRunError(undefined);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunError(undefined); setProgress(undefined);
    if (!supportedDates.has(asOfDate)) { setRunError({ message: 'No seeded data for this date', field: 'asOfDate' }); dateRef.current?.focus(); return; }
    if (!runApi) { setRunError({ message: 'Reconciliation access is unavailable.' }); return; }
    setRunning(true); setProgress('Reconciliation is running…');
    try {
      const response = await runApi.run(asOfDate);
      if (!response.ok) { const field = response.error.field === 'asOfDate' ? 'asOfDate' : undefined; setRunError({ message: response.error.message, field }); if (field) dateRef.current?.focus(); return; }
      setSummary(response.data.workspace);
      setProgress('Reconciliation completed.');
      void loadHistory();
      onCompleted?.(response.data.workspace);
    } catch { setRunError({ message: 'The reconciliation could not be started. Please retry.' }); }
    finally { setRunning(false); }
  };
  return <section aria-labelledby="dashboard-title" className={styles.dashboard}>
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Daily operations</p>
        <h1 id="dashboard-title">Dashboard</h1>
      </div>
      {state.kind === 'summary' && <p className={styles.headingMeta}>Latest run completed {formatCompletedAt(state.summary.completedAt)}</p>}
    </div>
    {state.kind === 'loading' && <p role="status" className={styles.loading}>Loading latest reconciliation summary…</p>}
    {state.kind === 'first-use' && <div className={styles.firstUse}><p>No reconciliation has been completed yet. Choose an as-of date and run reconciliation to create your first run.</p></div>}
    {state.kind === 'error' && <div role="alert" className={styles.error}><p>{state.message}</p>{state.retryable && <button ref={retryRef} type="button" className={styles.secondary} onClick={() => void load()}>Retry dashboard query</button>}</div>}
    {state.kind === 'summary' && <RunComposition summary={state.summary} />}
    {state.kind === 'summary' && <SummaryStrip summary={state.summary} />}
    {history.length > 0 && <RunTrend runs={history} />}
    <section className={styles.runPanel} aria-labelledby="run-panel-title">
      <div className={styles.panelHead}>
        <h2 id="run-panel-title">Start a reconciliation</h2>
        <p>Seeded broker and OT/MUREX data is available for three business dates.</p>
      </div>
      <form className={styles.runForm} onSubmit={(event) => void submit(event)} noValidate>
        <div className={styles.field}>
          <label htmlFor="as-of-date">As-of date</label>
          <div className={styles.controls}>
            <input ref={dateRef} id="as-of-date" type="date" value={asOfDate} onChange={(event) => chooseDate(event.target.value)} aria-describedby={runError?.field === 'asOfDate' ? 'as-of-date-error' : undefined} aria-invalid={runError?.field === 'asOfDate'} disabled={running} />
            <button type="submit" className={styles.primary} disabled={running}>{running ? 'Running reconciliation…' : 'Run reconciliation'}</button>
          </div>
        </div>
        <div className={styles.presets}>
          {seededDates.map((date) => <button key={date} type="button" className={styles.chip} aria-pressed={asOfDate === date} disabled={running} onClick={() => chooseDate(date)}>{formatDate(date)}</button>)}
        </div>
        {runError && <p id={runError.field === 'asOfDate' ? 'as-of-date-error' : undefined} role="alert" className={styles.error}>{runError.message}</p>}
        <p className={styles.note} aria-live="polite">{progress ?? 'Select a seeded business date to create a persisted reconciliation run.'}</p>
      </form>
    </section>
  </section>;
}
