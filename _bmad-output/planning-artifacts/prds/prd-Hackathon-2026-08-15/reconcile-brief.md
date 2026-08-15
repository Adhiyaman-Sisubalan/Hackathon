# Input Reconciliation: Product Brief

## Input

`brief-Hackathon-2026-08-15/brief.md` reconciled against `prd-Hackathon-2026-08-15/prd.md`.

## Verdict

The PRD preserves the brief's central product promise, hackathon purpose, core end-to-end flow, mock-data boundary, SQLite persistence, visual ambition, result categories, side-panel investigation, comments, broker-email preview, report output, summary, and non-blocking anomaly warning. Three substantive differences need explicit acknowledgement; none requires reopening the prototype concept.

## Gaps and Conflicts

### 1. Human-review scope is broader in the PRD

- **Brief:** every `unmatched` record receives human review.
- **PRD:** every `Unresolved` Trade—`unmatched`, `missing-from-broker`, and `missing-from-ot-murex`—must be reviewed.
- **Impact:** this is a meaningful scope expansion. It affects review-progress calculation, seeded data, demo duration, and the report-save condition.
- **Recommended disposition:** retain the PRD's broader rule because all non-matched outcomes require operational attention, but record it as a deliberate clarification rather than silently treating it as inherited from the brief.

### 2. The PRD introduces a report-save gate not required by the brief

- **Brief:** the user reviews exceptions and can save the complete report; it does not state that report saving is blocked until review is complete.
- **PRD:** Save Report is disabled until every Unresolved Trade is reviewed.
- **Impact:** the prototype could prevent a legitimate save/export action and creates a hard workflow dependency that was not validated in the brief. It also risks slowing the three-minute pitch if the seeded run contains several unresolved records.
- **Recommended disposition:** for the prototype, keep review progress visible but allow report saving at any time, with a confirmation when unresolved records remain. If the hard gate is important as a business control, it should be confirmed explicitly and the demo data should contain very few unresolved records.

### 3. The anomaly threshold is newly invented and unusually specific

- **Brief:** show an amber warning when the current unresolved rate differs materially from prior seeded runs; the warning explains the current rate and historical baseline.
- **PRD:** define the baseline as the mean of exactly five prior runs and trigger only when the current rate is at least five percentage points above and at least twice the baseline.
- **Impact:** the fixed formula converts an open product choice into a normative requirement without evidence from the brief. It may suppress a useful demo warning for some seeded datasets and makes a prototype detail look like an approved business rule.
- **Recommended disposition:** acceptable as a clearly labelled prototype heuristic. State that the five-run, `+5 percentage points and 2x` rule is configurable/replaceable and is not a production policy.

## Qualitative Intent Preserved

- A fast, native-feeling Electron desktop experience with premium polish and dense data made effortless.
- A credible product replacement experience for the current Excel/VBA workflow, without claiming that VBA parity is part of the prototype.
- A coherent operational journey rather than disconnected mock screens: run, understand, investigate, comment, preview follow-up, and save.
- A professional data-forward workspace, with full Trade details accessible without overwhelming the default grid.
- An explainable, non-blocking anomaly signal rather than opaque or exaggerated AI.

## Coverage Notes

- The brief's first-run Dashboard, latest-run summary, As-of-date execution, result categories, filters, Detail Panel, persistent Comments, email preview without sending, and simulated report output all have corresponding PRD requirements.
- The PRD adds accessibility, error recovery, keyboard behavior, and state semantics from the UX contracts. These strengthen the brief without conflicting with it.
- The PRD's extra mock Trade fields are a reasonable concretization of the brief's phrase “other required trade fields,” provided the mock schema may be extended without changing the default grid.
