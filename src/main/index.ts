import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { bootstrapApplication } from './bootstrap/application.js';
import { createSecureWindow } from './bootstrap/window.js';
import { SqliteDatabase } from './adapters/sqlite/database.js';
import { RunsService } from './modules/runs/runs-service.js';
import { initialSeed } from '../../fixtures/initial-seed.js';
import { reconciliationScenarios } from '../../fixtures/reconciliation-scenarios.js';
import { isTrustedRendererSender, registerDashboardHandlers, type DashboardQuery } from './ipc/dashboard.js';
import { registerReconciliationHandlers, type ReconciliationCommand } from './ipc/reconciliation.js';
import type { Migration } from './adapters/sqlite/database.js';

const currentDirectory = __dirname;
const preloadPath = path.join(currentDirectory, 'preload.js');
const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? `file://${path.join(currentDirectory, '../renderer/main_window/index.html')}`;
const userDataDirectory = process.env.RECONCILIATION_USER_DATA;

if (userDataDirectory) app.setPath('userData', userDataDirectory);

function migrations(): Migration[] {
  return ['001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql'].map((filename, index) => {
    const locations = [path.join(process.resourcesPath, 'migrations', filename), path.join(app.getAppPath(), 'migrations', filename), path.resolve(currentDirectory, '../../migrations', filename)];
    const migration = locations.find(existsSync);
    if (!migration) throw new Error(`Database migration ${filename} is unavailable.`);
    return { version: index + 1, sql: readFileSync(migration, 'utf8') };
  });
}

app.whenReady().then(async () => {
  let dashboard: DashboardQuery;
  let reconciliation: ReconciliationCommand;
  try {
    const database = new SqliteDatabase({ path: path.join(app.getPath('userData'), 'reconciliation.sqlite') });
    const runs = new RunsService(database, initialSeed, { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID }, scenarios: reconciliationScenarios });
    bootstrapApplication({ migrate: () => runs.migrate(migrations()), seed: () => runs.seed(), latestSummary: () => runs.latestSummary() });
    dashboard = runs;
    reconciliation = runs;
  } catch {
    dashboard = { latestSummary: () => { throw new Error('Dashboard bootstrap failed.'); } };
    reconciliation = {
      run: () => { throw new Error('Reconciliation bootstrap failed.'); },
      listCompletedRuns: () => { throw new Error('Reconciliation bootstrap failed.'); },
      workspaceForRun: () => { throw new Error('Reconciliation bootstrap failed.'); }
    };
  }
  registerDashboardHandlers(ipcMain, dashboard, (event) => isTrustedRendererSender(event, rendererUrl));
  registerReconciliationHandlers(ipcMain, reconciliation, (event) => isTrustedRendererSender(event, rendererUrl));
  await createSecureWindow(BrowserWindow, preloadPath, rendererUrl);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createSecureWindow(BrowserWindow, preloadPath, rendererUrl); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
