import { Worker } from 'node:worker_threads';
import { ReportWorkerReceiptSchema, type RunReportV1, type ReportWorkerReceipt } from '../../shared/contracts/reconciliation.js';

export interface ReportWorker { generate(snapshot: RunReportV1, temporaryPath: string): Promise<ReportWorkerReceipt>; }

export function createReportWorker(workerPath: string): ReportWorker {
  return {
    generate(snapshot, temporaryPath) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const resolveOnce = (receipt: ReportWorkerReceipt) => { if (!settled) { settled = true; resolve(receipt); } };
        const rejectOnce = (error: Error) => { if (!settled) { settled = true; reject(error); } };
        const worker = new Worker(workerPath, { workerData: { snapshot, temporaryPath } });
        worker.once('message', (message: unknown) => {
          const data = message as { ok?: boolean; receipt?: unknown };
          const receipt = data.ok ? ReportWorkerReceiptSchema.safeParse(data.receipt) : undefined;
          if (receipt?.success) resolveOnce(receipt.data);
          else rejectOnce(new Error('Report workbook generation failed.'));
        });
        worker.once('error', (error) => rejectOnce(error));
        worker.once('exit', (code) => {
          if (!settled) rejectOnce(new Error(`Report worker exited without a valid receipt${code === 0 ? '' : ` (code ${code})`}.`));
        });
      });
    }
  };
}
