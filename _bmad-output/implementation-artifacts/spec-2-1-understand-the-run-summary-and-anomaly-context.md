---
title: 'Understand the Run Summary and Anomaly Context'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: '9cdbbffb05470a4e87c9c0234622c992c818963e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Operators can run or reopen reconciliation, but cannot immediately assess outcome quality or recognize an unusual unresolved rate.

**Approach:** Add shared persisted summary metrics and an explainable non-blocking anomaly calculation, then present the same compact Summary Strip on Dashboard and Results.

## Boundaries & Constraints

**Always:** Calculate total, matched, Unresolved, reconciliation rate, and unresolved rate from a selected Run; use `0.0%` for zero totals and one-decimal display rounding. Use only exactly five versioned seeded historical runs for the anomaly baseline; exclude user runs/reruns. Show a warning only when current unresolved rate is both at least five percentage points above and at least twice the unrounded baseline. Typed bootstrap configuration owns thresholds.

**Ask First:** Changing anomaly thresholds, seeded-history composition, metric definitions, persistence model, or adding analytics/history drill-down.

**Never:** Block work for an anomaly, use color alone, add a historical analytics screen, include user runs in baseline, or calculate business metrics in the renderer.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Error handling |
|---|---|---|---|
| Completed run | Results exist | Integer totals and one-decimal rates appear identically on Dashboard and Results | No calculation divergence |
| Zero results | Empty Run | Both rates display `0.0%` | No NaN/infinity |
| Unusual run | Five seeded histories and both thresholds pass | Amber non-blocking current/baseline warning | No drill-down or alarm |
| Insufficient history | Fewer than five seeded histories | No warning; calm insufficient-history context | Run remains usable |
| Normal run | Either threshold fails | Ordinary summary only | No false warning |

</frozen-after-approval>

## Code Map

- `src/main/modules/runs/runs-service.ts` and `src/main/adapters/sqlite/database.ts` -- sole persisted Run and snapshot owners.
- `src/shared/contracts/reconciliation.ts`, `src/main/ipc/*`, and `src/preload/index.ts` -- typed main/preload boundary to extend for summary DTOs.
- `src/renderer/features/dashboard/Dashboard.tsx` and `src/renderer/features/results/Results.tsx` -- current summary consumers; keep output consistent.
- `fixtures/reconciliation-scenarios.ts` and `tests/integration/reconciliation-runs.test.ts` -- deterministic run fixtures and persistence test seam.

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/metrics/*` and unit tests -- calculate exact metrics, display rounding, and anomaly decisions from typed inputs -- keeps formulas pure and deterministic.
- [x] `migrations/*`, `fixtures/*`, `src/main/modules/runs/*`, and `src/main/adapters/sqlite/database.ts` -- persist/version exactly five seeded histories and expose run summary/anomaly snapshots -- makes provenance authoritative.
- [x] `src/shared/contracts/*`, `src/main/ipc/*`, and `src/preload/*` -- expose versioned immutable summary/anomaly DTOs -- preserves the process boundary.
- [x] `src/renderer/components/*`, `src/renderer/features/dashboard/*`, and `src/renderer/features/results/*` -- render shared accessible Summary Strip and warning/insufficient-history states -- keeps investigation context stable.
- [x] `tests/unit/*`, `tests/integration/*`, and `tests/e2e/*` -- cover formulas, threshold boundaries, provenance, Dashboard/Results consistency, and accessibility modes -- validates every matrix row.

**Acceptance Criteria:**
- Given any completed Run, when loaded on Dashboard or Results, then both surfaces show the same persisted integer totals and one-decimal rates.
- Given five seeded histories, when both anomaly thresholds pass, then a calm accessible warning shows current and baseline rates; otherwise no warning appears.
- Given zero results or insufficient history, when metrics load, then rates are safe and the user receives the correct non-error context.
- Given automated and packaged checks, when run, then formulas, threshold boundaries, seeded provenance, and accessible presentation pass.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript checks pass.
- `npm test` -- expected: metrics, persistence, contracts, and UI tests pass.
- `npm run test:e2e` -- expected: packaged summary and warning flow passes.

## Suggested Review Order

**Authoritative run snapshots**

- Reload committed aggregates so every surface consumes persisted summary and anomaly state.
  [`runs-service.ts:37`](../../src/main/modules/runs/runs-service.ts#L37)

- Persist unresolved rates and derive immutable snapshots from selected run records.
  [`database.ts:59`](../../src/main/adapters/sqlite/database.ts#L59)

- Restrict anomaly provenance to the versioned five-run seeded baseline.
  [`database.ts:90`](../../src/main/adapters/sqlite/database.ts#L90)

**Metrics and contracts**

- Keep summary formulas and threshold decisions pure, deterministic, and display-safe.
  [`reconciliation-metrics.ts:19`](../../src/domain/metrics/reconciliation-metrics.ts#L19)

- Extend typed process-boundary summaries with unresolved-rate and anomaly context.
  [`reconciliation.ts:13`](../../src/shared/contracts/reconciliation.ts#L13)

- Backfill legacy runs and store the versioned seeded-history baseline durably.
  [`003-summary-history.sql:1`](../../migrations/003-summary-history.sql#L1)

**Shared operational presentation**

- Reuse one accessible strip to keep Dashboard and Results context identical.
  [`SummaryStrip.tsx:5`](../../src/renderer/components/SummaryStrip.tsx#L5)

**Regression coverage**

- Prove legacy migrations, provenance, and insufficient-history snapshots remain trustworthy.
  [`reconciliation-runs.test.ts:67`](../../tests/integration/reconciliation-runs.test.ts#L67)
