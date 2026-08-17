/**
 * Browser stand-in for the Electron preload bridge, for running the renderer in a plain
 * browser (Codespaces, a shared demo link) where there is no main process.
 *
 * Only persistence is faked: reconciliation, metrics, and the anomaly check all run the
 * real domain code against the real fixtures, so behaviour matches the desktop app.
 * SQLite is replaced by localStorage; the verified report is reported, not written.
 *
 * Development only — never imported by the Electron entry point.
 */
import { seededRunHistory } from '../../fixtures/seeded-history.js';
import { settingsDefaults } from '../../fixtures/settings-defaults.js';
import { settingsTableDefinition, type SettingsRow, type SettingsTableId, type SettingsValues } from '../../src/shared/contracts/settings.js';
import { reconciliationScenarios } from '../../fixtures/reconciliation-scenarios.js';
import { reconcileTrades } from '../../src/domain/reconciliation/reconciliation.js';
import { anomalyContextFor, reconciliationMetricsFor, statusCountsFor } from '../../src/domain/metrics/reconciliation-metrics.js';
import { reconciliationBootstrapConfig } from '../../src/main/bootstrap/reconciliation-config.js';
import { ReconciliationWorkspaceSchema, type BrokerEmailDraft, type ReconciliationRunSummary, type ReconciliationWorkspace } from '../../src/shared/contracts/reconciliation.js';
import type { ReconciliationApi } from '../../src/shared/contracts/preload.js';

type StoredResult = ReconciliationWorkspace['results'][number];
interface StoredRun { runId: string; asOfDate: string; completedAt: string; results: StoredResult[] }

const storageKey = 'reconciliation.web-preview.runs';
const thresholds = reconciliationBootstrapConfig.anomalyThresholds;

// Read the seeded baseline from the same fixture the database seeds, so it cannot drift.
const seededUnresolvedRates = seededRunHistory.map((entry) => entry.unresolvedRate);

function loadRuns(): StoredRun[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as StoredRun[] : [];
  } catch { return []; }
}

function saveRuns(runs: readonly StoredRun[]): void {
  try { window.localStorage.setItem(storageKey, JSON.stringify(runs)); } catch { /* preview state is best-effort */ }
}

function workspaceOf(run: StoredRun): ReconciliationWorkspace {
  const metrics = reconciliationMetricsFor(run.results.map((result) => result.status));
  const unmatched = run.results.filter((result) => result.status === 'unmatched');
  return ReconciliationWorkspaceSchema.parse({
    runId: run.runId, asOfDate: run.asOfDate, completedAt: run.completedAt, metrics,
    statusCounts: statusCountsFor(run.results.map((result) => result.status)),
    anomaly: anomalyContextFor(metrics.unresolvedRate, seededUnresolvedRates, thresholds),
    results: run.results,
    reviewProgress: { reviewedUnmatched: unmatched.filter((result) => result.reviewed).length, totalUnmatched: unmatched.length }
  });
}

function summaryOf(run: StoredRun): ReconciliationRunSummary {
  const { results: _results, ...summary } = workspaceOf(run);
  return summary as ReconciliationRunSummary;
}

/** Newest first, matching the desktop query order. */
function orderedRuns(): StoredRun[] {
  return loadRuns().sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

const ok = <T>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: 'INVALID_REQUEST' | 'RUN_NOT_FOUND' | 'RESULT_NOT_FOUND' | 'REPORT_INELIGIBLE' | 'SETTINGS_ROW_NOT_FOUND', message: string, field?: string) =>
  Promise.resolve({ ok: false as const, error: { code, message, retryable: false, ...(field ? { field } : {}) } });

/**
 * Settings mirror the desktop rules: seeded once from the shared fixture, validated
 * against the same table definition, and every mutation answers with the reloaded table.
 */
const settingsStorageKey = 'reconciliation.web-preview.settings';
type StoredSettings = Record<string, { nextId: number; rows: SettingsRow[] }>;

function seededSettings(): StoredSettings {
  const seeded: StoredSettings = {};
  for (const table of Object.keys(settingsDefaults) as SettingsTableId[]) {
    seeded[table] = { nextId: settingsDefaults[table].length + 1, rows: settingsDefaults[table].map((row, index) => ({ id: index + 1, values: { ...row.values } })) };
  }
  return seeded;
}

