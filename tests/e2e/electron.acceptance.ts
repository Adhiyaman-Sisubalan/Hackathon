import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const userData = mkdtempSync(path.join(tmpdir(), 'reconciliation-e2e-'));
const packagedExecutable = path.resolve('out/reconciliation-desktop-darwin-arm64/reconciliation-desktop.app/Contents/MacOS/reconciliation-desktop');

async function runAcceptance(): Promise<void> {
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    application = await electron.launch({
      executablePath: packagedExecutable,
      args: [],
      cwd: process.cwd(),
      env: { ...process.env, RECONCILIATION_USER_DATA: userData }
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

    const runs = page.getByRole('button', { name: 'Reconciliation Runs' });
    await runs.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Reconciliation Runs' }).waitFor();
    assert.equal(await runs.getAttribute('aria-current'), 'page');

    const exceptions = page.getByRole('button', { name: 'Exceptions' });
    await exceptions.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Exceptions' }).waitFor();
    assert.equal(await exceptions.getAttribute('aria-current'), 'page');

    const overview = page.getByRole('button', { name: 'Overview' });
    await overview.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(await overview.getAttribute('aria-current'), 'page');
    console.log('Playwright Electron acceptance passed: seeded run, Results handoff, and keyboard navigation.');
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
