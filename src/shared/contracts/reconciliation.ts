import { z } from 'zod';
import { result } from './result.js';

export const ReconciliationStatusSchema = z.enum(['matched', 'unmatched', 'missing-from-broker', 'missing-from-ot-murex']);
export const BrokerContactSchema = z.object({ name: z.string().min(1), recipient: z.email() }).readonly();
export const ReconciliationTradeSchema = z.object({
  source: z.enum(['broker', 'ot-murex']), tradeId: z.string().min(1), isin: z.string().min(1), buySell: z.enum(['buy', 'sell']),
  currency: z.string().min(1), settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.string().min(1), quantity: z.string().min(1), price: z.string().min(1),
  brokerContact: BrokerContactSchema.nullable().optional()
}).readonly();
export const ReconciliationResultSchema = z.object({
  id: z.string().min(1), status: ReconciliationStatusSchema, reason: z.enum(['amount-mismatch', 'quantity-mismatch', 'amount-and-quantity-mismatch']).nullable(),
  reviewed: z.boolean().default(false), comment: z.string().nullable().default(null),
  // Analyst override for `reason`, which remains the engine-derived value.
  mismatchReason: z.string().nullable().default(null),
  brokerTrade: ReconciliationTradeSchema.nullable(), otMurexTrade: ReconciliationTradeSchema.nullable()
}).readonly();
export const ReconciliationMetricsSchema = z.object({ total: z.number().int().nonnegative(), matched: z.number().int().nonnegative(), unresolved: z.number().int().nonnegative(), reconciliationRate: z.number().min(0).max(1), unresolvedRate: z.number().min(0).max(1) }).readonly();
// Per-status totals for the composition chart. Additive and optional so a snapshot
// produced before this field existed still parses; both adapters always populate it.
export const ReconciliationStatusCountsSchema = z.object({
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  'missing-from-broker': z.number().int().nonnegative(),
  'missing-from-ot-murex': z.number().int().nonnegative()
}).readonly();
export const ReconciliationAnomalySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('insufficient-history'), currentUnresolvedRate: z.number().min(0).max(1), historyCount: z.number().int().nonnegative(), baselineUnresolvedRate: z.null() }).readonly(),
  z.object({ kind: z.literal('normal'), currentUnresolvedRate: z.number().min(0).max(1), historyCount: z.literal(5), baselineUnresolvedRate: z.number().min(0).max(1) }).readonly(),
  z.object({ kind: z.literal('warning'), currentUnresolvedRate: z.number().min(0).max(1), historyCount: z.literal(5), baselineUnresolvedRate: z.number().min(0).max(1) }).readonly()
]);
export const ReviewProgressSchema = z.object({ reviewedUnmatched: z.number().int().nonnegative(), totalUnmatched: z.number().int().nonnegative() }).refine((value) => value.reviewedUnmatched <= value.totalUnmatched).readonly();
const ReconciliationRunIdentitySchema = z.object({
  runId: z.string().uuid(), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), completedAt: z.string().datetime(), metrics: ReconciliationMetricsSchema,
  statusCounts: ReconciliationStatusCountsSchema.optional(),
  // Optional for the same reason as statusCounts: additive, and always populated by both adapters.
  reviewProgress: ReviewProgressSchema.optional()
});
export const ReconciliationRunAggregateSchema = ReconciliationRunIdentitySchema.extend({ results: z.array(ReconciliationResultSchema).readonly() }).readonly();
const ReconciliationRunSummaryObjectSchema = ReconciliationRunIdentitySchema.extend({ anomaly: ReconciliationAnomalySchema });
export const ReconciliationRunSummarySchema = ReconciliationRunSummaryObjectSchema.readonly();
const ReconciliationWorkspaceObjectSchema = ReconciliationRunSummaryObjectSchema.extend({
  results: z.array(ReconciliationResultSchema).readonly(),
  reviewProgress: ReviewProgressSchema.default({ reviewedUnmatched: 0, totalUnmatched: 0 })
});
export const ReconciliationWorkspaceSchema = ReconciliationWorkspaceObjectSchema.readonly();
// The report is deliberately a named, immutable snapshot contract.  It is built
// in main from one database transaction and is the only data a workbook worker sees.
export const RunReportV1Schema = ReconciliationWorkspaceObjectSchema.extend({ version: z.literal(1) }).readonly();

