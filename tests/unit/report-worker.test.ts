import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { RunReportV1Schema } from '../../src/shared/contracts/reconciliation.js';
import { reportRowValues, reportSheetsFor, resultHeaders, summaryRowsFor, validateReopenedWorkbook } from '../../src/main/workers/report-worker.js';

const snapshot = RunReportV1Schema.parse({
  version: 1,
  runId: '11111111-1111-4111-8111-111111111111',
  asOfDate: '2026-08-15',
  completedAt: '2026-08-15T00:00:00.000Z',
  metrics: { total: 2, matched: 0, unresolved: 2, reconciliationRate: 0, unresolvedRate: 1 },
  anomaly: { kind: 'warning', currentUnresolvedRate: 1, historyCount: 5, baselineUnresolvedRate: .1 },
  reviewProgress: { reviewedUnmatched: 2, totalUnmatched: 2 },
  results: [
    { id: 'first', status: 'unmatched', reason: 'amount-mismatch', reviewed: true, comment: 'First comment', brokerTrade: { source: 'broker', tradeId: 'BRK-1', isin: 'US0000000001', buySell: 'buy', currency: 'USD', settlementDate: '2026-08-15', amount: '10.10', quantity: '2', price: '5.05' }, otMurexTrade: { source: 'ot-murex', tradeId: 'OT-1', isin: 'US0000000001', buySell: 'buy', currency: 'USD', settlementDate: '2026-08-15', amount: '10.00', quantity: '2', price: '5.00' } },
    { id: 'second', status: 'unmatched', reason: 'quantity-mismatch', reviewed: true, comment: 'Second comment', brokerTrade: { source: 'broker', tradeId: 'BRK-2', isin: 'GB0000000002', buySell: 'sell', currency: 'GBP', settlementDate: '2026-08-16', amount: '31.250', quantity: '5.5', price: '5.681818' }, otMurexTrade: { source: 'ot-murex', tradeId: 'OT-2', isin: 'GB0000000002', buySell: 'sell', currency: 'GBP', settlementDate: '2026-08-16', amount: '31.250', quantity: '5', price: '6.250' } }
  ]
});

function completeWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Summary').addRows(summaryRowsFor(snapshot).map(([label, value]) => [label, value]));
  for (const [name, results] of reportSheetsFor(snapshot)) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(resultHeaders);
    for (const result of results) sheet.addRow([...reportRowValues(result)]);
  }
  return workbook;
}

describe('reopened report workbook validation', () => {
  it('accepts every authoritative result row and rejects corruption in later trade evidence', () => {
    const workbook = completeWorkbook();
    const summaryRows = summaryRowsFor(snapshot);
    const sheets = reportSheetsFor(snapshot);
    expect(() => validateReopenedWorkbook(workbook, summaryRows, sheets)).not.toThrow();

    workbook.getWorksheet('Mismatched')!.getRow(3).getCell(13).value = 'corrupted-price';
    expect(() => validateReopenedWorkbook(workbook, summaryRows, sheets)).toThrow('Workbook Mismatched evidence does not match the report snapshot.');
  });
});
