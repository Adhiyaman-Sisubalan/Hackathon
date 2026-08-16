---
title: 'Enforce Review Completion and Save the Verified Report'
type: 'feature'
created: '2026-08-16'
status: 'done'
baseline_commit: 'afc8b37dafa2d8b94bc45e297218214611feb143'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-2-preview-broker-follow-up-emails.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An operator can investigate results but cannot prove that every unmatched exception received review or save a trustworthy final report. Exporting from renderer state could bypass the review gate or produce a workbook that does not reflect the authoritative Run.

**Approach:** Add a main-authoritative report-save command that takes one immutable, transaction-consistent `RunReportV1` snapshot after the unmatched-review gate passes. Generate and reopen-validate the workbook in a constrained worker, then atomically publish it under a collision-safe filename while leaving the active investigation untouched.

## Boundaries & Constraints

**Always:** Derive the disabled state and exact outstanding unmatched count from workspace review progress, but re-check in main. Only `unmatched` Results require review; missing-record statuses never satisfy the gate and zero unmatched Results are eligible. Build, Zod-validate, and freeze `RunReportV1` from the same SQLite read transaction; retain normalized decimal strings. Generate exactly Summary, Matched, Unmatched, Missing from Broker, and Missing from OT-MUREX. Summary contains Run identity/date, metrics, review progress, and anomaly; result sheets contain available trade evidence, status, reason, reviewed state, and comment. Worker receives only validated snapshot data and an operation-specific temp path, reopens the workbook to validate it, and returns a typed receipt. Main alone owns output directory, receipt/existence verification, collision handling, atomic rename, and cleanup of only that temp artifact. Preserve Run and investigation state across success/failure; show destination and Retry for retryable failures.

**Ask First:** Changing the configured mock-output location or report filename base, adding exports other than `.xlsx`, broadening report access outside the main-authoritative command, changing the required sheets/content, or storing/exporting user preferences.

**Never:** Permit renderer-supplied results, review counts, comments, paths, or destination; mark Results reviewed while saving; block Electron's main event loop; expose a database handle, final path, or directory discovery to the worker; overwrite, delete, or alter an existing final report; alter Run/filter/selection/comment/review state because reporting succeeds or fails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Review gate | Run has outstanding unmatched Results | Save is disabled and states the exact remaining count; main returns an ineligible typed failure if invoked anyway | No workbook or report state change |
| Eligible save | All unmatched Results reviewed, including zero unmatched | One immutable authoritative snapshot yields a validated five-sheet workbook published as `reconciliation-YYYY-MM-DD-{runId}.xlsx` in mock output | Success politely announces the complete destination without replacing workspace |
| Existing destination | The base filename already exists | Main selects a deterministic no-clobber suffix and atomically publishes one new final file | Existing file remains byte-for-byte untouched |
| Worker/write failure | Worker rejects data, validation, receipt, or publish fails | Main removes only the operation temp artifact; context remains and assertive Retry is available | Retry uses fresh authoritative state |
| Stale/tampered request | Invalid payload, missing Run, or review changes before preparation | IPC validates sender/request and main rejects using typed non-retryable/retryable envelope as appropriate | No final file is published |

</frozen-after-approval>

## Code Map

