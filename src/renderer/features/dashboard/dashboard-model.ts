import type { DashboardSummary } from '../../../shared/contracts/dashboard.js';

export type DashboardState =
  | { kind: 'loading' }
  | { kind: 'first-use' }
  | { kind: 'summary'; summary: DashboardSummary }
  | { kind: 'error'; message: string; retryable: boolean };

export interface DashboardError { message: string; retryable: boolean; }

export function dashboardState(summary: DashboardSummary | null | undefined, error?: DashboardError): DashboardState {
  if (error) return { kind: 'error', ...error };
  if (summary === undefined) return { kind: 'loading' };
  if (summary === null) return { kind: 'first-use' };
  return { kind: 'summary', summary };
}
