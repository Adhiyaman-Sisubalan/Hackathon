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
import { registerSettingsHandlers, type SettingsCommand } from './ipc/settings.js';
import { SettingsService } from './modules/settings/settings-service.js';
import type { Migration } from './adapters/sqlite/database.js';
import { createReportWorker } from './workers/report-worker-client.js';

const currentDirectory = __dirname;
const preloadPath = path.join(currentDirectory, 'preload.js');
const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? `file://${path.join(currentDirectory, '../renderer/main_window/index.html')}`;
const userDataDirectory = process.env.RECONCILIATION_USER_DATA;

if (userDataDirectory) app.setPath('userData', userDataDirectory);

function migrations(): Migration[] {
  return ['001-initial.sql', '002-runs-and-results.sql', '003-summary-history.sql', '004-result-review.sql', '005-result-comment.sql', '006-broker-contact.sql', '007-result-mismatch-reason.sql', '008-settings-tables.sql', '009-settings-email-validation.sql'].map((filename, index) => {
    const locations = [path.join(process.resourcesPath, 'migrations', filename), path.join(app.getAppPath(), 'migrations', filename), path.resolve(currentDirectory, '../../migrations', filename)];
    const migration = locations.find(existsSync);
    if (!migration) throw new Error(`Database migration ${filename} is unavailable.`);
    return { version: index + 1, sql: readFileSync(migration, 'utf8') };
  });
}

app.whenReady().then(async () => {
  let dashboard: DashboardQuery;
  let reconciliation: ReconciliationCommand;
  let settings: SettingsCommand;
  try {
    const database = new SqliteDatabase({ path: path.join(app.getPath('userData'), 'reconciliation.sqlite') });
    const runs = new RunsService(database, initialSeed, {
      clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID }, scenarios: reconciliationScenarios,
      reports: {
        outputDirectory: process.env.RECONCILIATION_REPORT_OUTPUT ?? path.join(app.getPath('userData'), 'mock-output'),
        worker: createReportWorker(path.join(currentDirectory, 'report-worker.js'))
      }
    });
    const settingsService = new SettingsService(database);
    bootstrapApplication({
      migrate: () => runs.migrate(migrations()),
      // Reference tables seed under their own version, after the run fixtures.
      seed: () => { runs.seed(); settingsService.seed(); },
      latestSummary: () => runs.latestSummary()
    });
    dashboard = runs;
    reconciliation = runs;
    settings = settingsService;
  } catch {
    dashboard = { latestSummary: () => { throw new Error('Dashboard bootstrap failed.'); } };
    reconciliation = {
      run: () => { throw new Error('Reconciliation bootstrap failed.'); },
      listCompletedRuns: () => { throw new Error('Reconciliation bootstrap failed.'); },
      workspaceForRun: () => { throw new Error('Reconciliation bootstrap failed.'); },
      reviewUnmatchedResult: () => { throw new Error('Reconciliation bootstrap failed.'); },
      saveResultComment: () => { throw new Error('Reconciliation bootstrap failed.'); },
      saveResultMismatchReason: () => { throw new Error('Reconciliation bootstrap failed.'); },
      previewBrokerEmail: () => { throw new Error('Reconciliation bootstrap failed.'); }
      , saveVerifiedReport: async () => { throw new Error('Reconciliation bootstrap failed.'); }
    };
    settings = {
      list: () => { throw new Error('Settings bootstrap failed.'); },
      create: () => { throw new Error('Settings bootstrap failed.'); },
      update: () => { throw new Error('Settings bootstrap failed.'); },
      remove: () => { throw new Error('Settings bootstrap failed.'); }
    };
  }
  registerDashboardHandlers(ipcMain, dashboard, (event) => isTrustedRendererSender(event, rendererUrl));
  registerReconciliationHandlers(ipcMain, reconciliation, (event) => isTrustedRendererSender(event, rendererUrl));
  registerSettingsHandlers(ipcMain, settings, (event) => isTrustedRendererSender(event, rendererUrl));
  await createSecureWindow(BrowserWindow, preloadPath, rendererUrl);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createSecureWindow(BrowserWindow, preloadPath, rendererUrl); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
