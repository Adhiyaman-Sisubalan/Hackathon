export type AppView = 'overview' | 'runs' | 'exceptions';

export const appViews: readonly { id: AppView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'runs', label: 'Reconciliation Runs' },
  { id: 'exceptions', label: 'Exceptions' }
];
