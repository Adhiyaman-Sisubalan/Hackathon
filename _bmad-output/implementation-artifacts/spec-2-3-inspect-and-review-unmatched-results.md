---
title: 'Inspect and Review Unmatched Results'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: '8d8767ddab7e2c98975e075b79fe6b10b536a5fb'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Operators can filter reconciliation Results but cannot inspect the complete paired evidence or record that an unmatched discrepancy has been reviewed. That makes an investigation neither explainable nor durable when a Run is reopened.

**Approach:** Add an authoritative, idempotent unmatched-review command and an accessible Results inspector that presents persisted evidence beside the table. Replacing the workspace with the command response keeps review progress correct while existing renderer-owned table state stays stable.

## Boundaries & Constraints

**Always:** Review only canonical `unmatched` Results; the command sets `reviewed = true`, never toggles, and returns authoritative Run data. Persist review state by Run and Result so reopening restores it while a later rerun starts unreviewed. Keep the native table and its renderer-only filter/sort/column state; show full available broker and OT/MUREX evidence, a deterministic reconciliation key, canonical Status, and reason. Desktop uses a persistent adjacent Detail Panel; constrained layouts use explicit Open inspector with heading focus and invoker restoration on close/Escape. Preserve selection, table focus, filters, and scroll through success/failure.

**Ask First:** Broadening source-trade fields beyond the persisted contract, changing Result identity semantics, changing review eligibility/status definitions, or introducing a router, modal workflow, persistence cache, or table virtualization.

**Never:** Mark `matched`, `missing-from-broker`, or `missing-from-ot-murex` as reviewed; optimistically present failed review as saved; derive progress only in transient renderer state; expose SQLite or raw SQL to the renderer; clear selection on inspector close; require hover or pointer-only interaction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Paired selection | Any visible Result with both sources | Labelled Select trade control retains table focus and updates selected detail with both source records, source-attributed values, reconciliation key, Status, and reason | No-selection panel prompts for a Result |
| Missing-side selection | Missing-from-broker or missing-from-ot-murex Result | Available evidence and the absent side are explicit; Result is not review-required | Status/reason remain visible |
| First/repeated review | Unreviewed or reviewed `unmatched` selected | Main reloads/validates the Result and idempotently saves `reviewed=true`; returned workspace updates `reviewed unmatched / total unmatched` | Repeat/retry does not double-count |
| Save failure | Typed retryable review failure | Selected detail, table state, focus, and scroll remain; assertive linked error offers Retry | No false reviewed state; Retry uses same identity |
| Responsive inspector | Constrained viewport, selected Result | Open inspector moves focus to heading; close control or Escape returns focus to invoker without clearing selection | Desktop remains non-modal adjacent detail |

</frozen-after-approval>

## Code Map

