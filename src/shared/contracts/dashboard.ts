import { z } from 'zod';
import { result } from './result.js';
import { ReconciliationRunSummarySchema } from './reconciliation.js';

export const DashboardSummarySchema = ReconciliationRunSummarySchema;

export const DashboardGetRequestSchema = z.object({ version: z.literal(1) }).strict();
export const DashboardGetResultSchema = result(z.object({ summary: DashboardSummarySchema.nullable() }).readonly());

export const DashboardChannels = { get: 'dashboard.get.v1' } as const;
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type DashboardGetResult = z.infer<typeof DashboardGetResultSchema>;