function loadSettings(): StoredSettings {
  try {
    const raw = window.localStorage.getItem(settingsStorageKey);
    if (!raw) return seededSettings();
    const parsed = JSON.parse(raw) as StoredSettings;
    // A table added since the last visit falls back to its shipped defaults.
    return { ...seededSettings(), ...parsed };
  } catch { return seededSettings(); }
}

function saveSettings(settings: StoredSettings): void {
  try { window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings)); } catch { /* preview state is best-effort */ }
}

function validatedSettingsValues(table: SettingsTableId, values: SettingsValues): SettingsValues | string {
  const definition = settingsTableDefinition(table);
  const allowed = new Set(definition.columns.map((column) => column.id));
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length > 0) return `Unknown ${definition.label} column: ${unknown.join(', ')}.`;
  const missing = definition.columns.filter((column) => (values[column.id] ?? '').trim() === '');
  if (missing.length > 0) return `${missing.map((column) => column.label).join(', ')} cannot be empty.`;
  return Object.fromEntries(definition.columns.map((column) => [column.id, values[column.id]!.trim()]));
}

function mutate(runId: string, resultId: string, change: (result: StoredResult) => StoredResult, eligible: (result: StoredResult) => boolean) {
  const runs = loadRuns();
  const run = runs.find((candidate) => candidate.runId === runId);
  if (!run) return { outcome: 'run-missing' as const };
  const target = run.results.find((candidate) => candidate.id === resultId);
  if (!target) return { outcome: 'result-missing' as const };
  if (!eligible(target)) return { outcome: 'not-eligible' as const };
  run.results = run.results.map((result) => result.id === resultId ? change(result) : result);
  saveRuns(runs);
  return { outcome: 'saved' as const, workspace: workspaceOf(run) };
}

