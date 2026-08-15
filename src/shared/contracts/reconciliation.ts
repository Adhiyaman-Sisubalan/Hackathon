import { z } from 'zod';
import { result } from './result.js';

export const ReconciliationStatusSchema = z.enum(['matched', 'unmatched', 'missing-from-broker', 'missing-from-ot-murex']);
export const ReconciliationTradeSchema = z.object({
  source: z.enum(['broker', 'ot-murex']), tradeId: z.string().min(1), isin: z.string().min(1), buySell: z.enum(['buy', 'sell']),
  currency: z.string().min(1), settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.string().min(1), quantity: z.string().min(1), price: z.string().min(1)
}).readonly();
export const ReconciliationResultSchema = z.object({
  id: z.string().min(1), status: ReconciliationStatusSchema, reason: z.enum(['amount-mismatch', 'quantity-mismatch', 'amount-and-quantity-mismatch']).nullable(),
  brokerTrade: ReconciliationTradeSchema.nullable(), otMurexTrade: ReconciliationTradeSchema.nullable()
}).readonly();
export const ReconciliationMetricsSchema = z.object({ total: z.number().int().nonnegative(), matched: z.number().int().nonnegative(), unresolved: z.number().int().nonnegative(), reconciliationRate: z.number().min(0).max(1) }).readonly();
export const ReconciliationWorkspaceSchema = z.object({ runId: z.string().uuid(), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), completedAt: z.string().datetime(), metrics: ReconciliationMetricsSchema, results: z.array(ReconciliationResultSchema).readonly() }).readonly();
export const ReconciliationRunSummarySchema = z.object({
  runId: z.string().uuid(), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), completedAt: z.string().datetime(), metrics: ReconciliationMetricsSchema
}).readonly();

export const ReconciliationRunRequestSchema = z.object({ version: z.literal(1), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
export const ReconciliationRunResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const RunsListRequestSchema = z.object({ version: z.literal(1) }).strict();
export const RunsListResultSchema = result(z.object({ runs: z.array(ReconciliationRunSummarySchema).readonly() }).readonly());
export const RunWorkspaceGetRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid() }).strict();
export const RunWorkspaceGetResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const ReconciliationProgressSchema = z.object({ runId: z.string().uuid().optional(), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), phase: z.enum(['started', 'completed', 'failed']) }).readonly();

export const ReconciliationChannels = { run: 'reconciliation.run.v1', listRuns: 'runs.list.v1', getWorkspace: 'run.workspace.get.v1', progress: 'reconciliation.progress.v1' } as const;
export type ReconciliationWorkspace = z.infer<typeof ReconciliationWorkspaceSchema>;
export type ReconciliationRunSummary = z.infer<typeof ReconciliationRunSummarySchema>;
export type ReconciliationRunResult = z.infer<typeof ReconciliationRunResultSchema>;
export type RunsListResult = z.infer<typeof RunsListResultSchema>;
export type RunWorkspaceGetResult = z.infer<typeof RunWorkspaceGetResultSchema>;
export type ReconciliationProgress = z.infer<typeof ReconciliationProgressSchema>;
