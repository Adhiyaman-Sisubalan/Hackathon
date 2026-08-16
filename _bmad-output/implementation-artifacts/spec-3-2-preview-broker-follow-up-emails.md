---
title: 'Preview Broker Follow-up Emails'
type: 'feature'
created: '2026-08-16'
status: 'in-review'
baseline_commit: 'f33dc743a6f87b214a88de27367a5af22af733e3'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Operators can record a discrepancy comment but cannot see the complete, broker-specific follow-up they would send. Manually collecting affected unmatched trades risks accidental cross-broker inclusion and hides the persisted comments needed to make the draft actionable.

**Approach:** Add a main-authoritative, mock-only broker email preview. Seed and persist broker names/recipients, then use the selected Result’s Run-scoped broker identity to construct a typed Draft containing only that broker’s unmatched Results and current comments. Display it non-modally in the Detail Panel; it is strictly a preview, never an email integration.

## Boundaries & Constraints

**Always:** Persist deterministic mock broker name and recipient details with broker trades; include a fixture with multiple unmatched Results for one broker. Renderer sends only Run ID and selected logical Result ID. Main reloads authoritative SQLite state, validates selected `unmatched` broker membership, and returns a Draft DTO containing recipient, subject, professional body, visible `Draft` status, and exactly-once rows for that selected broker’s `unmatched` Results only. Each row exposes Trade ID, ISIN, buy/sell, amount, quantity, currency, settlement date, mismatch reason, and persisted Comment. Keep preview/result state keyed by selected Result; queue it after comment saves; preserve selection, filters, scroll, comment drafts, detail/inspector context, and focus on failure.

**Ask First:** Changing mock broker identity/recipient data, adding real email delivery/authentication/network access, allowing missing-record or matched Results in previews, changing draft content/required row fields, or persisting draft history/preferences.

**Never:** Add a Send action, claim an email was sent, permit renderer-provided broker/trade/comment data, expose records from another broker/Run, include missing-record statuses, turn preview into a modal/router, or alter reconciliation matching/status identity.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid preview | Selected broker-backed `unmatched` Result | Explicit action opens non-modal Draft with recipient, subject, professional body, and complete broker-scoped unmatched trade table | No Send capability exists |
| Broker grouping | Same broker has multiple unmatched Results | Every matching row appears exactly once with current persisted comment | Other brokers and missing statuses are absent |
| Ineligible/no broker | No selection, matched/missing Result, or broker details unavailable | Action is disabled/prompted or plainly explains why draft cannot be prepared | No command is sent |
| Preview failure | Typed retryable main failure | Existing detail, selected Result, filters, comments, and inspector remain; assertive error offers Retry and Back to detail | Retry uses same Run/Result identity |
| Keyboard lifecycle | Preview opened in desktop or compact inspector | Focus moves to preview heading only after explicit action; Close/Back restores invoker focus | Compact inspector Escape remains its existing close behavior |

</frozen-after-approval>

## Code Map

- `fixtures/reconciliation-scenarios.ts`, `src/domain/reconciliation/reconciliation.ts`, and `src/shared/contracts/reconciliation.ts` -- current trade/fixture/DTO source has no broker contact; add durable mock broker identity/contact and strict immutable preview request/draft schemas.
- New `migrations/006-*.sql`, `src/main/index.ts`, and `src/main/adapters/sqlite/database.ts` -- migrate/backfill broker metadata and add authoritative broker-scoped draft query using current hydrated comments/results.
- `src/main/modules/runs/runs-service.ts` and `src/main/ipc/reconciliation.ts` -- publish a Runs-owned `previewBrokerEmail` command through a sender-validated `broker.preview.v1` handler with safe typed failures.
- `src/shared/contracts/preload.ts`, `src/preload/index.ts`, and `src/preload/global.d.ts` -- expose only `runs.previewBrokerEmail(runId, resultId)` to the renderer.
- `src/renderer/features/results/Results.tsx` and `Results.module.css` -- reuse DetailPanel, mutation queue, comments, desktop/compact inspector focus lifecycle; add parent-owned draft/loading/error/open state and no-send presentation.
- `tests/unit/contracts.test.ts`, `tests/integration/reconciliation-runs.test.ts`, `tests/integration/reconciliation-ipc.test.ts`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- extend existing Story 3.1 seams for strict authority, grouping, focus, and packaged preview validation.

## Tasks & Acceptance

**Execution:**
- [x] `fixtures/*`, `src/domain/*`, `src/shared/contracts/*`, `migrations/*`, and `src/main/index.ts` -- add deterministic durable mock broker contacts, multi-unmatched evidence, migration, and strict preview DTO/contracts -- makes broker identity explicit and testable.
- [x] `src/main/adapters/sqlite/database.ts`, `src/main/modules/runs/runs-service.ts`, and `src/main/ipc/reconciliation.ts` -- reload/validate authoritative broker membership and return the scoped typed Draft through a secure command -- prevents renderer tampering or cross-broker leakage.
- [x] `src/preload/*` and `src/renderer/features/results/*` -- expose the narrow bridge and render the non-modal Draft, action affordances, retry/back, and focus return -- provides keyboard-accessible operational preview without sending.
- [x] `tests/unit/*`, `tests/integration/*`, and `tests/e2e/electron.acceptance.ts` -- cover every matrix row, exact-once grouping, persisted comments, no-send invariant, and compact focus lifecycle -- validates the end-to-end contract.

**Acceptance Criteria:**
- Given a selected broker-backed unmatched Result, when Preview broker email is explicitly activated, then an authoritative non-modal Draft shows recipient, subject, professional body, visible Draft state, and the broker-scoped unmatched table with current comments.
- Given another broker or missing-record status exists in the Run, when main builds the Draft, then it excludes that record while including every selected-broker unmatched Result exactly once.
- Given no selection or an ineligible/no-broker Result, when the action area renders, then it prevents submission and explains the reason without losing investigation context.
- Given preview generation fails, when its typed failure is returned, then comments, selection, filters, and detail context remain while an associated Retry and Back to detail are available.
- Given keyboard use on desktop or constrained inspector, when preview opens and closes, then focus moves to the draft heading after explicit invocation and returns to its invoker; no Send control or external side effect exists.

## Design Notes

The selected Result identifies the broker; the renderer does not choose it. Store fixture-backed broker details durably so reopening produces the same deterministic Draft. Keep the draft as a typed response rather than persisted user state: comments become current through SQLite before main collects rows, and a later request recomputes the preview authoritatively.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript/lint checks pass.
- `npm test` -- expected: fixtures, migration, contract, grouping, IPC, renderer accessibility, and no-send tests pass.
- `npm run test:e2e` -- expected: packaged comment-to-preview, broker scoping, and keyboard focus flow pass.
