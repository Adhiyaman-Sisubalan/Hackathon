import { describe, expect, it } from 'vitest';
import { bootstrapApplication } from '../../src/main/bootstrap/application.js';

describe('bootstrap application', () => {
  it('runs migrations before the one-time seed', () => {
    const calls: string[] = [];
    bootstrapApplication({ migrate: () => calls.push('migrate'), seed: () => calls.push('seed'), latestSummary: () => null });
    expect(calls).toEqual(['migrate', 'seed']);
  });

  it('runs a one-time seed after migration for a first launch', () => {
    const calls: string[] = [];
    let seeded = false;
    bootstrapApplication({
      migrate: () => calls.push('migrate'),
      seed: () => { if (!seeded) { seeded = true; calls.push('seed'); } },
      latestSummary: () => null
    });
    bootstrapApplication({
      migrate: () => calls.push('migrate'),
      seed: () => { if (!seeded) { seeded = true; calls.push('seed'); } },
      latestSummary: () => null
    });
    expect(calls).toEqual(['migrate', 'seed', 'migrate']);
  });
});
