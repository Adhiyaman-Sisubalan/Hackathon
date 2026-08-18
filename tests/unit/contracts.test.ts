import { describe, expect, it } from 'vitest';
import { DashboardGetRequestSchema, DashboardGetResultSchema } from '../../src/shared/contracts/dashboard.js';
import { BrokerPreviewRequestSchema, BrokerPreviewResultSchema, ReportSaveRequestSchema, ReportSaveResultSchema, ReportWorkerReceiptSchema, ResultCommentSaveRequestSchema, ResultCommentSaveResultSchema, RunReportV1Schema } from '../../src/shared/contracts/reconciliation.js';

describe('dashboard contract', () => {
  it('accepts only the versioned request and safe result envelope', () => {
    expect(DashboardGetRequestSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(DashboardGetRequestSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(DashboardGetResultSchema.safeParse({ ok: false, error: { code: 'QUERY_FAILED', message: 'Unavailable', retryable: true } }).success).toBe(true);
  });
});

describe('broker preview contract', () => {
  it('accepts only an identity-only strict request and a typed immutable Draft', () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    expect(BrokerPreviewRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result' }).success).toBe(true);
    expect(BrokerPreviewRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result', recipient: 'tampered@example.com' }).success).toBe(false);
    expect(BrokerPreviewResultSchema.safeParse({ ok: true, data: { draft: { status: 'Draft', brokerName: 'Atlas Securities', recipient: 'operations@atlas-securities.example', subject: 'Follow-up', body: 'Please review.', rows: [{ tradeId: 'BRK-202', isin: 'US0000000005', buySell: 'sell', amount: '200', quantity: '20', currency: 'EUR', settlementDate: '2026-08-19', mismatchReason: 'amount-mismatch', comment: 'Saved comment' }] } } }).success).toBe(true);
  });
});

describe('result comment contract', () => {
  it('accepts only the strict versioned plain-text save request and typed workspace envelope', () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    expect(ResultCommentSaveRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result', comment: 'Investigating.' }).success).toBe(true);
    expect(ResultCommentSaveRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result', comment: 'x'.repeat(2_000) }).success).toBe(true);
    expect(ResultCommentSaveRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result', comment: 'x'.repeat(2_001) }).success).toBe(false);
    expect(ResultCommentSaveRequestSchema.safeParse({ version: 1, runId, resultId: 'logical-result', comment: 'Investigating.', extra: true }).success).toBe(false);
    expect(ResultCommentSaveRequestSchema.safeParse({ version: 2, runId, resultId: 'logical-result', comment: 'Investigating.' }).success).toBe(false);
    expect(ResultCommentSaveResultSchema.safeParse({ ok: false, error: { code: 'PERSISTENCE_FAILED', message: 'Retry', retryable: true } }).success).toBe(true);
  });
});

describe('verified report contract', () => {
  it('accepts only an identity request and a complete immutable authoritative snapshot', () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    expect(ReportSaveRequestSchema.safeParse({ version: 1, runId }).success).toBe(true);
    expect(ReportSaveRequestSchema.safeParse({ version: 1, runId, destination: '/forged.xlsx' }).success).toBe(false);
    expect(ReportSaveResultSchema.safeParse({ ok: true, data: { destination: '/mock/reconciliation.xlsx' } }).success).toBe(true);
    expect(ReportWorkerReceiptSchema.safeParse({ temporaryPath: '/mock/report.tmp.xlsx', sheetNames: ['Summary', 'Matched', 'Mismatched', 'Missing from Broker', 'Missing from OT-MUREX'] }).success).toBe(true);
    expect(ReportWorkerReceiptSchema.safeParse({ temporaryPath: '/mock/report.tmp.xlsx', sheetNames: ['Summary', 'Matched', 'Mismatched', 'Missing from Broker', 'Wrong'] }).success).toBe(false);
    expect(RunReportV1Schema.safeParse({ version: 1, runId, asOfDate: '2026-08-15', completedAt: '2026-08-15T00:00:00.000Z', metrics: { total: 0, matched: 0, unresolved: 0, reconciliationRate: 0, unresolvedRate: 0 }, anomaly: { kind: 'insufficient-history', currentUnresolvedRate: 0, historyCount: 0, baselineUnresolvedRate: null }, reviewProgress: { reviewedUnmatched: 0, totalUnmatched: 0 }, results: [] }).success).toBe(true);
  });
});