- `src/shared/contracts/reconciliation.ts` -- current immutable workspace/result schemas; add reviewed state, review progress, versioned review request/result envelope, channel, and a stable result identity/reconciliation-key representation.
- `src/shared/contracts/preload.ts`, `src/preload/index.ts`, and `src/preload/global.d.ts` -- extend the named, typed preload surface with the review operation only.
- `migrations/002-runs-and-results.sql`, new `migrations/004-*.sql`, and `src/main/index.ts` -- existing Result persistence/migration registration; add compatible `reviewed` storage/backfill and register it for packaged startup.
- `src/main/adapters/sqlite/database.ts` -- `workspaceForRun` hydrates authoritative evidence and maps persisted `runId:logicalId` rows back to DTO IDs; add atomic run-scoped review update plus hydrated review progress without recomputation in the renderer.
- `src/main/modules/runs/runs-service.ts` -- exclusive Run aggregate/API seam; validate run/result/status and expose idempotent review that returns the updated immutable workspace.
- `src/main/ipc/reconciliation.ts` and `src/shared/contracts/result.ts` -- existing sender/payload validation and safe typed envelopes; register review with exact sender/main-frame checks and stable invalid/not-found/query failure mapping.
- `src/renderer/features/results/Results.tsx` and `Results.module.css` -- existing semantic table, local selected-row and view state; add detail surface, review/retry feedback, accessible selected control, and responsive inspector lifecycle without re-keying the workspace.
- `src/renderer/components/SummaryStrip.tsx` and `SummaryStrip.module.css` -- stable metric surface; add review-progress context while preserving summary/anomaly behavior.
- `src/renderer/app/App.tsx` -- pass an authoritative workspace-replacement callback to Results without resetting navigation or renderer view state.
- `tests/integration/reconciliation-runs.test.ts`, `tests/integration/reconciliation-ipc.test.ts`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- extend existing seams for persistence, IPC safety, accessible inspection, retry, and packaged flows.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/contracts/*`, `src/preload/*`, and `src/main/ipc/reconciliation.ts` -- define and expose a strict versioned `result.review.v1` request/response boundary with typed failures -- preserves the secure process boundary.
- [x] `migrations/*`, `src/main/adapters/sqlite/database.ts`, and `src/main/modules/runs/runs-service.ts` -- persist/hydrate run-scoped review state and atomically set unmatched Results reviewed -- makes reopened progress authoritative and rerun-isolated.
- [x] `src/renderer/features/results/*`, `src/renderer/components/SummaryStrip*`, and `src/renderer/app/App.tsx` -- build the persistent Detail Panel/compact inspector, progress, selection semantics, and retry replacement path -- gives operators an accessible investigation workflow without losing table context.
- [x] `tests/integration/*`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- cover every matrix row, status eligibility, idempotency, persistence/rerun isolation, focus lifecycle, and packaged review flow -- validates the end-to-end contract.

**Acceptance Criteria:**
- Given a selected paired or missing-side Result, when its labelled control is activated by keyboard or pointer, then native table focus remains while its accessible detail surface exposes complete available evidence, reconciliation key, canonical Status, reason, and explicit missing side where applicable.
- Given an unreviewed unmatched Result, when selected, then main atomically reloads and sets its review state, returns an authoritative workspace, and updates review progress exactly once; non-reviewable statuses remain inspectable but do not affect progress.
- Given a review save fails, when the typed retryable error is rendered, then the UI retains the selected Result and all investigation context, announces an associated assertive Retry, and only displays reviewed state after success.
- Given a Run is reopened or a new rerun is examined, when workspace data is loaded, then prior review state/progress are restored only for the original Run, with zero-unmatched already satisfied.
- Given desktop or constrained layouts, when inspection opens or closes, then desktop retains the table and adjacent panel together, while compact inspector focus moves to its heading and returns to its invoker on close/Escape without clearing selection.

## Design Notes

The persisted SQLite row identity is internal. The public review command should use the Run ID plus the logical DTO Result ID, while the database resolves them together. Return the updated workspace after the set-to-true command rather than incrementing a client counter; this makes duplicate activation, retry, and a reopened workspace converge on the same state.

Use the existing pairing components (`isin`, `buySell`, `currency`, `settlementDate`) as the stable reconciliation key unless the contract explicitly adds an equivalent immutable field. Evidence values remain normalized decimal strings until presentation formatting.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript/lint checks pass.
- `npm test` -- expected: contract, persistence, IPC, renderer, accessibility, and idempotency tests pass.
- `npm run test:e2e` -- expected: packaged Electron selection, review persistence, and keyboard inspector flow pass.

## Suggested Review Order

**Secure review boundary**

- Validate, authorize, and normalize review mutations at the only renderer-to-main entry point.
  [`reconciliation.ts:40`](../../src/main/ipc/reconciliation.ts#L40)

- Keep review eligibility and returned workspace inside the Runs application API.
  [`runs-service.ts:39`](../../src/main/modules/runs/runs-service.ts#L39)

**Durable authoritative state**

- Update and hydrate the reviewed Result in one transaction for truthful outcomes.
  [`database.ts:128`](../../src/main/adapters/sqlite/database.ts#L128)

- Introduce backward-compatible review storage with an operational lookup index.
  [`004-result-review.sql:1`](../../migrations/004-result-review.sql#L1)

**Investigation workflow**

- Preserve selection while coordinating review commands, inspector focus, and authoritative workspace replacement.
  [`Results.tsx:114`](../../src/renderer/features/results/Results.tsx#L114)

- Verify persistent review state, migration backfill, and rerun isolation.
  [`reconciliation-runs.test.ts:119`](../../tests/integration/reconciliation-runs.test.ts#L119)

- Exercise review failures, stale interactions, and compact inspector keyboard recovery.
  [`results.test.tsx:107`](../../tests/unit/results.test.tsx#L107)
