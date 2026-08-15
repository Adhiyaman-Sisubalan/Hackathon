import { useState } from 'react';
import { appViews, type AppView } from './app-view.js';
import { Dashboard } from '../features/dashboard/Dashboard.js';
import { Results } from '../features/results/Results.js';
import type { ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import styles from './App.module.css';

function EmptyDestination({ view }: { view: Exclude<AppView, 'overview' | 'results'> }) {
  const message = view === 'runs' ? 'Completed reconciliation runs will appear here.' : 'Exceptions will appear after a reconciliation completes.';
  return <section aria-labelledby={`${view}-title`} className={styles.destination}><h1 id={`${view}-title`}>{view === 'runs' ? 'Reconciliation Runs' : 'Exceptions'}</h1><p>{message}</p></section>;
}

export function App() {
  const [view, setView] = useState<AppView>('overview');
  const [workspace, setWorkspace] = useState<ReconciliationWorkspace>();
  return <div className={styles.shell}>
    <header className={styles.header}><span className={styles.productName}>Reconciliation</span></header>
    <nav aria-label="Primary" className={styles.navigation}>{appViews.map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
    <main className={styles.content}>{view === 'overview' ? <Dashboard onCompleted={(completed) => { setWorkspace(completed); setView('results'); }} /> : view === 'results' && workspace ? <Results workspace={workspace} /> : <EmptyDestination view={view as Exclude<AppView, 'overview' | 'results'>} />}</main>
  </div>;
}
