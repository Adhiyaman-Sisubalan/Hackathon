import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { bootstrapApplication } from './bootstrap/application.js';
import { createSecureWindow } from './bootstrap/window.js';
import { SqliteDatabase } from './adapters/sqlite/database.js';
import { RunsService } from './modules/runs/runs-service.js';
import { initialSeed } from '../../fixtures/initial-seed.js';
import { isTrustedRendererSender, registerDashboardHandlers, type DashboardQuery } from './ipc/dashboard.js';
import type { Migration } from './adapters/sqlite/database.js';

const currentDirectory = __dirname;
const preloadPath = path.join(currentDirectory, 'preload.js');
const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? `file://${path.join(currentDirectory, '../renderer/main_window/index.html')}`;
const userDataDirectory = process.env.RECONCILIATION_USER_DATA;

if (userDataDirectory) app.setPath('userData', userDataDirectory);

function migrations(): Migration[] {
  const packagedMigration = path.join(process.resourcesPath, 'migrations/001-initial.sql');
  const applicationMigration = path.join(app.getAppPath(), 'migrations/001-initial.sql');
  const developmentMigration = path.resolve(currentDirectory, '../../migrations/001-initial.sql');
  const migration = [packagedMigration, applicationMigration, developmentMigration].find(existsSync);
  if (!migration) throw new Error('The initial database migration is unavailable.');
  return [{ version: 1, sql: readFileSync(migration, 'utf8') }];
}

app.whenReady().then(async () => {
  let dashboard: DashboardQuery;
  try {
    const database = new SqliteDatabase({ path: path.join(app.getPath('userData'), 'reconciliation.sqlite') });
    const runs = new RunsService(database, initialSeed);
    bootstrapApplication({ migrate: () => runs.migrate(migrations()), seed: () => runs.seed(), latestSummary: () => runs.latestSummary() });
    dashboard = runs;
  } catch {
    dashboard = { latestSummary: () => { throw new Error('Dashboard bootstrap failed.'); } };
  }
  registerDashboardHandlers(ipcMain, dashboard, (event) => isTrustedRendererSender(event, rendererUrl));
  await createSecureWindow(BrowserWindow, preloadPath, rendererUrl);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createSecureWindow(BrowserWindow, preloadPath, rendererUrl); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
