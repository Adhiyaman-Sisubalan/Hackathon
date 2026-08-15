---
title: 'Explore and Filter Reconciliation Results'
type: 'feature'
created: '2026-08-15'
status: 'in-review'
baseline_commit: '82662ec4be1a930e58985f23fbf47c0f708c8f51'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Results currently show only a summary; operators cannot scan, filter, sort, or configure the individual reconciliation records behind it.

**Approach:** Build a renderer-owned semantic Results table with status filtering, sorting, column visibility, accessible operational formatting, and resilient empty/error states.

## Boundaries & Constraints

**Always:** Use one native semantic table backed by pinned TanStack Table v9, not an ARIA composite grid. Default columns are Counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and Status; optional fields include Trade ID, Broker, source, trade date, price, account/book, and mismatch reason. Prefer broker values when both sides exist and OT/MUREX values otherwise. Use canonical status labels plus color and icon/shape, normalized-decimal sorting, one date format, right-aligned tabular numerics, renderer-only table state, stable selection/focus, and announced total/filtered counts.

**Ask First:** Changing default/optional columns, status labels, sorting semantics, performance target, table library, or persisting table preferences.

**Never:** Mutate persisted Result data through filters/sort/columns, virtualize the 1,000-result fixture, build the detail/review workflow, add a second table system, or require hover/mouse input.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Error handling |
|---|---|---|---|
| Default workspace | Completed Run | Native table renders default fields and accessible status treatment | Source fallback is explicit |
| Filters/sort | Status selection or sortable header | Visible rows/count change without mutating summary or persisted data | State remains keyboard-accessible |
| Columns | Optional-column toggle | Field appears or hides in place | Table data remains unchanged |
| Empty filter | No visible rows | **No matching records** and Clear filters | Active filters stay visible |
| All resolved/query failure | No unresolved rows or load error | All-resolved context or linked Retry with summary retained | No reload or lost context |

</frozen-after-approval>

## Code Map

- `src/renderer/features/results/Results.tsx` and `Results.module.css` -- extend the existing summary/status-filter handoff into the workspace table.
- `src/domain/decimal.ts` and `src/shared/contracts/reconciliation.ts` -- reuse normalized values and immutable workspace DTOs.
- `src/renderer/styles/tokens.css` and `src/renderer/components/StatusText.tsx` -- preserve the sole visual/accessibility system.
- `tests/unit/results.test.tsx` and `tests/e2e/electron.acceptance.ts` -- current renderer and packaged test seams.

## Tasks & Acceptance

**Execution:**
- [x] `src/renderer/features/results/*` -- implement semantic table, status/column/sort controls, source fallback, formatting, and state feedback -- gives operators a stable investigation surface.
- [x] `src/renderer/components/*` and `src/renderer/styles/*` -- add reusable status/toolbar treatments within the existing token system -- keeps accessibility and visual semantics consistent.
- [x] `tests/unit/*`, `tests/integration/*`, and `tests/e2e/*` -- cover every matrix row, all columns/statuses, keyboard use, source fallback, and 1,000-result feedback -- validates functional and accessibility contract.

**Acceptance Criteria:**
- Given a completed Run, when Results opens, then a native semantic table shows all required defaults with correctly formatted source values and status semantics.
- Given filters, sorting, or column visibility changes, when the user operates controls by keyboard or pointer, then table state changes in place without altering persisted Results or summary.
- Given no matching or unresolved rows, when the workspace renders, then clear all-resolved/empty context and available controls remain usable.
- Given automated and packaged checks, when run, then table interaction, accessibility, and 1,000-result feedback pass.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript checks pass.
- `npm test` -- expected: table, formatting, and accessibility tests pass.
- `npm run test:e2e` -- expected: packaged table flow passes.
