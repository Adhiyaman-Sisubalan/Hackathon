import type { SeedFixture } from '../src/main/modules/runs/runs-service.js';
import { seededRunHistory } from './seeded-history.js';

/** Fixed operational history is distinct from user runs and reruns. */
export const initialSeed: SeedFixture = {
  version: 'summary-history-v1',
  apply(database) {
    database.replaceSeededHistory('summary-history-v1', seededRunHistory);
  }
};
