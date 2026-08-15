---
title: 'Reopen Runs and View Latest Exceptions'
type: 'feature'
created: '2026-08-15'
status: 'in-progress'
baseline_commit: 'c6b84a58f9b43b432accc54c216f6756a7092b36'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Completed runs exist but cannot be reopened, and Exceptions does not lead users directly to current unresolved work. Users must be able to resume work without rerunning reconciliation or losing historical context.

**Approach:** Add main-owned run-history queries and snapshots, expose them through typed named IPC, and complete the Runs and Exceptions destinations in the existing in-place shell.

## Boundaries & Constraints

**Always:** List completed runs newest-completed-first with Run ID, as-of date, completion time, total, matched, Unresolved, and reconciliation rate. Opening a Run loads persisted evidence/results without recomputation or creating a Run ID. Exceptions opens the latest completed run with every non-matched status selected; matched is excluded. Preserve keyboard/pointer use, typed safe failures, renderer-local state, no reload/router, and current secure IPC boundary.

**Ask First:** Changes to run ordering, persisted result identity, status vocabulary, history retention, database engine, or external synchronization.

**Never:** Reconcile again while reopening, expose raw persistence primitives to renderer code, aggregate historical analytics, implement the Epic 2 grid/detail/review experience, or fabricate a Run when history is empty.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Run history | One or more completed runs | Newest-first list with persisted summaries; activating one opens its matching Results snapshot | Query failure retains destination/focus and offers Retry |
| No history | Runs or Exceptions with no completed run | Calm, distinct empty state directs user to Overview | No fabricated Result or error |
| Latest exceptions | Completed latest run with unresolved Results | Loads latest persisted Run with non-matched filters selected | Summary remains visible |
| All resolved | Latest run has no unresolved Results | Results shows all-resolved state with summary retained | Matched Results remain available |
| Stale selection | Run deleted/reset between list and open | Typed not-found response clears stale workspace and refreshes history | Error is announced in place with Retry |

</frozen-after-approval>

## Code Map

- `src/main/modules/runs/runs-service.ts` and `src/main/adapters/sqlite/database.ts` -- extend the existing sole Run owner and persistence seam with list/hydrate queries.
- `src/shared/contracts/reconciliation.ts`, `src/main/ipc/reconciliation.ts`, `src/preload/index.ts`, and `src/main/index.ts` -- reuse typed sender-validated IPC/preload wiring.
- `src/renderer/app/App.tsx`, `src/renderer/app/app-view.ts`, and `src/renderer/features/results/Results.tsx` -- replace placeholder destinations and support Exceptions filter presets.
- `tests/integration/reconciliation-runs.test.ts`, `tests/integration/reconciliation-ipc.test.ts`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- extend current persistence, boundary, renderer, and packaged test seams.

## Tasks & Acceptance

**Execution:**
- [x] `src/main/adapters/sqlite/database.ts` and `src/main/modules/runs/runs-service.ts` -- add immutable list/latest/hydrate snapshots from persisted rows and evidence -- preserves history without recomputation.
- [x] `src/shared/contracts/reconciliation.ts`, `src/main/ipc/reconciliation.ts`, `src/main/index.ts`, `src/shared/contracts/preload.ts`, and `src/preload/index.ts` -- add `runs.list.v1` and `run.workspace.get.v1` with typed not-found/query failures -- keeps main as the only persistence boundary.
- [x] `src/renderer/app/*`, `src/renderer/features/runs/*`, and `src/renderer/features/results/*` -- build Runs/Exceptions empty, loading, retry, activation, stale-recovery, all-resolved, and filter-preset states -- completes in-place navigation.
- [x] `tests/integration/*`, `tests/unit/*`, and `tests/e2e/electron.acceptance.ts` -- verify ordering, hydration, no recomputation, latest exceptions, all-resolved, stale recovery, keyboard navigation, and retries -- covers every matrix row.

**Acceptance Criteria:**
- Given completed Runs, when the user opens Runs or activates one, then newest-first persisted history and its exact Results snapshot appear without a new reconciliation.
- Given Exceptions is opened, when a latest Run exists, then it loads with non-matched status filters selected; otherwise it presents the appropriate empty state.
- Given a stale or failed history query, when recovery is required, then the app clears stale state, announces a typed error, and retries in place without losing navigation context.
- Given automated and packaged checks, when run, then all matrix behaviors and keyboard navigation pass.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript checks pass.
- `npm test` -- expected: persistence, IPC, renderer, and recovery tests pass.
- `npm run test:e2e` -- expected: packaged history and Exceptions flows pass.
