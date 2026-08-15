# Input Reconciliation: EXPERIENCE.md

## Scope

Compared `EXPERIENCE.md` with `prd.md` for missing or conflicting user flows, state handling, accessibility requirements, responsive behavior, and interaction contracts. The PRD already preserves the core dashboard-to-run-to-review-to-report journey, canonical statuses, mandatory unresolved review, anomaly warning, comment recovery, broker-email preview, and simulated report save.

## Gaps

### 1. Dashboard loading and read-failure recovery is missing

`EXPERIENCE.md` requires a compact loading state and a recoverable dashboard read-failure state that keeps the reconciliation start action available. The PRD defines first-run/latest-run dashboard content but does not require loading, failed-read messaging, or Retry behavior.

**Recommended PRD addition:** Extend FR-2 or add a dashboard-state FR requiring a compact loading indicator and, on read failure, a plain-language error with Retry while retaining access to the As-of date and run action.

### 2. Inspector focus behavior is underspecified

`EXPERIENCE.md` distinguishes ordinary row selection from intentionally entering the Trade Detail Panel: selecting a row updates the panel without moving focus; an explicit **Open inspector** action moves focus to its heading; closing or collapsing the panel restores focus to the invoker. FR-13 preserves workspace context but does not capture this keyboard/focus contract, and NFR-3 only requires generally visible focus.

**Recommended PRD addition:** Extend FR-13 or NFR-4 to require non-disruptive row selection, an explicit keyboard-operable inspector-entry action, and deterministic focus restoration on close/collapse.

### 3. Constrained-width inspector behavior is missing

`EXPERIENCE.md` defines a desktop side-by-side grid and Detail Panel at the intended demo width, plus an inspector toggle at constrained widths so the table is not compressed into unreadable columns. The PRD says desktop and data-dense, but has no responsive behavior or minimum-width fallback.

**Recommended PRD addition:** Add a responsive desktop NFR: keep grid and Detail Panel adjacent at the target demo width; at constrained widths preserve usable table columns and expose the Detail Panel through a labelled expanded/collapsed inspector toggle with focus restoration.

### 4. Live feedback semantics are only partially captured

`EXPERIENCE.md` specifies polite status announcements for run progress, filtering, and successful saves; assertive announcements for errors; associated error context; and inclusion of the saved destination in report-success feedback. NFR-3 covers generic success/progress announcements and affected-control association, while FR-19 covers destination confirmation, but the PRD does not explicitly distinguish polite from assertive announcements or require filter-result-count announcements.

**Recommended PRD addition:** Tighten NFR-3/NFR-4 so run/filter/save success uses a polite status region without moving focus, failures use an assertive error region linked to the affected control, and filter changes announce the updated result count.

### 5. Single-action naming is inconsistent across the UX source

`EXPERIENCE.md` uses **Start Reconciliation** in its first-use state and journey, while the approved dashboard revision and PRD intent are a single run action beside the As-of date. The PRD avoids a second button structurally but does not lock the visible label, leaving room for the duplicate-action regression previously identified.

**Recommended PRD addition:** Amend FR-3 to require exactly one primary reconciliation action beside the As-of date, labelled **Run reconciliation**, in both first-use and populated dashboard states.

## Conflicts

No substantive flow or status-model conflicts were found. The only inconsistency is the start-action terminology noted above; it should be resolved in favor of the approved single **Run reconciliation** action.

## Reconciliation Verdict

The PRD is substantially aligned with the experience specification. The five additions above close implementation-relevant gaps without expanding prototype scope.
