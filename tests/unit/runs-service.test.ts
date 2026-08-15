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
});