export function installMockBridge(): void {
  const api: ReconciliationApi = {
    dashboard: {
      get() {
        const latest = orderedRuns()[0];
        return ok({ summary: latest ? summaryOf(latest) : null });
      }
    },
    reconciliation: {
      run(asOfDate) {
        const scenario = reconciliationScenarios.find(asOfDate);
        if (!scenario) return fail('INVALID_REQUEST', 'No seeded data for this date.', 'asOfDate');
        const results = reconcileTrades(scenario.brokerTrades, scenario.otMurexTrades)
          .map((result) => ({ ...result, reviewed: false, comment: null, mismatchReason: null })) as StoredResult[];
        const run: StoredRun = { runId: crypto.randomUUID(), asOfDate, completedAt: new Date().toISOString(), results };
        saveRuns([...loadRuns(), run]);
        return ok({ workspace: workspaceOf(run) });
      },
      onProgress() { return () => undefined; }
    },
    runs: {
      list() { return ok({ runs: orderedRuns().map(summaryOf) }); },
      getWorkspace(runId) {
        const run = loadRuns().find((candidate) => candidate.runId === runId);
        return run ? ok({ workspace: workspaceOf(run) }) : fail('RUN_NOT_FOUND', 'This run is no longer available.');
      },
      reviewResult(runId, resultId) {
        const outcome = mutate(runId, resultId, (result) => ({ ...result, reviewed: true }), (result) => result.status === 'unmatched');
        if (outcome.outcome === 'saved') return ok({ workspace: outcome.workspace });
        if (outcome.outcome === 'not-eligible') return fail('INVALID_REQUEST', 'Only unmatched results can be reviewed.', 'resultId');
        return fail('RESULT_NOT_FOUND', 'This result is no longer available.');
      },
      saveComment(runId, resultId, comment) {
        const outcome = mutate(runId, resultId, (result) => ({ ...result, comment: comment === '' ? null : comment }), (result) => result.status !== 'matched');
        if (outcome.outcome === 'saved') return ok({ workspace: outcome.workspace });
        if (outcome.outcome === 'not-eligible') return fail('INVALID_REQUEST', 'Comments are only available for unresolved results.', 'resultId');
        return fail('RESULT_NOT_FOUND', 'This result is no longer available.');
      },
      saveMismatchReason(runId, resultId, mismatchReason) {
        const outcome = mutate(runId, resultId, (result) => ({ ...result, mismatchReason: mismatchReason.trim() === '' ? null : mismatchReason }), (result) => result.status !== 'matched');
        if (outcome.outcome === 'saved') return ok({ workspace: outcome.workspace });
        if (outcome.outcome === 'not-eligible') return fail('INVALID_REQUEST', 'Mismatch reasons are only available for unresolved results.', 'resultId');
        return fail('RESULT_NOT_FOUND', 'This result is no longer available.');
      },
      previewBrokerEmail(runId, resultId) {
        const run = loadRuns().find((candidate) => candidate.runId === runId);
        const target = run?.results.find((candidate) => candidate.id === resultId);
        if (!run || !target) return fail('RESULT_NOT_FOUND', 'This result is no longer available.');
        if (target.status !== 'unmatched') return fail('INVALID_REQUEST', 'Only broker-backed unmatched results can be previewed.', 'resultId');
        const contact = target.brokerTrade?.brokerContact;
        if (!contact) return fail('INVALID_REQUEST', 'Broker details are unavailable for this result.', 'resultId');
        // Same scoping rule as the desktop query: every unmatched trade for this broker.
        const rows = run.results
          .filter((result) => result.status === 'unmatched' && result.brokerTrade?.brokerContact?.recipient === contact.recipient)
          .map((result) => ({
            tradeId: result.brokerTrade!.tradeId, isin: result.brokerTrade!.isin, buySell: result.brokerTrade!.buySell,
            amount: result.brokerTrade!.amount, quantity: result.brokerTrade!.quantity, currency: result.brokerTrade!.currency,
            settlementDate: result.brokerTrade!.settlementDate, mismatchReason: result.reason ?? 'amount-mismatch', comment: result.comment
          }));
        const draft: BrokerEmailDraft = {
          status: 'Draft', brokerName: contact.name, recipient: contact.recipient,
          subject: `Follow-up: unmatched trades for ${contact.name}`,
          body: `Dear ${contact.name} Operations,\n\nPlease review the unmatched trades listed below and confirm the appropriate resolution.\n\nKind regards,\nReconciliation Operations`,
          rows
        };
        return ok({ draft });
      },
      saveReport(runId) {
        const run = loadRuns().find((candidate) => candidate.runId === runId);
        if (!run) return fail('RUN_NOT_FOUND', 'This run is no longer available.');
        const unmatched = run.results.filter((result) => result.status === 'unmatched');
        const outstanding = unmatched.length - unmatched.filter((result) => result.reviewed).length;
        if (outstanding > 0) return fail('REPORT_INELIGIBLE', `${outstanding} unmatched results remain to review before saving the verified report.`);
        // No workbook is written in the browser preview; the desktop build produces the real file.
        return ok({ destination: `/mock-output/reconciliation-${run.asOfDate}-${run.runId}.xlsx (browser preview — no file written)` });
      }
    },
    settings: {
      list(table) {
        return ok({ table, rows: loadSettings()[table]!.rows });
      },
      create(table, values) {
        const validated = validatedSettingsValues(table, values);
        if (typeof validated === 'string') return fail('INVALID_REQUEST', validated);
        const settings = loadSettings();
        const store = settings[table]!;
        store.rows = [...store.rows, { id: store.nextId, values: validated }];
        store.nextId += 1;
        saveSettings(settings);
        return ok({ table, rows: store.rows });
      },
      update(table, id, values) {
        const validated = validatedSettingsValues(table, values);
        if (typeof validated === 'string') return fail('INVALID_REQUEST', validated);
        const settings = loadSettings();
        const store = settings[table]!;
        if (!store.rows.some((row) => row.id === id)) return fail('SETTINGS_ROW_NOT_FOUND', 'This settings row is no longer available.');
        store.rows = store.rows.map((row) => row.id === id ? { id, values: validated } : row);
        saveSettings(settings);
        return ok({ table, rows: store.rows });
      },
      remove(table, id) {
        const settings = loadSettings();
        const store = settings[table]!;
        if (!store.rows.some((row) => row.id === id)) return fail('SETTINGS_ROW_NOT_FOUND', 'This settings row is no longer available.');
        store.rows = store.rows.filter((row) => row.id !== id);
        saveSettings(settings);
        return ok({ table, rows: store.rows });
      }
    }
  };
  window.reconciliation = api;
}
