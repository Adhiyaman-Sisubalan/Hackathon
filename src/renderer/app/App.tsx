import { useState, type ReactNode } from 'react';
import { appViews, type AppView } from './app-view.js';
import { Dashboard } from '../features/dashboard/Dashboard.js';
import { Results } from '../features/results/Results.js';
import { reconciliationStatuses, type ReconciliationStatus } from '../../domain/reconciliation/reconciliation.js';
import type { ReconciliationWorkspace } from '../../shared/contracts/reconciliation.js';
import { RunHistory } from '../features/runs/RunHistory.js';
import { applyThemeMode, persistThemeMode, themeModes, type ThemeMode } from './theme.js';
import styles from './App.module.css';

const themeLabels: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

const exceptionStatuses = reconciliationStatuses.filter((status) => status !== 'matched');

// Decorative only: navigation buttons are named by their visible label, so every icon stays out of the accessibility tree.
const navIcons: Record<AppView, ReactNode> = {
  overview: <><rect x="2.5" y="2.5" width="5" height="5" rx="1.2" /><rect x="10.5" y="2.5" width="5" height="5" rx="1.2" /><rect x="2.5" y="10.5" width="5" height="5" rx="1.2" /><rect x="10.5" y="10.5" width="5" height="5" rx="1.2" /></>,
  runs: <><path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h8" /></>,
  exceptions: <><path d="M9 2.5 16 15H2L9 2.5Z" /><path d="M9 7v3.5M9 12.6v.1" /></>,
  results: null
};

export function App({ initialThemeMode = 'system' }: { initialThemeMode?: ThemeMode } = {}) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [view, setView] = useState<AppView>('overview');
  const [workspace, setWorkspace] = useState<ReconciliationWorkspace>();
  const [resultFilters, setResultFilters] = useState<readonly ReconciliationStatus[]>(reconciliationStatuses);
  const showWorkspace = (nextWorkspace: ReconciliationWorkspace, exceptions = false) => {
    setWorkspace(nextWorkspace);
    setResultFilters(exceptions ? exceptionStatuses : reconciliationStatuses);
    setView('results');
  };
  const currentLabel = view === 'results' ? 'Results' : appViews.find((item) => item.id === view)?.label ?? '';
  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyThemeMode(mode);
    persistThemeMode(mode);
  };
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span className={styles.mark} aria-hidden="true">R</span><span className={styles.brandName}>Reconciliation</span></div>
      <nav aria-label="Primary" className={styles.navigation}>
        <p className={styles.navLabel}>Workspace</p>
        {appViews.map((item) => <button key={item.id} type="button" className={styles.navItem} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>
          <svg className={styles.navIcon} viewBox="0 0 18 18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{navIcons[item.id]}</svg>
          {item.label}
        </button>)}
      </nav>
      <p className={styles.sidebarFoot}>Hackathon prototype</p>
    </aside>
    <div className={styles.frame}>
      <header className={styles.topbar}>
        <p className={styles.crumbs}><span className={styles.crumbRoot}>Reconciliation</span><span className={styles.crumbSeparator} aria-hidden="true">/</span>{currentLabel}</p>
        <div className={styles.topbarMeta}>
          <p className={styles.environment}><span className={styles.environmentDot} aria-hidden="true" />Local demo data</p>
          <div className={styles.themeToggle} role="group" aria-label="Theme">
            {themeModes.map((mode) => <button key={mode} type="button" className={styles.themeOption} aria-pressed={themeMode === mode} onClick={() => chooseTheme(mode)}>{themeLabels[mode]}</button>)}
          </div>
        </div>
      </header>
      <main className={styles.content}>
        {view === 'overview' && <Dashboard onCompleted={(completed) => showWorkspace(completed)} />}
        {view === 'runs' && <RunHistory destination="runs" onOpened={showWorkspace} onStale={() => setWorkspace(undefined)} onOverview={() => setView('overview')} />}
        {view === 'exceptions' && <RunHistory destination="exceptions" onOpened={showWorkspace} onStale={() => setWorkspace(undefined)} onOverview={() => setView('overview')} />}
        {view === 'results' && workspace && <Results key={`${workspace.runId}:${resultFilters.join(',')}`} workspace={workspace} initialSelected={resultFilters} onWorkspaceChanged={setWorkspace} />}
      </main>
    </div>
  </div>;
}
