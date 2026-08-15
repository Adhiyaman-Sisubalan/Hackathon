import type { DashboardSummary } from '../../shared/contracts/dashboard.js';

export interface ApplicationServices {
  migrate(): void;
  seed(): void;
  latestSummary(): DashboardSummary | null;
}

export function bootstrapApplication(services: ApplicationServices): void {
  services.migrate();
  services.seed();
}
