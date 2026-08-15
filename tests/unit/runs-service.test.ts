import { describe, expect, it, vi } from 'vitest';
import { RunsService } from '../../src/main/modules/runs/runs-service.js';

describe('runs seed lifecycle', () => {
  it('does not apply the fixture again when its version has already been seeded', () => {
    const database = { hasSeed: () => true, recordSeed: vi.fn(), latestSummary: () => null, migrate: vi.fn(), transaction: (action: () => void) => action() };
    const fixture = { version: 'initial-v1', apply: vi.fn() };
    const runs = new RunsService(database as never, fixture);
    runs.seed();
    expect(fixture.apply).not.toHaveBeenCalled();
    expect(database.recordSeed).not.toHaveBeenCalled();
  });

  it('rejects malformed injected IDs and timestamps before asking SQLite to persist', () => {
    const database = { hasSeed: () => false, recordSeed: vi.fn(), latestSummary: () => null, migrate: vi.fn(), transaction: (action: () => void) => action(), persistRun: vi.fn() };
    const scenario = { asOfDate: '2026-08-15', brokerTrades: [{ source: 'broker' as const, tradeId: 'B-1', isin: 'US0000000001', buySell: 'buy' as const, currency: 'USD', settlementDate: '2026-08-15', amount: '1', quantity: '1', price: '1' }], otMurexTrades: [] };
    const runs = new RunsService(database as never, { version: 'initial-v1', apply: vi.fn() }, { clock: { now: () => 'not-a-timestamp' }, ids: { next: () => 'not-a-uuid' }, scenarios: { find: () => scenario } });
    expect(() => runs.run('2026-08-15')).toThrow();
    expect(database.persistRun).not.toHaveBeenCalled();
  });
});
