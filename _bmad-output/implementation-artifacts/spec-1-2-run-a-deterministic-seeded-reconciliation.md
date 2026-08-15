---
title: 'Run a Deterministic Seeded Reconciliation'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: '273d0270dd6ad394eeecc07b3db127640ad42852'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The secure application shell cannot yet run reconciliation, so users cannot turn a business date into persisted, explainable results. The prototype needs a repeatable, offline reconciliation run that stakeholders can trust during the demo.

**Approach:** Add deterministic seeded Broker and OT/MUREX scenarios, pure reconciliation logic, atomic run persistence, and a small Dashboard-to-Results flow. The user selects a supported as-of date, receives accessible progress, and lands on a persisted run summary with visible status filters.

## Boundaries & Constraints

**Always:** Support exactly `2026-08-13`, `2026-08-14`, and `2026-08-15`, defaulting the labelled date control to `2026-08-15`. Use stable fixture Trade IDs; normalize amount, quantity, and price as decimal strings; and reconcile by ISIN, buy/sell, currency, and settlement date. Within a key, pair bytewise-ASCII Trade IDs ordinally; produce one immutable result for each pair or surplus and only the canonical statuses `matched`, `unmatched`, `missing-from-broker`, and `missing-from-ot-murex`. Use typed versioned Zod IPC and preload methods, main-owned SQLite/filesystem access, injected clock/UUID/fixture/database seams, application-owned transactions, and safe typed failures. Preserve the existing secure process boundary, Dashboard state behavior, and in-place navigation.

**Ask First:** Any change to the seeded dates, source fields, matching key, status vocabulary, pairing/decimal semantics, package versions, persistence engine, or introduction of external data/email/network access.

**Never:** Port VBA logic, use floating-point equality, overwrite prior runs, expose SQL/Electron/path primitives to the renderer, add a router/global state store, build the full Result grid/detail/review workflow, or fabricate results for unsupported dates.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Supported run | One of the three seeded dates | New Run ID, atomically persisted source records/results/metrics; route in place to summary and status filters | Progress is polite; date remains visible and duplicate submit is disabled |
| Unsupported date | Missing or any other date | No reconciliation command or writes | Linked **No seeded data for this date** error restores focus to date control |
| Repeated key / mismatch | Stable fixture records sharing a key | ASCII ordinal pairing; equal decimals match; amount, quantity, or both differences are explained | Surpluses become the appropriate missing status |
| Invalid fixture | Duplicate Trade ID in a source/run | No partial Run commits | Typed `DUPLICATE_TRADE_ID` failure preserves date and offers safe retry |
| Rerun or persistence failure | Same date run again / transaction failure | Rerun has a new ID; prior run remains unchanged | Roll back entirely and return retryable typed failure |

</frozen-after-approval>

## Code Map

- `src/main/modules/runs/runs-service.ts:4` -- existing Runs owner; extend rather than adding a second persistence authority.
- `src/main/adapters/sqlite/database.ts:15` and `migrations/001-initial.sql:1` -- transactional/versioned database seam and current v1 schema; retain v1 and add the run/result migration.
- `src/main/index.ts:28`, `src/main/ipc/dashboard.ts:11`, `src/preload/index.ts:5`, and `src/shared/contracts/*` -- secure bootstrap/IPC/preload pattern to reuse for reconciliation commands and progress.
- `src/renderer/features/dashboard/Dashboard.tsx:7` and `src/renderer/app/App.tsx:11` -- replace the Story 1.1 start placeholder and extend closed in-place view state.
- `fixtures/initial-seed.ts:3` -- intentionally empty v1 seed lifecycle; add immutable scenario registry without changing its one-time bootstrap role.
- `tests/integration/sqlite-dashboard.test.tsx:1`, `tests/integration/dashboard-ipc.test.ts:1`, and `tests/e2e/electron.acceptance.ts:10` -- existing database, IPC, and packaged Electron verification seams.

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/reconciliation/*`, `src/domain/decimal.ts`, and `tests/unit/reconciliation.test.ts` -- implement pure typed Trade/Result models, decimal normalization, key pairing/classification, duplicate validation, and golden edge-case coverage -- keeps business rules deterministic and framework-free.
- [x] `fixtures/reconciliation-scenarios.ts`, `src/main/modules/runs/*`, `src/main/adapters/sqlite/database.ts`, and `migrations/002-runs-and-results.sql` -- add versioned immutable scenarios, injected command seams, transactional Run aggregate persistence, and workspace snapshots -- gives reruns durable, rollback-safe results.
- [x] `src/shared/contracts/reconciliation.ts`, `src/main/ipc/reconciliation.ts`, `src/main/index.ts`, and `src/preload/index.ts` -- add `reconciliation.run.v1` and progress boundary with sender/payload validation and typed safe failures -- retains the hardened process boundary.
- [x] `src/renderer/app/*`, `src/renderer/features/dashboard/*`, and `src/renderer/features/results/*` -- add labelled date/run controls, focus-linked validation, retained-date progress, duplicate-submit prevention, and minimal summary/status-filter Results handoff -- completes the user-facing run.
- [x] `tests/integration/*`, `tests/unit/*`, `tests/e2e/electron.acceptance.ts`, and test configuration -- cover every matrix row plus atomic rollback, reruns, IPC/progress, routing, and keyboard accessibility -- proves the end-to-end contract.

**Acceptance Criteria:**
- Given a supported default or selected date, when the user runs reconciliation, then main creates a new persisted Run ID and routes in place to that Run’s summary with visible Status filters.
- Given fixture records across all pairing cases, when pure reconciliation executes, then canonical statuses, reasons, surplus handling, ASCII ordering, decimal equality, and duplicate-ID failure exactly follow the declared contract.
- Given repeated submissions, reruns, or a persistence exception, when the command is evaluated, then only one command is active, successful reruns preserve prior data, and failure leaves no partial Run while retaining retry context.
- Given an unsupported or missing date, when Run reconciliation is activated, then no run starts, no data changes, and the linked validation error returns focus to the date control.
- Given keyboard or pointer operation, when a run starts, completes, or fails, then the selected date, progress/success/error announcements, action state, focus, and Dashboard context remain stable.
- Given unit, integration, and packaged Playwright checks, when they run, then every matrix behavior and Dashboard-to-Results completion route passes without a runtime network service.

## Design Notes

The Runs module is the transaction boundary: calculate the full immutable result set before persistence, then commit the Run, source evidence, results, and metrics together. The renderer receives snapshots only and treats the completion response as its new in-place view state; it never derives, persists, or mutates reconciliation facts.

## Verification

**Commands:**
- `npm run lint` -- expected: source and test TypeScript checks pass.
- `npm test` -- expected: domain, contract, SQLite, command, and renderer-state tests pass.
- `npm run test:e2e` -- expected: packaged Playwright flow selects/runs a supported date and reaches Results.
- `npm run package` -- expected: macOS package builds without a runtime network dependency.
