---
title: "Reconciliation Prototype PRD"
status: final
created: 2026-08-15
updated: 2026-08-15
---

# PRD: Reconciliation Prototype

## 0. Document Purpose

This PRD defines the hackathon prototype for product, UX, architecture, and implementation work. It builds on the approved product brief, `DESIGN.md`, and `EXPERIENCE.md`; those files own detailed visual tokens and interaction behavior. Requirements below use the glossary vocabulary and stable FR IDs.

## 1. Vision

The Reconciliation Prototype is a polished Electron desktop application that demonstrates a credible replacement experience for daily Excel/VBA reconciliation. It uses seeded mock broker and OT/MUREX Trade data, but it must feel like a complete operational product: users run a reconciliation, understand exceptions, document them, prepare broker follow-up, and save a report.

The prototype’s purpose is to convince Adhi and internal business stakeholders in a hackathon pitch. It prioritizes a fast, native-feeling desktop experience, premium polish, and dense trade data that is easy to investigate. The core pitch targets a three-minute end-to-end demo.

## 2. Target User

### 2.1 Jobs To Be Done

- Review the current reconciliation outcome and immediately understand unresolved work.
- Run an as-of-date reconciliation without depending on live enterprise integrations.
- Investigate every unresolved Trade while retaining grid context and full data access.
- Record durable resolution context and prepare broker follow-up without automatically sending email.
- Review every unmatched Trade before completing the operational workflow.

### 2.2 Non-Users (MVP)

- External Brokers, who receive no direct access.
- Administrators, schedulers, and production support teams.
- Users who require real Outlook, OT/MUREX, shared-folder, or multi-user workflows.

### 2.3 Key User Journeys

- **UJ-1. Priya completes today’s reconciliation.** Priya opens the Dashboard, chooses an As-of date, runs the seeded reconciliation, then filters and reviews every unmatched Trade. She opens full details in the Detail Panel, saves Comments, previews Broker follow-up when needed, and saves the Report. **Climax:** Review progress confirms every unmatched Trade has been reviewed. **Edge case:** a failed Comment or Report save preserves context and offers Retry.
- **UJ-2. Priya investigates an unusual day.** Priya sees an amber Anomaly Warning that compares the current Unresolved rate with the seeded baseline. She enters the Results Workspace and investigates the records behind the warning rather than navigating to an analytics screen. **Climax:** the warning becomes specific, actionable Trade work without blocking her.

## 3. Glossary

- **As-of date** — The business date selected before a Reconciliation Run.
- **Reconciliation Run** — One mock-data comparison executed for an As-of date.
- **Run ID** — Unique identifier for one persisted Reconciliation Run; reruns never overwrite an earlier Run ID.
- **Trade** — A broker or OT/MUREX trade record with reconciliation fields.
- **Reconciliation key** — Composite of ISIN, buy/sell, currency, and settlement date used by the prototype matching rule.
- **Reconciliation Result** — One persisted comparison row containing Result ID, Run ID, Status, Reconciliation key, optional broker Trade ID, optional OT/MUREX Trade ID, both sides' source values, and mismatch reason.
- **Status** — A Reconciliation Result classification of `matched`, `unmatched`, `missing-from-broker`, or `missing-from-ot-murex`.
- **Unresolved** — Any Reconciliation Result whose Status is not `matched`.
- **Review progress** — The count of reviewed unmatched Trades against the total unmatched Trades in a Reconciliation Run.
- **Detail Panel** — Persistent adjacent inspection surface for the selected Trade.
- **Comment** — SQLite-persisted user text associated with an Unresolved Reconciliation Result.
- **Broker Email Preview** — A non-modal, mock broker-specific email draft; it never sends email.
- **Report** — Complete mock reconciliation output saved to the configured local mock-output directory.
- **Anomaly Warning** — Non-blocking notice that the current Unresolved rate materially differs from seeded historical statistics.

## 4. Features

### 4.1 Application Shell and Dashboard

**Description:** A compact desktop application shell presents Overview, Reconciliation Runs, and Exceptions. The Dashboard is the landing surface and makes the latest Reconciliation Run and next action legible. Realizes UJ-1 and UJ-2.

#### FR-1: Desktop navigation

The user can navigate between Overview, Reconciliation Runs, and Exceptions using persistent, keyboard-reachable application navigation. **Overview** shows the Dashboard. **Reconciliation Runs** lists persisted Run ID, As-of date, completion time, totals, and rate; opening a run restores its Results Workspace. **Exceptions** is not a separate data surface: it opens the latest completed run's Results Workspace with all Unresolved Status filters selected. It shows an empty state when no completed run exists and does not aggregate or analyze history.

#### FR-2: Dashboard state

The Dashboard shows either a first-run empty state or the latest Reconciliation Run’s total Trades, matched Trades, Unresolved Trades, and reconciliation rate. When locally persisted summary data cannot load, it states the failure and offers Retry while retaining **Run reconciliation**.

#### FR-3: Start control

