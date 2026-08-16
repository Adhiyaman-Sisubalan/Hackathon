import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import ExcelJS from 'exceljs';

const userData = mkdtempSync(path.join(tmpdir(), 'reconciliation-e2e-'));
const reportOutput = path.join(userData, 'mock-output');
const packagedExecutable = path.resolve('out/reconciliation-desktop-darwin-arm64/reconciliation-desktop.app/Contents/MacOS/reconciliation-desktop');

async function assertReportWorkbook(filename: string, runId: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(reportOutput, filename));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Summary', 'Matched', 'Unmatched', 'Missing from Broker', 'Missing from OT-MUREX']);
  const summary = workbook.getWorksheet('Summary');
  const unmatched = workbook.getWorksheet('Unmatched');
  const matched = workbook.getWorksheet('Matched');
  const missingBroker = workbook.getWorksheet('Missing from Broker');
  const missingOtMurex = workbook.getWorksheet('Missing from OT-MUREX');
  assert.ok(summary && unmatched && matched && missingBroker && missingOtMurex);
  assert.equal(summary.getCell(1, 1).value, 'Run ID');
  assert.equal(summary.getCell(1, 2).value, runId);
  assert.equal(summary.getCell(2, 1).value, 'As-of date');
  assert.equal(summary.getCell(2, 2).value, '2026-08-15');
  assert.equal(summary.getCell(10, 2).value, 2);
  assert.equal(unmatched.getCell(1, 1).value, 'Result ID');
  assert.equal(unmatched.getCell(1, 5).value, 'Comment');
  assert.equal(unmatched.actualRowCount, 3);
  assert.equal(unmatched.getCell(2, 2).value, 'unmatched');
  assert.equal(unmatched.getCell(2, 5).value, 'Awaiting broker confirmation.');
  assert.equal(matched.actualRowCount, 3);
  assert.equal(missingBroker.actualRowCount, 2);
  assert.equal(missingOtMurex.actualRowCount, 2);
}

async function runAcceptance(): Promise<void> {
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    application = await electron.launch({
      executablePath: packagedExecutable,
      args: [],
      cwd: process.cwd(),
      env: { ...process.env, RECONCILIATION_USER_DATA: userData, RECONCILIATION_REPORT_OUTPUT: reportOutput }
    });
    const page = await application.firstWindow();
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    await page.getByText('No reconciliation has been completed yet.').waitFor();
    const run = page.getByRole('button', { name: 'Run reconciliation' });
    await run.waitFor();
    await run.click();
    await page.getByRole('heading', { name: 'Results' }).waitFor();
    await page.getByText('Status filters').waitFor();
    await page.getByRole('table').waitFor();
    await page.getByRole('button', { name: 'Amount' }).click();
    await page.getByLabel('Trade ID').check();
    await page.getByRole('columnheader', { name: 'Trade ID' }).waitFor();
    await page.getByLabel('Reconciliation summary').waitFor();
    await page.getByText('33.3%', { exact: true }).waitFor();
    await page.getByText('66.7%', { exact: true }).waitFor();
    await page.getByText(/Unresolved rate is higher than the seeded baseline/).waitFor();
    const unmatched = page.getByRole('button', { name: 'Select BRK-202' });
    await unmatched.focus();
    await page.keyboard.press('Enter');
    await page.getByText('Broker evidence').waitFor();
    await page.getByText('OT/MUREX evidence').waitFor();
    await page.getByText('1 / 2', { exact: true }).waitFor();
    const comment = page.getByRole('textbox', { name: 'Comment' });
    await comment.fill('Awaiting broker confirmation.');
    await page.getByRole('button', { name: 'Save comment' }).click();
    await page.getByText('Comment saved.').waitFor();
    const preview = page.getByRole('button', { name: 'Preview broker email' });
    await preview.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Broker email draft' }).waitFor();
    assert.equal(await page.getByLabel('Draft status').textContent(), 'Draft');
    await page.getByRole('cell', { name: 'Awaiting broker confirmation.' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send' }).count(), 0);
    await page.getByRole('button', { name: 'Back to detail' }).click();
    await preview.waitFor();
    await page.getByRole('button', { name: 'Select BRK-203' }).click();
    await page.getByText('2 / 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save verified report' }).click();
    await page.getByText(/Verified report saved to/).waitFor();
    let reports = readdirSync(reportOutput).filter((file) => file.endsWith('.xlsx')).sort();
    assert.equal(reports.length, 1);
    const firstReport = reports[0]!;
    assert.match(firstReport, /^reconciliation-2026-08-15-[0-9a-f-]{36}\.xlsx$/);
    const runId = firstReport.slice('reconciliation-2026-08-15-'.length, -'.xlsx'.length);
    await assertReportWorkbook(firstReport, runId);
    const secondReport = `${firstReport.slice(0, -'.xlsx'.length)}-1.xlsx`;
    await page.getByRole('button', { name: 'Save verified report' }).click();
    await page.getByText(`Verified report saved to ${path.join(reportOutput, secondReport)}.`, { exact: true }).waitFor();
    reports = readdirSync(reportOutput).filter((file) => file.endsWith('.xlsx')).sort();
    assert.deepEqual(new Set(reports), new Set([firstReport, secondReport]));
    await assertReportWorkbook(secondReport, runId);
    await page.setViewportSize({ width: 700, height: 900 });
    const openInspector = page.getByRole('button', { name: 'Open inspector' });
    await openInspector.click();
    await page.getByRole('heading', { name: 'Result detail' }).last().waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Open inspector');
    await page.setViewportSize({ width: 1280, height: 900 });

    const runs = page.getByRole('button', { name: 'Reconciliation Runs' });
    await runs.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Reconciliation Runs' }).waitFor();
    assert.equal(await runs.getAttribute('aria-current'), 'page');
    const historicalRun = page.getByRole('button', { name: /Open run/ }).first();
    await historicalRun.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Results' }).waitFor();
    await page.getByText('2 / 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Select BRK-202' }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Comment' }).inputValue(), 'Awaiting broker confirmation.');

    const exceptions = page.getByRole('button', { name: 'Exceptions' });
    await exceptions.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Results' }).waitFor();
    assert.equal(await page.getByLabel('Matched', { exact: true }).isChecked(), false);

    const overview = page.getByRole('button', { name: 'Overview' });
    await overview.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(await overview.getAttribute('aria-current'), 'page');
    await page.getByLabel('Reconciliation summary').waitFor();
    await page.getByText(/five-run baseline 11.0%/).waitFor();
    console.log('Playwright Electron acceptance passed: persisted summary, review state, verified no-clobber workbook reports, seeded anomaly context, Exceptions, and keyboard navigation.');
  } finally {
    await application?.close();
    rmSync(userData, { recursive: true, force: true });
  }
}

const keepAlive = setInterval(() => undefined, 1_000);
runAcceptance()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
