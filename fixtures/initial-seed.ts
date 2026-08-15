import type { SeedFixture } from '../src/main/modules/runs/runs-service.js';

/** Fixed operational history is distinct from user runs and reruns. */
export const initialSeed: SeedFixture = {
  version: 'summary-history-v1',
  apply(database) {
    database.replaceSeededHistory('summary-history-v1', [
      seededRun('history-01', '2026-08-08', 100, 90),
      seededRun('history-02', '2026-08-09', 100, 88),
      seededRun('history-03', '2026-08-10', 100, 91),
      seededRun('history-04', '2026-08-11', 100, 87),
      seededRun('history-05', '2026-08-12', 100, 89)
    ]);
  }
};

function seededRun(historyKey: string, asOfDate: string, total: number, matched: number) {
  const unresolved = total - matched;
  return {
    historyKey,
    asOfDate,
    completedAt: `${asOfDate}T18:00:00.000Z`,
    total,
    matched,
    unresolved,
    reconciliationRate: matched / total,
    unresolvedRate: unresolved / total
  };
}