The user can select an As-of date and initiate a Reconciliation Run using one **Run reconciliation** action placed beside the date control. The date control has a visible label and associated validation text; no duplicate start action appears elsewhere on the Dashboard. Seed data provides named scenarios for 2026-08-13, 2026-08-14, and 2026-08-15; the default is 2026-08-15. Any other date is rejected before a run begins with **No seeded data for this date** and focus returns to the date control.

#### FR-4: Start feedback

The system prevents duplicate run submission, retains the selected As-of date while running, and provides immediate progress feedback.

### 4.2 Mock Reconciliation Run

**Description:** A Reconciliation Run compares seeded mock broker and OT/MUREX data and produces consistent Status values. Realizes UJ-1.

#### FR-5: Seeded inputs

The system uses seeded mock broker and OT/MUREX Trade data with stable Trade IDs for every prototype Reconciliation Run. Starting a rerun creates a new Run ID and does not overwrite prior runs.

#### FR-6: Status classification

The system joins broker and OT/MUREX records by Reconciliation key, then classifies them deterministically:

- `matched` when both sides exist and amount and quantity are equal;
- `unmatched` when both sides exist but amount or quantity differs;
- `missing-from-broker` when only the OT/MUREX side exists; and
- `missing-from-ot-murex` when only the broker side exists.

For `unmatched`, the mismatch reason identifies whether amount, quantity, or both differ. This mock contract does not reproduce or validate the excluded VBA logic.

Within a duplicated Reconciliation key, each source group is sorted by stable Trade ID and paired by ordinal position. Surplus records on either side become the appropriate missing Status. Every pair or surplus source record creates one Reconciliation Result. The Results Grid displays broker-side values when present and otherwise OT/MUREX-side values; the Detail Panel exposes both source records and their differing values.

#### FR-7: Results routing

On completion, the system routes the user to the Results Workspace with the Reconciliation Run summary and Status filters visible.

### 4.3 Results Workspace and Mandatory Review

**Description:** The Results Workspace is the primary data-dense review surface. It keeps the Results Grid and Detail Panel in context while tracking human review of every unmatched Trade. Realizes UJ-1 and UJ-2.

#### FR-8: Required Trade data

The Results Grid displays Counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and Status by default. Trade ID, Broker, source system, trade date, price, account/book, and mismatch reason remain accessible through column controls or the Detail Panel without leaving the workspace. Numeric columns use tabular numerals and right alignment; date columns use one consistent format and alignment.

#### FR-9: Results controls

The user can filter, sort, and control visible columns using Status filters without changing a Reconciliation Result’s underlying Status.

#### FR-10: Empty and all-resolved states

The system shows **No matching records** with a Clear filters action for an empty filter result and an all-resolved state when no Unresolved Trades exist.

#### FR-11: Review progress

Selecting an unmatched Trade persists it as reviewed and updates Review progress as reviewed unmatched Trades over total unmatched Trades.

#### FR-12: Mandatory unmatched review gate

The system disables Save Report until every unmatched Trade in the Reconciliation Run is reviewed. It shows `reviewed / total unmatched` and explains how many remain. When there are no unmatched Trades, the gate is satisfied automatically.

### 4.4 Trade Investigation and Resolution Context

**Description:** The Detail Panel preserves the selected Trade’s evidence and resolution context beside the Results Grid. Realizes UJ-1.

#### FR-13: Detail Panel

Selecting a Trade updates the persistent Detail Panel with its full fields and reconciliation reason without navigating away from the Results Workspace.

#### FR-14: Comments

The user can add and save a Comment for an Unresolved Reconciliation Result. The system persists the Comment by Result ID in SQLite and preserves entered text with Retry when saving fails.

#### FR-15: Broker Email Preview

When Broker details are available, the user can open a Broker Email Preview containing Broker recipient, subject, professional body text, and a table of that Broker’s unmatched Trades with Trade ID, ISIN, buy/sell, amount, quantity, currency, settlement date, mismatch reason, and Comment. The preview provides no send capability and visibly identifies itself as a draft.

#### FR-16: Missing context

When no Trade is selected, the Detail Panel requests selection and broker action is unavailable. When no Broker is available, the system states the reason and returns the user to Trade selection. When preview creation fails, it preserves the selection and provides Retry.

### 4.5 Post-Run Summary and Anomaly Warning

**Description:** The post-run Summary Strip communicates outcome immediately and highlights unusual Unresolved rates without blocking business judgment. Realizes UJ-2.

#### FR-17: Summary Strip

The system displays total Reconciliation Results, matched Results, Unresolved Results, and reconciliation rate immediately after a Reconciliation Run and while investigating results. `unresolved = total - matched`; `unresolved rate = unresolved / total × 100`; and `reconciliation rate = matched / total × 100`. When total is zero, both rates are 0%. Counts are integers and displayed rates are rounded to one decimal place.

#### FR-18: Anomaly Warning

The system calculates the baseline as the arithmetic mean of the Unresolved rates from five seeded historical Reconciliation Runs stored in SQLite; user-created demo reruns do not alter this baseline. The configurable prototype default triggers when the current Unresolved rate is both at least five percentage points above and at least twice the baseline. If fewer than five seeded runs exist, no warning appears and the summary states that history is insufficient. The warning displays the current Unresolved rate and baseline and provides no historical drill-down.

