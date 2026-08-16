/**
 * Fixed operational history behind the anomaly baseline, kept free of any main-process
 * imports so both the SQLite seed and the browser preview can read the same numbers.
 */
export interface SeededRunHistoryEntry {
  readonly historyKey: string;
  readonly asOfDate: string;
  readonly completedAt: string;
  readonly total: number;
  readonly matched: number;
  readonly unresolved: number;
  readonly reconciliationRate: number;
  readonly unresolvedRate: number;
}

function seededRun(historyKey: string, asOfDate: string, total: number, matched: number): SeededRunHistoryEntry {
  const unresolved = total - matched;
  return { historyKey, asOfDate, completedAt: `${asOfDate}T18:00:00.000Z`, total, matched, unresolved, reconciliationRate: matched / total, unresolvedRate: unresolved / total };
}

export const seededRunHistory: readonly SeededRunHistoryEntry[] = [
  seededRun('history-01', '2026-08-08', 100, 90),
  seededRun('history-02', '2026-08-09', 100, 88),
  seededRun('history-03', '2026-08-10', 100, 91),
  seededRun('history-04', '2026-08-11', 100, 87),
  seededRun('history-05', '2026-08-12', 100, 89)
];
