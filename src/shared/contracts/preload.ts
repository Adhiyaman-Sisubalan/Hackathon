import type { DashboardGetResult } from './dashboard.js';

export interface ReconciliationApi {
  dashboard: { get(): Promise<DashboardGetResult> };
}
