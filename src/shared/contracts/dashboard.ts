import { z } from 'zod';
import { result } from './result.js';

export const DashboardSummarySchema = z.object({
  runId: z.string().uuid(),
  completedAt: z.string().datetime(),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  reconciliationRate: z.number().min(0).max(1)
}).readonly();

export const DashboardGetRequestSchema = z.object({ version: z.literal(1) }).strict();
export const DashboardGetResultSchema = result(z.object({ summary: DashboardSummarySchema.nullable() }).readonly());

export const DashboardChannels = { get: 'dashboard.get.v1' } as const;
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type DashboardGetResult = z.infer<typeof DashboardGetResultSchema>;
