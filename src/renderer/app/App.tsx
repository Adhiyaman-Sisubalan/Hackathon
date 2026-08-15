import { useState } from 'react';
import { appViews, type AppView } from './app-view.js';
import { Dashboard } from '../features/dashboard/Dashboard.js';
import { Results } from '../features/results/Results.js';
import { reconciliationStatuses, type ReconciliationStatus } from '../../domain/reconciliation/reconciliation.js';
import type { ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import { RunHistory } from '../features/runs/RunHistory.js';
import styles from './App.module.css';

const exceptionStatuses = reconciliationStatuses.filter((status) => status !== 'matched');

export function App() {
  const [view, setView] = useState<AppView>('overview');
  const [workspace, setWorkspace] = useState<ReconciliationWorkspace>();
  const [resultFilters, setResultFilters] = useState<readonly ReconciliationStatus[]>(reconciliationStatuses);
  const showWorkspace = (nextWorkspace: ReconciliationWorkspace, exceptions = false) => {
    setWorkspace(nextWorkspace);
    setResultFilters(exceptions ? exceptionStatuses : reconciliationStatuses);
    setView('results');
  };
  return <div className={styles.shell}>
    <header className={styles.header}><span className={styles.productName}>Reconciliation</span></header>
    <nav aria-label="Primary" className={styles.navigation}>{appViews.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
    <main className={styles.content}>
      {view === 'overview' && <Dashboard onCompleted={(completed) => showWorkspace(completed)} />}
      {view === 'runs' && <RunHistory destination="runs" onOpened={showWorkspace} onStale={() => setWorkspace(undefined)} onOverview={() => setView('overview')} />}
      {view === 'exceptions' && <RunHistory destination="exceptions" onOpened={showWorkspace} onStale={() => setWorkspace(undefined)} onOverview={() => setView('overview')} />}
      {view === 'results' && workspace && <Results key={`${workspace.runId}:${resultFilters.join(',')}`} workspace={workspace} initialSelected={resultFilters} />}
    </main>
  </div>;
}
