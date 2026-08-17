export type AppView = 'overview' | 'runs' | 'exceptions' | 'settings' | 'results';

export const appViews: readonly { id: AppView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'runs', label: 'Reconciliation Runs' },
  // The id stays `exceptions`: the destination still opens the latest run filtered to
  // unresolved work. Only its visible name changed.
  { id: 'exceptions', label: 'Result' },
  { id: 'settings', label: 'Settings' }
];