- `src/shared/contracts/reconciliation.ts` -- add report/worker schemas beside `BrokerPreview*` and `ReconciliationChannels`; preserve decimal-string trade fields.
- `src/main/adapters/sqlite/database.ts` -- add preparation beside `workspaceSnapshotForRun()` / `reviewProgressForRun()` so the gate and hydrated report use one transaction.
- `src/main/modules/runs/runs-service.ts`, `src/main/index.ts`, and `src/main/workers/*` -- extend `RunsService`, composition, and a worker with output/worker/filesystem ports, constrained ExcelJS work, receipt verification, cleanup, and publication.
- `src/main/ipc/reconciliation.ts`, `src/shared/contracts/preload.ts`, `src/preload/index.ts`, and `src/preload/global.d.ts` -- follow `saveResultComment` / `previewBrokerEmail` validation and expose only `runs.saveReport(runId)`.
- `forge.config.ts` and `vite.main.config.ts` -- bundle the worker for packaged execution.
- `src/renderer/features/results/Results.tsx`, `Results.module.css`, and `src/renderer/components/SummaryStrip.tsx` -- use `workspaceMutationQueue` and review progress for serialized accessible report UI while retaining context.
- `tests/unit/contracts.test.ts`, `tests/integration/*`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- extend Story 3.1/3.2 seams (including the mutation-queue test) for authority, publish, preservation, and packaged reopen.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/contracts/reconciliation.ts` and `src/main/adapters/sqlite/database.ts` -- define immutable report contracts and a reviewed-eligible transactional snapshot -- prevent split-state exports and forged eligibility.
- [x] `src/main/modules/runs/*`, `src/main/workers/*`, `src/main/index.ts`, `forge.config.ts`, and `vite.main.config.ts` -- implement injected off-main-thread Excel generation/reopen validation, receipt checks, cleanup, and no-clobber atomic publication -- make output durable without blocking UI.
- [x] `src/main/ipc/reconciliation.ts`, `src/preload/*`, and `src/renderer/features/results/*` -- add the narrow bridge and accessible serialized report control, gate/count, status, and retry while retaining context -- complete the safe operator flow.
- [x] `tests/unit/contracts.test.ts`, `tests/integration/*`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- cover matrix cases, immutability, collision/cleanup, preservation, and packaged reopen -- prove authority and output guarantees.

**Acceptance Criteria:**
- Given an active Run with unmatched Results still unreviewed, when report saving is viewed or invoked, then it reports the exact outstanding count and main refuses to publish.
- Given every unmatched Result is reviewed (or none exist), when Save verified report completes, then an immutable Run-consistent report is validated off the main thread and atomically appears as a collision-safe `.xlsx` with all five required sheets.
- Given comments, anomaly data, missing records, and matched Results exist, when the report is produced, then its Summary and result sheets contain the authoritative persisted fields without a renderer-derived discrepancy.
- Given generation, validation, receipt verification, or publish fails, when the typed outcome returns, then only the operation temporary artifact is removed and investigation context is unchanged with Retry available.
- Given a keyboard or assistive-technology user saves or encounters a failure, when feedback changes, then status is understandable without color alone and focus remains in the current Results context.

## Design Notes

The review count shown by the renderer is an affordance, not a permission boundary. The database transaction produces the single report truth; the worker can only transform that truth into a private temporary workbook. Main chooses and publishes the final path after validation, so neither a stale UI nor worker behavior can overwrite a report.

## Verification

**Commands:**
- `npm run lint` -- expected: main, preload, renderer, worker, and test TypeScript checks pass.
- `npm test` -- expected: contract, SQLite transaction/gate, IPC, worker/publish, collision, cleanup, and renderer state/accessibility tests pass.
- `npm run test:e2e` -- expected: packaged Electron flow reviews all unmatched Results, saves a physical valid workbook, and proves no-clobber publishing.

## Suggested Review Order

**Authoritative publication**

- Starts report work with a fresh transactional snapshot and retains ownership of final publication.
  [`runs-service.ts:69`](../../src/main/modules/runs/runs-service.ts#L69)

- Builds the frozen snapshot and rechecks unmatched-review eligibility in one SQLite transaction.
  [`database.ts:178`](../../src/main/adapters/sqlite/database.ts#L178)

- Wires the worker and configured mock-output location only in Electron main.
  [`index.ts:36`](../../src/main/index.ts#L36)

**Workbook boundary**

- Validates snapshot input, reopens generated workbooks, and checks persisted report evidence.
  [`report-worker.ts:10`](../../src/main/workers/report-worker.ts#L10)

- Exposes the report command through sender-validated, typed IPC only.
  [`reconciliation.ts:86`](../../src/main/ipc/reconciliation.ts#L86)

**Operator flow**

- Serializes report saves with workspace mutations and preserves Results context across outcomes.
  [`Results.tsx:313`](../../src/renderer/features/results/Results.tsx#L313)

**Verification and packaging**

- Proves gate, collision, cleanup, zero-unmatched, and malformed-worker behavior.
  [`reconciliation-runs.test.ts:286`](../../tests/integration/reconciliation-runs.test.ts#L286)

- Exercises packaged Electron report creation, content, reopening, and no-clobber suffixes.
  [`electron.acceptance.ts:82`](../../tests/e2e/electron.acceptance.ts#L82)

- Packages the dedicated worker alongside Electron main and preload bundles.
  [`forge.config.ts:9`](../../forge.config.ts#L9)

## Suggested Review Order

**Authoritative report publication**

- Starts from a fresh gated snapshot and atomically publishes only validated output.
  [`runs-service.ts:69`](../../src/main/modules/runs/runs-service.ts#L69)

- Derives eligibility and immutable report truth within one SQLite transaction.
  [`database.ts:179`](../../src/main/adapters/sqlite/database.ts#L179)

**Workbook isolation and validation**

- Builds and reopens the five-sheet workbook without blocking Electron main.
  [`report-worker.ts:10`](../../src/main/workers/report-worker.ts#L10)

- Compares every reopened report row against the authoritative snapshot.
  [`report-worker.ts:61`](../../src/main/workers/report-worker.ts#L61)

**Secure operator command**

- Restricts the report action to a validated sender and identity-only request.
  [`reconciliation.ts:86`](../../src/main/ipc/reconciliation.ts#L86)

- Applies main-authoritative outstanding-review feedback without resetting investigation context.
  [`Results.tsx:321`](../../src/renderer/features/results/Results.tsx#L321)

**Verification and packaging**

- Proves later-row evidence corruption cannot pass report validation.
  [`report-worker.test.ts:31`](../../tests/unit/report-worker.test.ts#L31)

- Exercises save, reopen, collision-safe publication, and Run reopening end to end.
  [`electron.acceptance.ts:82`](../../tests/e2e/electron.acceptance.ts#L82)