### 4.6 Report Output

**Description:** The prototype concludes by saving a Report to the configured local mock-output directory. Realizes UJ-1.

#### FR-19: Save Report

After the mandatory unmatched review gate is satisfied, the user can save an `.xlsx` Report named `reconciliation-YYYY-MM-DD-{runId}.xlsx` to the configured local mock-output directory, making every rerun collision-safe without overwriting another run. It contains sheets named **Summary**, **Matched**, **Unmatched**, **Missing from Broker**, and **Missing from OT-MUREX**. Summary contains Run ID, As-of date, totals, reconciliation rate, Review progress, and Anomaly Warning values. Record sheets contain all Trade fields, Status, mismatch reason, reviewed state, and Comment where present. Success requires the file to exist at the shown destination and reopen as a valid workbook. On failure, the system retains the Reconciliation Run, identifies the error, and provides Retry.

## 5. Cross-Cutting NFRs and Guardrails

- **NFR-1: Desktop responsiveness.** Test the packaged production build on the hackathon Mac or a baseline Apple M2/16 GB Mac with a 1,000-Result fixture. Across five fresh launches, median cold launch reaches an interactive Dashboard within 2 seconds. Across ten interaction runs, p95 grid selection/filter feedback begins within 100 ms and p95 functional transitions complete within 200 ms. After 60 seconds idle on the Results Workspace, the combined resident memory of all application Electron processes remains at or below 250 MB. Record the device and measurements in the demo verification notes.
- **NFR-2: System integration posture.** The prototype follows system light/dark, reduced-motion, and forced-colors settings; it has no in-app theme toggle requirement.
- **NFR-3: Accessibility.** Keyboard and pointer support all core operations. At demo width the Detail Panel is persistent and row selection retains focus in the Results Grid. Only at constrained widths does it become an **Open inspector** surface: opening moves focus to its heading and closing restores focus to the invoker. Status is never color-only. Polite live regions announce progress/success without moving focus; assertive error regions are associated with affected controls. Text meets WCAG AA 4.5:1 contrast and essential controls, table boundaries, and focus indicators meet 3:1 in both themes.
- **NFR-4: Results semantics.** Implement the Results Grid as a semantic table, not an ARIA composite grid. Column headers and sort buttons expose labels and direction; every row has one focusable **Select trade** control that supports Enter and Space and exposes selected state. Native Tab/Shift+Tab order reaches filters, column controls, row-selection controls, Detail Panel fields, Comment controls, and actions; Escape closes only the constrained-width inspector. The result count, filter state, validation, and save outcomes are programmatically announced, following WCAG 2.2 status and input guidance.
- **NFR-5: Local persistence.** SQLite persists Reconciliation Runs, Reconciliation Results, source Trade records, reviewed state, Comments, mock Broker details, and seeded historical statistics across sessions. A Comment is keyed by Result ID, which belongs to exactly one Run ID, and remains with its original result; reruns start with no carried-forward Comments. When the database is absent, the prototype seeds it once. A documented demo-reset procedure recreates the same seed data outside the business-user flow.
- **NFR-6: Visual discipline.** The application is premium and professional, but not a spreadsheet clone or card-heavy dashboard. It avoids decorative animation, gradients, glass effects, oversized hero content, and modal-only data inspection.
- **NFR-7: Stable desktop layout.** Grid, filter, selected row, Detail Panel, and focus positions remain stable across ordinary state updates. At constrained widths, the Results Grid remains readable and the Detail Panel becomes an explicit keyboard-accessible inspector rather than compressing Trade columns.

## 6. Non-Goals (Explicit)

- Live Outlook, OT/MUREX, shared-folder, or network-file integration.
- Existing VBA mapping migration or parity validation.
- Real email delivery, authentication, scheduling, deployment, multi-user collaboration, or production support processes.
- Historical analytics screens, advanced anomaly modelling, or cloud/LLM capabilities.

## 7. MVP Scope

### In Scope

- Electron desktop shell, Dashboard, As-of date run flow, Results Workspace, Detail Panel, Broker Email Preview, and Report save simulation.
- Seeded mock data and SQLite persistence.
- Mandatory unmatched-Trade review, Comments for Unresolved Trades, summary metrics, and an explainable Anomaly Warning.
- System-theme-aware, accessible, data-dense UI.

## 8. Success Metrics

- **SM-1: Demo completion.** A presenter completes UJ-1 without a dead end in three minutes or less. Validates FR-1–FR-19.
- **SM-2: Information confidence.** A reviewer can find required Trade data, the mismatch reason, Review progress, and the next action from the Results Workspace. Validates FR-8–FR-18.
- **SM-3: Product credibility.** Adhi judges the prototype as a cohesive, professional application rather than a set of mock screens. Validates NFR-1–NFR-7.
- **SM-C1: Visual minimalism.** Do not optimize for low information density or decorative polish at the expense of required Trade data and review controls.

## 9. Open Questions

None for the prototype build.

## 10. Assumptions Index

None.
