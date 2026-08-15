import { useEffect, useRef, useState } from 'react';
import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';
import type { ReconciliationApi } from '../../../shared/contracts/preload.js';
import { dashboardState, type DashboardError } from './dashboard-model.js';
import styles from './Dashboard.module.css';

export function Dashboard({ api }: { api?: ReconciliationApi['dashboard'] }) {
  const [summary, setSummary] = useState<DashboardSummary | null | undefined>(undefined);
  const [error, setError] = useState<DashboardError>();
  const [startFeedback, setStartFeedback] = useState<string>();
  const retryRef = useRef<HTMLButtonElement>(null);
  const dashboardApi = api ?? window.reconciliation?.dashboard;
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
  const state = dashboardState(summary, error);
  return <section aria-labelledby="dashboard-title" className={styles.dashboard}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Overview</p><h1 id="dashboard-title">Dashboard</h1></div><button type="button" className={styles.primary} onClick={() => setStartFeedback('Reconciliation setup is ready. Running a reconciliation becomes available in Story 1.2.')}>Start reconciliation</button></div>
    {state.kind === 'loading' && <p role="status">Loading latest reconciliation summary…</p>}
    {state.kind === 'first-use' && <p>No reconciliation has been completed yet. Choose Start reconciliation to prepare your first run.</p>}
    {state.kind === 'error' && <div role="alert" className={styles.error}><p>{state.message}</p>{state.retryable && <button ref={retryRef} type="button" onClick={() => void load()}>Retry dashboard query</button>}</div>}
    {state.kind === 'summary' && <dl className={styles.summary} aria-label="Latest reconciliation summary"><div><dt>Total</dt><dd>{state.summary.total}</dd></div><div><dt>Matched</dt><dd>{state.summary.matched}</dd></div><div><dt>Unresolved</dt><dd>{state.summary.unresolved}</dd></div><div><dt>Reconciliation rate</dt><dd>{Math.round(state.summary.reconciliationRate * 100)}%</dd></div></dl>}
    <p className={styles.note} aria-live="polite">{startFeedback ?? 'Reconciliation execution is introduced in the next story.'}</p>
  </section>;
}
