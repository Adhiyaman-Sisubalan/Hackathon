import { parentPort, workerData } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { ReportWorkerReceiptSchema, RunReportV1Schema, type RunReportV1 } from '../../shared/contracts/reconciliation.js';

const requiredSheets = ['Summary', 'Matched', 'Unmatched', 'Missing from Broker', 'Missing from OT-MUREX'] as const;
const resultHeaders = ['Result ID', 'Status', 'Reason', 'Reviewed', 'Comment', 'Broker trade ID', 'Broker ISIN', 'Broker buy/sell', 'Broker amount', 'Broker quantity', 'Broker currency', 'Broker settlement date', 'Broker price', 'OT-MUREX trade ID', 'OT-MUREX ISIN', 'OT-MUREX buy/sell', 'OT-MUREX amount', 'OT-MUREX quantity', 'OT-MUREX currency', 'OT-MUREX settlement date', 'OT-MUREX price'] as const;

interface WorkerRequest { readonly snapshot: RunReportV1; readonly temporaryPath: string; }

async function writeReport({ snapshot: unsafeSnapshot, temporaryPath }: WorkerRequest) {
  const snapshot = RunReportV1Schema.parse(unsafeSnapshot);
  const workbook = new ExcelJS.Workbook();
  const summaryRows: ReadonlyArray<readonly [string, string | number]> = [
    ['Run ID', snapshot.runId], ['As-of date', snapshot.asOfDate], ['Completed at', snapshot.completedAt],
    ['Total', snapshot.metrics.total], ['Matched', snapshot.metrics.matched], ['Unresolved', snapshot.metrics.unresolved],
    ['Reconciliation rate', snapshot.metrics.reconciliationRate], ['Unresolved rate', snapshot.metrics.unresolvedRate],
    ['Unmatched reviewed', snapshot.reviewProgress.reviewedUnmatched], ['Unmatched total', snapshot.reviewProgress.totalUnmatched],
    ['Anomaly', snapshot.anomaly.kind], ['Anomaly history count', snapshot.anomaly.historyCount], ['Anomaly current unresolved rate', snapshot.anomaly.currentUnresolvedRate],
    ['Anomaly baseline unresolved rate', snapshot.anomaly.baselineUnresolvedRate ?? 'Not available']
  ];
  workbook.addWorksheet('Summary').addRows(summaryRows.map(([label, value]) => [label, value]));
  const sheets: ReadonlyArray<[typeof requiredSheets[number], RunReportV1['results']]> = [
    ['Matched', snapshot.results.filter((item: RunReportV1['results'][number]) => item.status === 'matched')],
    ['Unmatched', snapshot.results.filter((item: RunReportV1['results'][number]) => item.status === 'unmatched')],
    ['Missing from Broker', snapshot.results.filter((item: RunReportV1['results'][number]) => item.status === 'missing-from-broker')],
    ['Missing from OT-MUREX', snapshot.results.filter((item: RunReportV1['results'][number]) => item.status === 'missing-from-ot-murex')]
  ];
  for (const [name, results] of sheets) addResultSheet(workbook.addWorksheet(name), results);
  await workbook.xlsx.writeFile(temporaryPath);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.readFile(temporaryPath);
  const sheetNames = reopened.worksheets.map((sheet) => sheet.name);
  if (sheetNames.length !== requiredSheets.length || requiredSheets.some((name, index) => sheetNames[index] !== name)) throw new Error('Workbook did not reopen with the required sheets.');
  validateReopenedWorkbook(reopened, summaryRows, sheets);
  return ReportWorkerReceiptSchema.parse({ temporaryPath, sheetNames });
}

function addResultSheet(sheet: ExcelJS.Worksheet, results: RunReportV1['results']) {
  sheet.addRow(resultHeaders);
  for (const result of results) sheet.addRow([
    result.id, result.status, result.reason ?? '', result.reviewed ? 'Reviewed' : 'Not reviewed', result.comment ?? '',
    result.brokerTrade?.tradeId ?? '', result.brokerTrade?.isin ?? '', result.brokerTrade?.buySell ?? '', result.brokerTrade?.amount ?? '', result.brokerTrade?.quantity ?? '', result.brokerTrade?.currency ?? '', result.brokerTrade?.settlementDate ?? '', result.brokerTrade?.price ?? '',
    result.otMurexTrade?.tradeId ?? '', result.otMurexTrade?.isin ?? '', result.otMurexTrade?.buySell ?? '', result.otMurexTrade?.amount ?? '', result.otMurexTrade?.quantity ?? '', result.otMurexTrade?.currency ?? '', result.otMurexTrade?.settlementDate ?? '', result.otMurexTrade?.price ?? ''
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 18; });
}

function validateReopenedWorkbook(workbook: ExcelJS.Workbook, summaryRows: ReadonlyArray<readonly [string, string | number]>, sheets: ReadonlyArray<[typeof requiredSheets[number], RunReportV1['results']]>): void {
  const summary = workbook.getWorksheet('Summary');
  if (!summary) throw new Error('Workbook is missing Summary.');
  for (const [index, [label, value]] of summaryRows.entries()) {
    const row = summary.getRow(index + 1);
    if (row.getCell(1).value !== label || row.getCell(2).value !== value) throw new Error('Workbook Summary does not match the report snapshot.');
  }
  for (const [name, results] of sheets) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet || sheet.actualRowCount !== results.length + 1) throw new Error(`Workbook ${name} row count does not match the report snapshot.`);
    for (const [index, header] of resultHeaders.entries()) {
      if (sheet.getRow(1).getCell(index + 1).value !== header) throw new Error(`Workbook ${name} headers are invalid.`);
    }
    if (results.length > 0) {
      const first = results[0]!;
      const row = sheet.getRow(2);
      if (row.getCell(1).value !== first.id || row.getCell(2).value !== first.status || row.getCell(5).value !== (first.comment ?? '')) throw new Error(`Workbook ${name} evidence does not match the report snapshot.`);
    }
  }
}

void writeReport(workerData as WorkerRequest).then(
  (receipt) => parentPort?.postMessage({ ok: true, receipt }),
  () => parentPort?.postMessage({ ok: false })
);
