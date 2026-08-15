---
name: Reconciliation Prototype
description: Experience specification for the Electron reconciliation prototype.
status: final
sources:
  - ../../briefs/brief-Hackathon-2026-08-15/brief.md
updated: 2026-08-15
---

# Foundation

Electron desktop application for daily reconciliation work. It must feel fast and native: immediate feedback, short functional transitions, low perceived memory cost, and automatic system light/dark-theme support. `DESIGN.md` is the visual-identity reference; its system-theme token pairs are resolved at runtime.

**Product principle:** premium polish and dense data made effortless. Users scan operational state, investigate evidence, and act without losing their place.

**Canonical statuses:** IDs are `matched`, `unmatched`, `missing-from-broker`, and `missing-from-ot-murex`; UI labels are **Matched**, **Unmatched**, **Missing from broker**, and **Missing from OT/MUREX**. **Unresolved** is the umbrella for every non-`matched` status.

# Information Architecture

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Dashboard | App open / application shell | Latest summary or first-run empty state; starts a run. |
| Start reconciliation | Dashboard | Selects an as-of date and starts the mock run. |
| Results workspace | Run completion / Dashboard | Filters and reviews status records; exposes review progress. |
| Trade detail panel | Selected results row | Full trade, reason, comments, and next actions beside the grid. |
| Broker email preview | Detail panel | Non-modal, broker-specific mock draft; never sends. |
| Save report | Results workspace | Saves the mock report to the shared-path simulation. |

The dashboard is the landing surface. Results retain the summary strip and review progress throughout investigation. The spines win on conflict with any future mockup.

Composition references: [dashboard mockup](mockups/dashboard.html) covers the dashboard and start flow; [results-workspace mockup](mockups/results-workspace.html) covers results, selection, inspection, comments, and broker preview. The spines win on conflict.

# Voice and Tone

Use plain, calm, operational language: name what happened, why it matters, and the next action. For an anomaly, say: “Today’s unresolved rate is 11%; the recent baseline is 2%.” For failures, name the affected item and recovery action. Use **Preview broker email** and **Email draft ready**, never **Sent**.

# Component Patterns

| Component | Behavioral contract |
| --- | --- |
| `application-shell` | Provides compact desktop navigation for Overview, Reconciliation runs, and Exceptions; active destination is explicit and keyboard reachable. |
| `dashboard` | Displays latest summary, inline anomaly warning, and one dominant `primary-action`; first use is an empty state. |
| `primary-action` | Starts reconciliation only after a valid as-of date is selected. |
| `as-of-date-control` | Has visible label, required-state text, and associated validation; an invalid Run attempt focuses the control or linked error summary. |
| `summary-strip` | Shows total, matched, unresolved, reconciliation rate, and non-blocking anomaly context. |
| `results-grid` | Uses a semantic HTML table. Toolbar controls filter, sort, and choose visible columns; each row has a labelled select control. Result count, sort direction, selected state, and filtered count are announced. |
| `status-treatment` | Shows label plus semantic color and compact icon/shape; never color alone. |
| `detail-panel` | Updates beside the grid. Ordinary row selection keeps focus in the table; an explicit **Open inspector** control moves focus to the panel heading. Close/collapse returns focus to its invoker. |
| `comments` | Saves the selected unresolved record’s text to SQLite. Failed saves preserve text, focus the error context, and expose retry. |
| `broker-email-preview` | Is a labelled, non-modal section of the detail panel with broker/trade context and a keyboard return route. It has no send action. |
| `report-save` | Confirms the simulated shared-path destination on success; failure exposes a linked error and retry without discarding the run. |
| `feedback` | Provides polite status announcements for progress/success and assertive announcements for errors; errors are associated with their affected control. |
| `inspector-toggle` | At narrow widths, exposes selected-record context and expanded/collapsed state; collapses and restores focus using the detail-panel rule. |

# State Patterns

| State | Treatment and recovery |
| --- | --- |
| Dashboard loading/read failure | Show a compact loading skeleton; on failure, state the issue and offer **Retry** while retaining the start action. |
| First use | Show empty dashboard and **Start Reconciliation**. |
| Invalid or missing date | Show associated text validation; Run attempt focuses the date control or linked error summary. |
| Running | Disable duplicate submission, retain selected date, and announce progress. |
| Completed | Route to results, show summary, filters, and all status views. |
| Empty filtered view | Preserve filters, state **No matching records**, and offer **Clear filters**. |
| No unresolved records | Show all-resolved state while matched records remain inspectable. |
| Review progress | Selecting an unmatched record marks it reviewed; show `reviewed / total unmatched`. Report save is disabled until all unmatched records are reviewed, with explanatory text. |
| No selected trade | Detail panel prompts the user to select a record; no broker action is available. |
| No broker or draft failure | Disable preview until a broker is available; show reason and retry/back-to-detail action on draft failure. |
| Comment/report save failure | Preserve input/run, announce an assertive error, associate retry with the failed operation, and retain focus context. |
| Theme, motion, high contrast | Follow system light/dark and reduced-motion settings; honor OS forced-colors using system colors. |

# Interaction Primitives

- **Keyboard:** Tab moves through toolbar controls and row select controls in reading order; Enter/Space activate buttons and sort controls. Standard native table semantics remain intact. Column controls and filters are ordinary labelled controls, not hidden hover actions.
- **Selection:** Selecting a row announces the chosen trade and updates the adjacent panel without moving focus. **Open inspector** moves focus into it; close/collapse restores focus to the invoker.
- **Review:** Each unmatched selection is persisted as reviewed. The progress display makes mandatory review explicit and blocks final report save until complete.
- **Motion:** Detail-panel and state transitions are short, interruptible, and removed when reduced motion is enabled.

# Accessibility Floor

- All core operations work with keyboard and pointer; focus order follows reading order.
- Status labels, selected rows, errors, and warnings are programmatically discernible and not color-dependent.
- Use a polite status region for run/filter/save success and an assertive error region for failures. Include saved destination in report-success feedback.
- Meet WCAG AA: 4.5:1 text contrast and 3:1 for essential controls, boundaries, and focus indicators in both themes. Verify status icon/text combinations independently.
- Table headers, sort state, filter state, selected row, validation, panel landmarks, and result count are exposed to assistive technology.

# Responsive & Platform

Desktop-first for a standard business laptop. At the intended demo width, grid and detail panel appear together. At constrained widths, preserve the table and expose the inspector through `inspector-toggle`; never squeeze values into unreadable columns. Do not use page reloads or heavyweight visual transitions for theme changes, filters, selection, or navigation.

# Key Flows

## Priya completes today’s reconciliation

1. Priya opens the dashboard and sees the latest summary, any warning, and **Start Reconciliation**.
2. She selects an as-of date and starts the seeded mock run.
3. Results open with summary, filters, and review progress.
4. She selects each unmatched record, opens the inspector when needed, saves comments on unresolved records, and previews broker drafts.
5. **Climax:** Review progress reaches the total unmatched count and **Save report** becomes available; Priya saves the full mock report and receives its destination.

Failure: if a comment or report save fails, Priya’s input and run remain intact, the affected action states the reason, and **Retry** returns her to the same context.

## Priya investigates an unusual day

1. Priya sees an amber warning with the current unresolved rate and seeded baseline.
2. She enters Results rather than an analytics detour.
3. **Climax:** Filtered unresolved records, full details, and review progress turn the warning into specific action without blocking work.
