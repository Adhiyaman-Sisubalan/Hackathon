import { describe, expect, it } from 'vitest';
import { DashboardGetRequestSchema, DashboardGetResultSchema } from '../../src/shared/contracts/dashboard.js';
import { ResultCommentSaveRequestSchema, ResultCommentSaveResultSchema } from '../../src/shared/contracts/reconciliation.js';

describe('dashboard contract', () => {
  it('accepts only the versioned request and safe result envelope', () => {
    expect(DashboardGetRequestSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(DashboardGetRequestSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(DashboardGetResultSchema.safeParse({ ok: false, error: { code: 'QUERY_FAILED', message: 'Unavailable', retryable: true } }).success).toBe(true);
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
