import type { SeedFixture } from '../src/main/modules/runs/runs-service.js';

/** Story 1.1 deliberately seeds no completed reconciliation; Story 1.2 owns run data. */
export const initialSeed: SeedFixture = {
  version: 'initial-v1',
  apply() { /* Records seed lifecycle without inventing a reconciliation result. */ }
};