export const ReconciliationRunRequestSchema = z.object({ version: z.literal(1), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
export const ReconciliationRunResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const RunsListRequestSchema = z.object({ version: z.literal(1) }).strict();
export const RunsListResultSchema = result(z.object({ runs: z.array(ReconciliationRunSummarySchema).readonly() }).readonly());
export const RunWorkspaceGetRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid() }).strict();
export const RunWorkspaceGetResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const ResultReviewRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid(), resultId: z.string().min(1) }).strict();
export const ResultReviewResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const ResolutionCommentSchema = z.string().max(2_000);
export const ResultCommentSaveRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid(), resultId: z.string().min(1), comment: ResolutionCommentSchema }).strict();
export const ResultCommentSaveResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const AnalystMismatchReasonSchema = z.string().max(200);
export const ResultMismatchReasonSaveRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid(), resultId: z.string().min(1), mismatchReason: AnalystMismatchReasonSchema }).strict();
export const ResultMismatchReasonSaveResultSchema = result(z.object({ workspace: ReconciliationWorkspaceSchema }).readonly());
export const BrokerPreviewRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid(), resultId: z.string().min(1) }).strict();
export const BrokerEmailDraftRowSchema = z.object({
  tradeId: z.string().min(1), isin: z.string().min(1), buySell: z.enum(['buy', 'sell']), amount: z.string().min(1), quantity: z.string().min(1),
  currency: z.string().min(1), settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mismatchReason: z.enum(['amount-mismatch', 'quantity-mismatch', 'amount-and-quantity-mismatch']), comment: z.string().nullable()
}).readonly();
export const BrokerEmailDraftSchema = z.object({
  status: z.literal('Draft'), brokerName: z.string().min(1), recipient: z.email(), subject: z.string().min(1), body: z.string().min(1), rows: z.array(BrokerEmailDraftRowSchema).min(1).readonly()
}).readonly();
export const BrokerPreviewResultSchema = result(z.object({ draft: BrokerEmailDraftSchema }).readonly());
export const ReportSaveRequestSchema = z.object({ version: z.literal(1), runId: z.string().uuid() }).strict();
export const ReportSaveResultSchema = result(z.object({ destination: z.string().min(1) }).readonly());
export const ReportSheetNamesSchema = z.tuple([
  z.literal('Summary'),
  z.literal('Matched'),
  z.literal('Mismatched'),
  z.literal('Missing from Broker'),
  z.literal('Missing from OT-MUREX')
]).readonly();
export const ReportWorkerReceiptSchema = z.object({
  temporaryPath: z.string().min(1),
  sheetNames: ReportSheetNamesSchema
}).readonly();
export const ReconciliationProgressSchema = z.object({ runId: z.string().uuid().optional(), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), phase: z.enum(['started', 'completed', 'failed']) }).readonly();

export const ReconciliationChannels = { run: 'reconciliation.run.v1', listRuns: 'runs.list.v1', getWorkspace: 'run.workspace.get.v1', reviewResult: 'result.review.v1', saveComment: 'comment.save.v1', saveMismatchReason: 'mismatch-reason.save.v1', previewBroker: 'broker.preview.v1', saveReport: 'report.save.v1', progress: 'reconciliation.progress.v1' } as const;
export type ReconciliationStatusCounts = z.infer<typeof ReconciliationStatusCountsSchema>;
export type ReconciliationWorkspace = z.infer<typeof ReconciliationWorkspaceSchema>;
export type ReconciliationRunAggregate = z.infer<typeof ReconciliationRunAggregateSchema>;
export type ReconciliationRunSummary = z.infer<typeof ReconciliationRunSummarySchema>;
export type ReconciliationRunResult = z.infer<typeof ReconciliationRunResultSchema>;
export type RunsListResult = z.infer<typeof RunsListResultSchema>;
export type RunWorkspaceGetResult = z.infer<typeof RunWorkspaceGetResultSchema>;
export type ResultReviewResult = z.infer<typeof ResultReviewResultSchema>;
export type ResultCommentSaveRequest = z.infer<typeof ResultCommentSaveRequestSchema>;
export type ResultCommentSaveResult = z.infer<typeof ResultCommentSaveResultSchema>;
export type ResultMismatchReasonSaveRequest = z.infer<typeof ResultMismatchReasonSaveRequestSchema>;
export type ResultMismatchReasonSaveResult = z.infer<typeof ResultMismatchReasonSaveResultSchema>;
export type BrokerEmailDraft = z.infer<typeof BrokerEmailDraftSchema>;
export type BrokerPreviewResult = z.infer<typeof BrokerPreviewResultSchema>;
export type RunReportV1 = z.infer<typeof RunReportV1Schema>;
export type ReportSaveResult = z.infer<typeof ReportSaveResultSchema>;
export type ReportWorkerReceipt = z.infer<typeof ReportWorkerReceiptSchema>;
export type ReconciliationProgress = z.infer<typeof ReconciliationProgressSchema>;
