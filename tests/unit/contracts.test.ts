import { describe, expect, it } from 'vitest';
import { DashboardGetRequestSchema, DashboardGetResultSchema } from '../../src/shared/contracts/dashboard.js';

describe('dashboard contract', () => {
  it('accepts only the versioned request and safe result envelope', () => {
    expect(DashboardGetRequestSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(DashboardGetRequestSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(DashboardGetResultSchema.safeParse({ ok: false, error: { code: 'QUERY_FAILED', message: 'Unavailable', retryable: true } }).success).toBe(true);
  });
});
