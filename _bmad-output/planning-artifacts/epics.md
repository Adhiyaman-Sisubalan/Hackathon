---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Hackathon-2026-08-15/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Hackathon-2026-08-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Hackathon-2026-08-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Hackathon-2026-08-15/EXPERIENCE.md
---

# Hackathon - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Hackathon, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The user can navigate with keyboard or pointer between Overview, Reconciliation Runs, and Exceptions; Overview shows the Dashboard, Runs lists and reopens persisted runs, and Exceptions opens the latest run with all Unresolved Status filters selected or an empty state when no completed run exists.

FR2: The Dashboard shows either a first-run empty state or the latest run's total, matched, Unresolved, and reconciliation-rate summary; a local read failure states the problem and offers Retry without removing Run reconciliation.

FR3: The user can select a visibly labelled As-of date and start a run with the sole Run reconciliation action beside it; seeded scenarios are available for 2026-08-13, 2026-08-14, and 2026-08-15 with 2026-08-15 as default, while unsupported dates show No seeded data for this date and return focus to the date control.

FR4: The system prevents duplicate run submission, retains the chosen As-of date, and provides immediate accessible progress feedback while a run is active.

FR5: Each run uses seeded broker and OT/MUREX Trades with stable Trade IDs, creates a new Run ID, and never overwrites an earlier run.

FR6: The system deterministically pairs source records by Reconciliation key and stable Trade-ID order, produces one canonical Result for every pair or surplus record, classifies it as matched, unmatched, missing-from-broker, or missing-from-ot-murex, identifies amount/quantity mismatch reasons, and exposes both source records in detail.

FR7: A completed run routes to the Results Workspace with its summary and Status filters visible.

FR8: The Results Grid shows Counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and Status by default; Trade ID, Broker, source system, trade date, price, account/book, and mismatch reason remain accessible, with aligned tabular numeric data and consistent date formatting.

FR9: The user can filter, sort, and control visible Results columns without altering persisted Result Status.

FR10: An empty filter result shows No matching records with Clear filters, and a run with no Unresolved Results shows an all-resolved state.

FR11: Selecting an unmatched Result idempotently persists it as reviewed and updates reviewed-unmatched over total-unmatched progress.

FR12: Save Report remains disabled until every unmatched Result is reviewed, explains the remaining count, and becomes available automatically when there are zero unmatched Results.

FR13: Selecting a Result updates a persistent adjacent Detail Panel with full source fields and reconciliation reason without leaving the Results Workspace.

FR14: The user can save a Comment on an Unresolved Result by Result ID in SQLite; a failed save preserves the entered text and offers Retry.

FR15: For a Result with Broker details, the user can open a visibly labelled, non-modal draft containing recipient, subject, professional body, and that Broker's unmatched Results with the required fields and Comments; the preview has no send capability.

FR16: With no selected Result, the UI prompts for selection and disables Broker action; with no Broker it explains why and returns to selection; a preview-generation failure preserves selection and offers Retry.

FR17: The system displays total, matched, Unresolved, and reconciliation rate after a run and during investigation, using the specified formulas, a 0% zero-total rule, integer counts, and rates rounded to one decimal place.

FR18: The system computes an Anomaly Warning from the arithmetic mean of exactly five seeded historical Unresolved rates, excludes user-created reruns, requires both the five-percentage-point and two-times configurable thresholds, reports insufficient history below five seeds, and displays current and baseline rates without an analytics drill-down.

FR19: After the unmatched-review gate passes, the user can save a collision-safe `reconciliation-YYYY-MM-DD-{runId}.xlsx` workbook to the configured mock-output directory with Summary and four Status sheets; the system validates that the file exists and reopens correctly, confirms its destination, and preserves the run with Retry on failure.

### NonFunctional Requirements

NFR1: On the target macOS hardware and 1,000-Result fixture, the packaged production build must achieve median interactive cold launch within 2 seconds over five launches, p95 grid/filter feedback within 100 ms and transitions within 200 ms over ten runs, and combined idle Electron RSS at or below 250 MB after 60 seconds, with measurements recorded.

NFR2: The application must automatically follow system light/dark, reduced-motion, and forced-colors settings and must not require an in-app theme toggle.

NFR3: Keyboard and pointer must support every core operation; focus behavior must follow the table/inspector lifecycle; Status cannot rely on color alone; progress/success use polite announcements and associated errors use assertive announcements; text contrast must meet 4.5:1 and essential controls, boundaries, and focus indicators 3:1 in both themes.

NFR4: Results must use a semantic table rather than an ARIA composite grid, expose headers/sort/filter/selected/result-count/validation state, provide labelled row selection activated by Enter or Space, preserve native Tab order through all controls, and use Escape only to close the constrained-width inspector.

NFR5: SQLite must persist runs, source Trades, Results, review state, Comments, Broker details, and seeded history across sessions; Comments belong to Result ID and never carry to reruns; an absent database seeds once; an app-closed documented reset must reproducibly recreate database seed state without deleting Reports.

NFR6: The UI must be premium and professional without becoming a spreadsheet clone or card-heavy dashboard and must avoid decorative motion, gradients, glass effects, oversized hero content, and modal-only inspection.

NFR7: Grid, filters, selected row, Detail Panel, and focus must remain stable through ordinary updates; constrained widths must preserve readable table columns and expose Detail as a keyboard-accessible inspector rather than compressing the grid.

### Additional Requirements

- AR1: Scaffold the greenfield application from the official Electron Forge Vite + TypeScript template and pin the verified stack in `package-lock.json`: Electron 43.4.0, Node 24.18.1, Forge 7.11.2, Vite 8.2.1, React 19.2.8, TypeScript 7.0.2, Zod 4.4.3, TanStack React Table 9.1.2, ExcelJS 4.4.0, Vitest 4.1.10, and Playwright 1.62.1.
- AR2: Implement a process-isolated modular monolith with renderer, preload, main application modules, pure domain, ports, adapters, and the report worker as distinct layers; dependencies point inward and domain code imports no Electron, React, SQLite, filesystem, or Excel code.
- AR3: Keep the renderer sandbox and context isolation enabled, keep `nodeIntegration` disabled, apply a restrictive packaged-content CSP, validate every IPC sender, block navigation/new windows, expose no raw Electron/SQL/path primitives, and harden Electron fuses in the packaged build.
- AR4: Define every renderer/main command, query, event, DTO, success envelope, and typed failure with shared versioned Zod schemas; preload exposes only named methods and main revalidates every payload.
- AR5: Make the main-side boundary the sole owner of SQLite and filesystem access; renderer stores only ephemeral view state and receives immutable DTO snapshots.
- AR6: Make the Runs module the sole owner of `RunAggregate`, `RunsRepository`, and `RunsUnitOfWork`; the aggregate includes run metadata, source Trades, Results, review state, Comments, and metrics, and all other modules use its published application API.
- AR7: Implement reconciliation as one pure deterministic domain function using canonical decimal-string helpers, the PRD Reconciliation key, bytewise ASCII Trade-ID ordering, unique Trade IDs per source/run, and `DUPLICATE_TRADE_ID` failure before persistence.
- AR8: Represent amount, quantity, and price as normalized decimal strings across boundaries and persistence; shared helpers perform equality and sorting, and only renderer/report adapters format them.
- AR9: Enforce at most one active reconciliation and atomically persist each new Run ID, source Trades, Results, and metrics in one Runs Unit-of-Work transaction.
- AR10: Enforce review, Comment, Broker Preview membership, and Report Save eligibility in main from reloaded authoritative state; renderer disabled states are hints, not security or business-rule enforcement, and mutation commands are idempotent set-to-value operations.
- AR11: Compute anomaly baseline only from exactly five versioned seeded historical Runs, exclude user Runs, return `insufficient-history` below five, and source both warning thresholds from typed configuration.
- AR12: Use `PRAGMA user_version` ordered transactional SQLite migrations, import versioned fixtures only after migrations and only when the seed version is absent, and provide an app-closed `npm run demo:reset` that reuses migration/seed services without deleting Reports.
- AR13: Generate Reports from an immutable `RunReportV1` created in the same Runs read transaction that evaluates eligibility, so gate state and workbook contents share one snapshot.
- AR14: Run ExcelJS generation and reopen-validation in a Node worker that accepts only a validated `RunReportV1` and operation-scoped temporary path and returns `WorkerReportReceiptV1`; main alone atomically renames the verified temporary file to its final collision-safe path.
- AR15: Use typed progress events and safe result envelopes with stable code, message, retryable flag, and optional field; retain renderer input until success and log structured operation/code/Run ID/Result ID/duration without full Trades or Comment bodies.
- AR16: Use a native semantic table powered by the pinned TanStack Table v9 release for client-side filtering, sorting, selection, and column visibility; do not virtualize the 1,000-Result prototype fixture.
- AR17: Use view-level hooks and returned command/query DTOs for renderer data; keep filter, sort, selection, inspector, navigation, and draft state in their owning features, with no Redux, Zustand, localStorage persistence cache, router library, or URL-derived state.
- AR18: Implement a closed `AppView` union for Overview, Runs, and Exceptions plus optional selected Run ID, with in-place state transitions and no renderer reloads.
- AR19: Implement `DESIGN.md` through one `tokens.css` source plus CSS Modules and shared semantic primitives; do not introduce a second UI kit, skin, or utility-token system.
- AR20: Inject clock, ID generator, fixture registry, database path, and report directory ports so unit/integration tests never depend on wall time, random runtime IDs, Electron `userData`, or OS dialogs.
- AR21: Provide Vitest unit/contract/integration coverage and Playwright Electron acceptance coverage, including deterministic dialog/path substitutes and recorded NFR1 verification on the packaged build.
- AR22: Package one macOS desktop application with one SQLite database under Electron `userData`, bundled immutable fixtures, and a configured local mock-output directory; require no server, cloud, or network service at runtime.
- AR23: Follow the architecture source seed: `src/domain`, `src/shared/contracts`, `src/main/{bootstrap,ipc,modules,adapters,workers}`, `src/preload`, `src/renderer/{app,features,components,styles}`, plus `fixtures`, `migrations`, `scripts`, and `tests`.
- AR24: Use project-wide conventions: kebab-case files, PascalCase entities/components, versioned `area.action.v1` IPC names, opaque injected UUID runtime IDs, `YYYY-MM-DD` business dates, UTC ISO timestamps, four canonical Status IDs, transactions owned by application commands, and typed bootstrap configuration.

### UX Design Requirements

UX-DR1: Implement every `DESIGN.md` light/dark color token for canvas, surfaces, primary/secondary text, borders, accent/foreground, focus, success, warning, and danger in the sole runtime token system, with direct active-OS theme mapping.

UX-DR2: Implement the exact display, heading, section, body, label, and data typography tokens using the platform-native system sans stack; use tabular numerals for amount, quantity, rate, price, and date data and avoid decorative display type or all-caps data labels.

UX-DR3: Implement the 4px spacing scale and named control/card/panel/pill radii consistently, using compact internal spacing and larger separation between operational sections without excessive rounding.

UX-DR4: Build `application-shell` as compact persistent navigation for Overview, Reconciliation Runs, and Exceptions, with an explicit active destination, keyboard reachability, no marketing header, and no reload-based navigation.

UX-DR5: Build `dashboard` with loading skeleton, first-use empty state, latest summary, inline anomaly context, and exactly one visually dominant `primary-action` for reconciliation.

UX-DR6: Build `as-of-date-control` as a compact visibly labelled control with required-state and associated validation text; invalid submission focuses the control or linked error summary.

UX-DR7: Build `summary-strip` as a compact stable surface showing total, matched, Unresolved, reconciliation rate, review progress where relevant, and an amber non-blocking anomaly message with current and baseline rates.

UX-DR8: Build `results-grid` as a dense semantic table with quiet borders, stable selected-row treatment, labelled filter/sort/column controls, aligned values, and announced total/filtered counts, sort direction, and selection.

UX-DR9: Build `status-treatment` using the canonical label plus semantic color and a distinct icon or shape; missing/failed states may use danger, Unresolved context uses warning, and no status may rely on color alone.

UX-DR10: Build `detail-panel` as a persistent adjacent, raised inspection surface at demo width that updates without moving table focus; it must never be a modal-only experience.

UX-DR11: Build `inspector-toggle` for constrained widths with expanded/collapsed state, preserved selected-record context, focus moved to the panel heading on explicit open, and focus returned to the invoker on close.

UX-DR12: Build `comments` as a labelled editable control for the selected Unresolved Result with clear save feedback; failure preserves text and focus context, associates an assertive error, and exposes Retry.

UX-DR13: Build `broker-email-preview` as a labelled non-modal Detail Panel section with Broker/Trade context, a visible draft state, no Send action, retry/back-to-detail recovery, and a keyboard return route.

UX-DR14: Build `report-save` with the unmatched-review disabled explanation, a single clear save action when eligible, polite success including the saved destination, and linked assertive failure with Retry while retaining the Run.

UX-DR15: Build shared `feedback` primitives for compact loading skeletons, inline validation, No matching records with Clear filters, all-resolved state, no-selection/no-Broker states, polite progress/success regions, and assertive control-associated error regions.

UX-DR16: Follow active system light/dark automatically, remove nonessential transitions under reduced motion, and use OS system colors under forced-colors so focus, selection, Status, validation, warnings, and errors remain distinct.

UX-DR17: Meet the accessibility floor across both themes: 4.5:1 text and 3:1 essential control/boundary/focus contrast; keyboard and pointer parity; reading-order focus; Enter/Space activation; exposed table headers, sort/filter/selection/result count, validation, and panel landmarks.

UX-DR18: Keep the desktop Results composition structurally stable: grid retains visual priority, Detail Panel remains adjacent at demo width, constrained layouts expose the inspector without squeezing required columns, and filters/selection/focus do not jump during updates.

UX-DR19: Keep transitions short, functional, interruptible, and removable; do not use decorative animation, gradients, glass effects, dramatic shadows, oversized hero content, stacked floating cards, or effects that make the app feel web-like or sluggish.

UX-DR20: Preserve in-place context through all state patterns: Dashboard read Retry retains the start action; running retains the date and prevents duplicates; completed routes to Results; filter empty preserves filters; comment/report/draft failures retain Run, selection, input, and focus.

UX-DR21: Use plain, calm, operational copy that names what happened, why it matters, and the next action; use Preview broker email and Email draft ready, never Sent, and describe anomaly as a warning for human judgment rather than a failure.

UX-DR22: Ensure the full three-minute Priya flow is visually and interactively continuous from Dashboard through run, summary, filters, unmatched review, detail/Comments, Broker drafts, and successful Report destination confirmation.

### FR Coverage Map

FR1: Epic 1 - Navigate Overview, persisted Runs, and the latest-run Exceptions view.
FR2: Epic 1 - See the first-use or latest-run Dashboard and recover from read failure.
FR3: Epic 1 - Select a supported As-of date and start through the sole Run action.
FR4: Epic 1 - Prevent duplicate submission and receive retained-date progress feedback.
FR5: Epic 1 - Run stable seeded inputs under a new, non-overwriting Run ID.
FR6: Epic 1 - Deterministically pair, classify, and explain Reconciliation Results.
FR7: Epic 1 - Route completed runs to Results with summary and Status filters.
FR8: Epic 2 - View required and optional Trade data with operational alignment.
FR9: Epic 2 - Filter, sort, and control visible columns without mutating Status.
FR10: Epic 2 - Recover from empty filters and recognize an all-resolved run.
FR11: Epic 2 - Persist idempotent unmatched review and track review progress.
FR12: Epic 3 - Enforce and explain the mandatory unmatched-review Report gate.
FR13: Epic 2 - Inspect complete source evidence in an adjacent Detail Panel.
FR14: Epic 3 - Persist Comments on Unresolved Results with context-preserving Retry.
FR15: Epic 3 - Preview a Broker-specific unmatched-Result email draft without sending.
FR16: Epic 3 - Handle missing selection, Broker context, and preview failure safely.
FR17: Epic 2 - Show exact post-run summary counts and rates.
FR18: Epic 2 - Show an explainable, non-blocking seeded-history Anomaly Warning.
FR19: Epic 3 - Generate, validate, publish, and confirm a collision-safe XLSX Report.

## Epic List

### Epic 1: Run a Trusted Reconciliation
The user can launch the desktop application, navigate operational views, select a seeded date, run deterministic reconciliation, and reach persisted Results.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7.

**Implementation notes:** Deliver the Electron scaffold inside the first user-facing story, then establish secure process boundaries, SQLite migrations and seeding, deterministic reconciliation, typed IPC, Dashboard states, accessible progress, and completed-run routing.

### Epic 2: Investigate and Review Reconciliation Outcomes
The user can understand the Result summary and Anomaly Warning, filter and inspect dense Trade data, compare both source records, and review every unmatched Result.
**FRs covered:** FR8, FR9, FR10, FR11, FR13, FR17, FR18.

**Implementation notes:** Deliver the semantic Results table, stable grid/detail workspace, filters, sorting, column controls, review persistence, summary formulas, seeded anomaly calculation, responsive inspector, and required accessibility lifecycle.

### Epic 3: Resolve Exceptions and Complete the Run
The user can document Unresolved Results, prepare Broker follow-up, satisfy the mandatory review gate, and save a verified reconciliation workbook.
**FRs covered:** FR12, FR14, FR15, FR16, FR19.

**Implementation notes:** Deliver Comments, Broker Email Preview, authoritative eligibility rules, context-preserving failure recovery, same-snapshot Report preparation, worker-based workbook validation, atomic publication, and destination confirmation.

## Epic 1: Run a Trusted Reconciliation

The user can launch the desktop application, navigate operational views, select a seeded date, run deterministic reconciliation, and reach persisted Results.

### Story 1.1: Set Up the Initial Project from the Electron Forge Template

As a reconciliation operations user,
I want to open a secure, polished desktop application and navigate its operational views,
So that I can immediately understand the application state and begin my daily workflow.

**FRs implemented:** FR1, FR2.

**Acceptance Criteria:**

**Given** a clean project checkout
**When** the project is scaffolded from the official Electron Forge Vite + TypeScript template and the pinned dependencies are installed
**Then** the Electron application starts or packages and opens directly to the Dashboard
**And** the approved stack versions are pinned in `package-lock.json`.

**Given** the application window is created
**When** its Electron security configuration is inspected
**Then** renderer sandboxing and context isolation are enabled and Node integration is disabled
**And** a restrictive CSP, blocked external navigation/new windows, hardened fuses, and an allowlisted preload boundary are configured.

**Given** the application is open
**When** the user navigates using keyboard or pointer
**Then** Overview, Reconciliation Runs, and Exceptions are reachable in reading order
**And** the active destination is explicit without a page reload or URL router.

**Given** no completed user Run exists
**When** Overview, Reconciliation Runs, or Exceptions is opened
**Then** each surface shows its appropriate calm first-use empty state
**And** no inactive or misleading action is presented.

**Given** a persisted completed Run summary exists
**When** the Dashboard loads successfully
**Then** it shows total, matched, Unresolved, and reconciliation-rate values
**And** the values come through the typed Dashboard query contract rather than direct renderer persistence access.

**Given** Dashboard data is still loading
**When** the view renders
**Then** a compact loading skeleton is shown
**And** the layout does not jump when the result replaces it.

**Given** the Dashboard query fails
**When** the failure is returned
**Then** the UI states the problem in calm operational language and offers Retry
**And** retry succeeds in place without reloading the renderer or losing focus context.

**Given** the prototype database does not exist
**When** the application starts
**Then** the minimal ordered SQLite migration required for Run summaries is applied under Electron `userData`
**And** subsequent launches do not reapply the completed migration.

**Given** the operating system changes between light, dark, reduced-motion, or forced-colors modes
**When** the application is displayed
**Then** the sole `tokens.css` system applies the approved visual tokens and accessibility behavior automatically
**And** there is no in-app theme toggle or competing UI token framework.

**Given** the application is operated with keyboard-only input
**When** focus moves through navigation and Dashboard controls
**Then** focus is visible, activation works with standard keys, and progress/errors are exposed through the appropriate live regions
**And** required contrast floors are met in both themes.

**Given** automated verification runs
**When** Vitest and Playwright suites execute
**Then** they cover bootstrap configuration, typed shell contracts, first-use/latest/error Dashboard states, keyboard navigation, and secure window defaults
**And** the packaged macOS build launches without requiring a server or network service at runtime.

### Story 1.2: Run a Deterministic Seeded Reconciliation

As a reconciliation operations user,
I want to select a supported business date and run reconciliation against seeded Broker and OT/MUREX Trades,
So that I receive trustworthy, reproducible Results without relying on enterprise integrations.

**FRs implemented:** FR3, FR4, FR5, FR6, FR7.

**Acceptance Criteria:**

**Given** the Dashboard is ready
**When** the reconciliation controls appear
**Then** the visibly labelled As-of date defaults to `2026-08-15` and supports `2026-08-13`, `2026-08-14`, and `2026-08-15`
**And** exactly one **Run reconciliation** action appears beside it.

**Given** the user selects an unsupported or missing date
**When** Run reconciliation is activated
**Then** no Run command is started and **No seeded data for this date** is associated with the date control
**And** focus returns to the date control or its linked error summary.

**Given** a supported date is selected
**When** Run reconciliation is activated
**Then** the chosen date remains visible, duplicate submission is disabled, and polite progress is announced
**And** main accepts at most one active reconciliation command.

**Given** a seeded scenario is loaded
**When** source Trades are validated
**Then** every Trade ID matches the required ASCII format and is unique within its Run and source
**And** a duplicate fails with `DUPLICATE_TRADE_ID` before any Run data is committed.

**Given** Broker and OT/MUREX records share a Reconciliation key
**When** the pure reconciliation engine executes
**Then** each source group is ordered by bytewise ASCII Trade ID and paired by ordinal position
**And** every pair or surplus source record creates exactly one canonical Reconciliation Result.

**Given** a paired Result has equal normalized amount and quantity
**When** it is classified
**Then** its Status is `matched`
**And** paired Results with a differing amount, quantity, or both receive `unmatched` and the corresponding mismatch reason.

**Given** a source record has no remaining counterpart
**When** classification completes
**Then** an OT/MUREX-only record becomes `missing-from-broker` and a Broker-only record becomes `missing-from-ot-murex`
**And** both available source evidence and the reconciliation reason are retained in the Result.

**Given** amount, quantity, or price enters the domain boundary
**When** it is validated, persisted, compared, or sorted
**Then** it uses the normalized decimal-string contract rather than binary floating-point equality
**And** formatting occurs only in presentation or Report adapters.

**Given** reconciliation completes successfully
**When** the Runs Unit of Work commits
**Then** a new Run ID, source Trades, Results, and metrics are persisted atomically
**And** rerunning the same date creates a separate Run without overwriting previous data.

**Given** reconciliation completes
**When** the success response reaches the renderer
**Then** the application routes in place to the basic Results Workspace with Run summary and Status filters visible
**And** the typed response replaces renderer state without direct SQLite access or a page reload.

**Given** reconciliation or persistence fails
**When** the typed failure is returned
**Then** no partial Run remains, the selected date is preserved, and a safe retryable message is announced
**And** Retry starts the same operation without duplicate side effects.

**Given** automated verification runs
**When** domain, contract, persistence, and Electron acceptance tests execute
**Then** fixtures cover all four Status values, amount/quantity mismatch reasons, duplicate-key ordinal pairing, surplus records, duplicate Trade IDs, atomic rollback, reruns, invalid dates, duplicate submission, progress, and Results routing
**And** deterministic clock, ID, fixture, and database-path adapters make the tests reproducible.

### Story 1.3: Reopen Runs and View Latest Exceptions

As a reconciliation operations user,
I want to reopen completed Runs and jump directly to the latest exceptions,
So that I can resume investigation without rerunning reconciliation or losing historical context.

**FRs implemented:** FR1.

**Acceptance Criteria:**

**Given** one or more completed Runs are persisted
**When** the user opens Reconciliation Runs
**Then** the application lists each Run’s Run ID, As-of date, completion time, total, matched, Unresolved, and reconciliation rate
**And** Runs appear in deterministic newest-completed-first order.

**Given** no completed Run exists
**When** the user opens Reconciliation Runs
**Then** a calm empty state explains that no reconciliation has been completed
**And** the user can return to Overview using the persistent application navigation.

**Given** the Runs list is visible
**When** the user activates a Run using keyboard or pointer
**Then** its persisted Results Workspace opens with the correct summary and Status filters
**And** the application does not recompute reconciliation or create a new Run ID.

**Given** completed Runs exist
**When** the user opens Exceptions
**Then** the latest completed Run opens with `unmatched`, `missing-from-broker`, and `missing-from-ot-murex` selected
**And** `matched` is not selected.

**Given** the latest completed Run has no Unresolved Results
**When** Exceptions opens
**Then** the Results Workspace shows its all-resolved state
**And** the completed Run’s summary remains available.

**Given** no completed Run exists
**When** the user opens Exceptions
**Then** the surface shows an empty state rather than an error or fabricated Result
**And** it directs the user back to Overview to start reconciliation.

**Given** a listed Run becomes unavailable because the prototype database was reset
**When** the user attempts to open it from stale renderer state
**Then** main returns a typed not-found failure and the renderer refreshes the Runs list
**And** the error is announced without reloading the application or leaving stale Result data visible.

**Given** a Runs query fails
**When** the failure is displayed
**Then** the user receives a linked Retry action in calm operational language
**And** the active navigation destination and focus context are retained.

**Given** the user navigates between Overview, Reconciliation Runs, Exceptions, and a selected Run
**When** each destination changes
**Then** the closed `AppView` state updates in place and the active destination remains explicit
**And** no router, URL state, or renderer reload is introduced.

**Given** automated verification runs
**When** persistence, contract, accessibility, and Electron acceptance tests execute
**Then** they cover empty and populated Run history, deterministic ordering, reopening without recomputation, latest-Exceptions filtering, all-resolved behavior, stale Run recovery, keyboard navigation, and Retry
**And** previous Runs remain unchanged after later reruns.

## Epic 2: Investigate and Review Reconciliation Outcomes

The user can understand the Result summary and Anomaly Warning, filter and inspect dense Trade data, compare both source records, and review every unmatched Result.

### Story 2.1: Understand the Run Summary and Anomaly Context

As a reconciliation operations user,
I want a clear summary of the current Run and any unusual exception rate,
So that I can immediately judge the outcome and decide where to investigate.

**FRs implemented:** FR17, FR18.

**Acceptance Criteria:**

**Given** a completed Run contains Reconciliation Results
**When** its summary is calculated
**Then** total equals the number of Results, matched equals Results with `matched` Status, and Unresolved equals total minus matched
**And** counts are displayed as integers.

**Given** a completed Run has one or more Results
**When** rates are calculated
**Then** reconciliation rate equals `matched / total × 100` and Unresolved rate equals `Unresolved / total × 100`
**And** displayed rates are rounded to one decimal place.

**Given** a completed Run has zero Results
**When** its summary is displayed
**Then** reconciliation and Unresolved rates both show `0.0%`
**And** no division error, `NaN`, or infinite value appears.

**Given** the user is on the Dashboard or Results Workspace
**When** the latest or selected completed Run loads
**Then** the same persisted total, matched, Unresolved, and reconciliation-rate values appear in the compact Summary Strip
**And** the Results Workspace retains the summary while the user investigates.

**Given** exactly five seeded historical Runs are available
**When** the anomaly baseline is calculated
**Then** it is the arithmetic mean of their Unresolved rates
**And** user-created Runs and reruns are excluded from the baseline.

**Given** the current Unresolved rate is evaluated
**When** it is at least five percentage points above and at least twice the unrounded seeded baseline
**Then** an amber non-blocking Anomaly Warning appears with the current and baseline rates rounded to one decimal place
**And** both configured conditions must pass before the warning appears.

**Given** the current rate does not satisfy both conditions
**When** the summary is displayed
**Then** no Anomaly Warning is shown
**And** the ordinary summary remains unchanged.

**Given** fewer than five seeded historical Runs are available
**When** anomaly calculation is requested
**Then** the domain returns `insufficient-history` and no warning is shown
**And** the summary states that history is insufficient without treating it as a Run failure.

**Given** additional user-created Runs are completed
**When** the same seeded scenario is evaluated again
**Then** the five-run baseline remains unchanged
**And** the threshold values come from typed bootstrap configuration rather than renderer constants.

**Given** an Anomaly Warning is visible
**When** the user reads or navigates through it
**Then** it is communicated as a warning for human judgment rather than an error
**And** it provides no analytics drill-down, blocking dialog, or decorative alarm treatment.

**Given** system theme, forced-colors, or assistive technology is active
**When** the Summary Strip and warning render
**Then** labels, values, warning semantics, and current/baseline context remain programmatically discernible without color alone
**And** contrast and polite announcement requirements are satisfied.

**Given** automated verification runs
**When** domain, persistence, component, accessibility, and Electron tests execute
**Then** they cover exact formulas, zero totals, display rounding, threshold boundary values, two-condition enforcement, five-seed provenance, insufficient history, rerun exclusion, Dashboard/Results consistency, and system modes
**And** anomaly calculations are deterministic under injected fixtures and configuration.

### Story 2.2: Explore and Filter Reconciliation Results

As a reconciliation operations user,
I want to scan, filter, sort, and configure the Results table,
So that I can quickly isolate the Trades requiring investigation without losing operational context.

**FRs implemented:** FR8, FR9, FR10.

**Acceptance Criteria:**

**Given** a completed Run is opened
**When** the Results Workspace loads
**Then** a native semantic table displays Counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and Status by default
**And** it is not implemented as an ARIA composite grid.

**Given** a Result has both source records
**When** its primary row values are rendered
**Then** Broker-side display values are used
**And** a Result without a Broker record uses the available OT/MUREX values.

**Given** the user opens column controls
**When** column visibility is changed
**Then** Trade ID, Broker, source system, trade date, price, account/book, and mismatch reason can be shown or hidden without leaving the workspace
**And** the underlying Result data remains unchanged.

**Given** amount, quantity, price, rate, or date values are displayed
**When** the table renders or sorts them
**Then** numeric data uses tabular numerals and right alignment, dates use one consistent format and alignment, and decimal sorting uses the shared normalized-decimal helper
**And** binary floating-point or formatted-text ordering does not determine the result.

**Given** Results contain different Status values
**When** Status is rendered
**Then** each row uses the canonical Status label with semantic color and a distinct icon or shape
**And** Status remains understandable in dark mode, forced-colors mode, and without color perception.

**Given** the user changes one or more Status filters
**When** filtering is applied
**Then** only matching Results remain visible, filtered and total counts are announced, and the Summary Strip remains unchanged
**And** persisted Result Status values are not modified.

**Given** the user activates a sortable column header
**When** sort direction changes
**Then** rows are reordered using the column’s domain-appropriate comparator and the direction is programmatically exposed
**And** sorting does not alter selection identity or persisted data.

**Given** filters produce zero visible Results
**When** the filtered table renders
**Then** it states **No matching records** and offers **Clear filters**
**And** the active filters remain visible until the user clears them.

**Given** the Run contains no Unresolved Results
**When** the Results Workspace opens
**Then** an all-resolved state is shown while matched Results remain inspectable
**And** the Run summary and table controls remain available.

**Given** the user moves through filters, column controls, sort controls, and row-selection controls with the keyboard
**When** Tab, Shift+Tab, Enter, or Space is used
**Then** controls follow reading order, expose accessible names and state, and use native activation behavior
**And** no required operation depends on hover.

**Given** a Results query fails
**When** the typed failure is displayed
**Then** the selected Run and Summary Strip remain in context and a linked Retry action is announced
**And** retry replaces the failed state without a page reload.

**Given** the 1,000-Result acceptance fixture is loaded
**When** filtering, sorting, column visibility, or selection is changed across ten measured runs
**Then** p95 feedback begins within 100 ms without table virtualization
**And** the grid, toolbar, summary, and focus positions remain stable.

**Given** automated verification runs
**When** domain-helper, table, accessibility, performance, and Electron tests execute
**Then** they cover every required and optional column, source fallback, decimal/date ordering, each Status treatment, multi-Status filtering, sort direction, column visibility, empty filters, all-resolved state, keyboard operation, Retry, and the 1,000-Result fixture
**And** table state remains renderer-owned and is never persisted as business data.

### Story 2.3: Inspect and Review Unmatched Results

As a reconciliation operations user,
I want to inspect complete source evidence and record that each unmatched Result was reviewed,
So that I can understand discrepancies and demonstrate that the required investigation occurred.

**FRs implemented:** FR11, FR13.

**Acceptance Criteria:**

**Given** a Result row is visible
**When** the user activates its labelled Select trade control with keyboard or pointer
**Then** the row exposes selected state and the adjacent Detail Panel updates to that Result
**And** ordinary row selection retains focus in the table.

**Given** the selected Result contains Broker and OT/MUREX records
**When** the Detail Panel renders
**Then** it exposes all available fields from both source records, the Reconciliation key, canonical Status, and reconciliation reason
**And** differing amount and quantity values are clearly attributable to their source.

**Given** the selected Result has only one source record
**When** the Detail Panel renders
**Then** the available source evidence is shown and the absent side is explicitly identified
**And** the appropriate missing Status and reason remain visible.

**Given** an unmatched Result has not been reviewed
**When** it is selected
**Then** main reloads authoritative Result state and idempotently sets `reviewed = true` by Result ID
**And** Review progress updates to `reviewed unmatched / total unmatched`.

**Given** an already reviewed unmatched Result is selected again or the review command is retried
**When** `result.review.v1` executes
**Then** the Result remains reviewed and the reviewed count does not increment twice
**And** the command returns the resulting DTO rather than toggling state.

**Given** a selected Result has `matched`, `missing-from-broker`, or `missing-from-ot-murex` Status
**When** it is inspected
**Then** its evidence remains fully available
**And** it is not counted as requiring unmatched review.

**Given** all unmatched Results are reviewed
**When** Review progress updates
**Then** it shows the reviewed count equal to total unmatched
**And** a zero-unmatched Run reports the review requirement as already satisfied.

**Given** review persistence fails
**When** the typed failure is returned
**Then** selection, Detail content, table focus, filters, and scroll context remain intact and an assertive linked error offers Retry
**And** the UI does not falsely present the Result as reviewed.

**Given** a reviewed Run is closed and reopened
**When** its Results Workspace loads again
**Then** reviewed state and Review progress are restored from the Run aggregate
**And** review state does not carry into a later rerun.

**Given** the workspace is at the intended demo width
**When** a Result is selected
**Then** the table and persistent adjacent Detail Panel remain visible together, with the table retaining visual priority
**And** inspection does not open a modal or compress required columns.

**Given** the workspace is constrained
**When** the user activates **Open inspector**
**Then** the selected Result opens in the inspector and focus moves to its heading
**And** closing it with its control or Escape restores focus to the invoker without clearing selection.

**Given** system theme, reduced motion, or forced-colors mode is active
**When** selection, review state, mismatch evidence, and the inspector render
**Then** every state remains understandable without color alone and transitions are short, interruptible, or removed
**And** required text, boundary, and focus contrast is preserved.

**Given** automated verification runs
**When** domain, persistence, component, accessibility, responsive, and Electron tests execute
**Then** they cover paired and missing-side detail, source attribution, first and repeated unmatched review, non-reviewable Statuses, zero and complete progress, save failure and Retry, rerun isolation, focus retention, inspector lifecycle, and system modes
**And** every review mutation is enforced through the Runs application API rather than renderer-only state.

## Epic 3: Resolve Exceptions and Complete the Run

The user can document Unresolved Results, prepare Broker follow-up, satisfy the mandatory review gate, and save a verified reconciliation workbook.

### Story 3.1: Add and Persist Resolution Comments

As a reconciliation operations user,
I want to add comments to unresolved Results,
So that I can document investigation findings and required follow-up.

**FRs implemented:** FR14.

**Acceptance Criteria:**

**Given** an unresolved Result is selected
**When** the Detail Panel opens
**Then** it shows a clearly labelled Comment field and Save comment action
**And** any previously saved comment is loaded by Result ID.

**Given** the user enters a comment
**When** Save comment is activated
**Then** main validates that the Result belongs to the active Run and remains unresolved
**And** the comment is persisted in SQLite within the Run aggregate.

**Given** a comment already exists
**When** the user saves an updated value or retries the same value
**Then** the command sets the comment to that value idempotently
**And** duplicate comments are not created.

**Given** the comment saves successfully
**When** confirmation is returned
**Then** the saved value remains visible and a polite success message is announced
**And** the selected row, filters, scroll position, and Detail Panel remain stable.

**Given** comment persistence fails
**When** a typed retryable failure is returned
**Then** the entered text, selection, and focus context are preserved
**And** an associated assertive error provides Retry without requiring re-entry.

**Given** a matched Result is selected
**When** the Comment section renders
**Then** editing and saving are unavailable with an explanation that comments are for unresolved Results
**And** its source evidence remains inspectable.

**Given** no Result is selected
**When** the user reaches the Comment area
**Then** the interface prompts them to select an unresolved Result
**And** no comment command is submitted.

**Given** the Run is closed and reopened
**When** the same Result is selected
**Then** its saved comment is restored from SQLite
**And** comments never carry into a new reconciliation Run.

**Given** keyboard-only, forced-colors, reduced-motion, light, or dark mode is used
**When** the comment workflow is completed
**Then** labels, focus, validation, success, and failure states remain accessible
**And** the workflow does not depend on hover, color, or decorative motion.

**Given** automated tests execute
**Then** they cover unresolved-status eligibility, matched and no-selection states, creation, update, retry, persistence across restart, and rerun isolation
**And** comment authorization is enforced by the main-side Runs API rather than renderer state.

### Story 3.2: Preview Broker Follow-up Emails

As a reconciliation operations user,
I want to preview a broker-specific follow-up email for an unmatched trade,
So that I can verify the communication and supporting trade details before taking external action.

**FRs implemented:** FR15, FR16.

**Acceptance Criteria:**

**Given** an unmatched Result with Broker details is selected
**When** the user activates **Preview broker email**
**Then** a non-modal draft opens within the Detail Panel
**And** it clearly displays the recipient, subject, professional message body, and **Draft** status.

**Given** the draft is generated
**When** its supporting trade table renders
**Then** it contains only that Broker's `unmatched` Results from the selected Run
**And** each row shows Trade ID, ISIN, buy/sell, amount, quantity, currency, settlement date, mismatch reason, and Comment.

**Given** the selected Broker has multiple unmatched Results
**When** the preview opens
**Then** all applicable Results are included exactly once
**And** Results belonging to other Brokers or missing-record statuses are excluded.

**Given** preview generation is requested
**When** main processes the command
**Then** it reloads authoritative Run state and validates the selected Result and Broker membership
**And** the renderer cannot supply or alter the authoritative trade collection.

**Given** the preview is displayed
**When** the user reviews its actions
**Then** no Send action or live email integration exists
**And** the interface says **Email draft ready**, never **Sent**.

**Given** no Result is selected
**When** the broker action area renders
**Then** it prompts the user to select a Result and disables preview generation
**And** no command is submitted.

**Given** the selected Result has no Broker details
**When** the broker action area renders
**Then** it plainly explains why a draft cannot be prepared
**And** the user can return to Results selection without losing context.

**Given** preview generation fails
**When** a typed failure is returned
**Then** the selected Result, filters, comments, and Detail context remain intact
**And** an associated assertive error offers Retry and Back to detail.

**Given** the user opens and closes the preview with a keyboard
**When** the interaction completes
**Then** focus moves into the preview only through an explicit action and returns to its invoker on close
**And** the preview remains usable in constrained-width inspector mode.

**Given** automated tests execute
**Then** they verify Broker scoping, required fields, missing selection, missing Broker, failure recovery, keyboard focus, and the absence of sending capability
**And** all generated preview data comes through versioned typed contracts.

### Story 3.3: Enforce Review Completion and Save the Verified Report

As a reconciliation operations user,
I want the application to verify review completion and save a complete reconciliation workbook,
So that I can finish the run with a trustworthy report in the shared output location.

**FRs implemented:** FR12, FR19.

**Acceptance Criteria:**

**Given** one or more unmatched Results remain unreviewed
**When** the Results Workspace renders
**Then** **Save report** is disabled and explains the exact remaining count
**And** reviewing missing-record statuses does not satisfy the unmatched-review gate.

**Given** every unmatched Result is reviewed
**When** review progress updates
**Then** **Save report** becomes available without a reload
**And** a Run containing zero unmatched Results is automatically eligible.

**Given** report saving is requested
**When** main processes the command
**Then** it reloads authoritative Run state and independently enforces eligibility
**And** renderer state cannot bypass the review gate.

**Given** the Run is eligible
**When** report preparation begins
**Then** eligibility and `RunReportV1` contents are read from the same SQLite transaction snapshot
**And** that immutable snapshot includes summary metrics, Results, source evidence, review state, and Comments.

**Given** the workbook is generated
**When** its structure is inspected
**Then** it contains **Summary**, **Matched**, **Unmatched**, **Missing from Broker**, and **Missing from OT-MUREX** sheets
**And** each Result sheet contains the complete required trade fields, Status, mismatch reason, review state, and Comment.

**Given** a valid `RunReportV1` and operation-scoped temporary path
**When** the report worker executes
**Then** ExcelJS writes the workbook, reopens it, verifies its required sheets and content, and returns a validated receipt
**And** workbook processing does not block the Electron main event loop.

**Given** worker verification succeeds
**When** main publishes the report
**Then** it atomically renames the temporary file into the configured mock-output directory
**And** the final collision-safe name follows `reconciliation-YYYY-MM-DD-{runId}.xlsx`.

**Given** saving succeeds
**When** publication completes
**Then** a polite confirmation displays the full saved destination
**And** the current Run, filters, selection, Comments, and review state remain available.

**Given** generation, validation, or publication fails
**When** a typed failure is returned
**Then** only the operation's temporary artifact is cleaned up while the Run and user state are preserved
**And** an associated assertive error offers Retry.

**Given** a report was saved and the Run is later changed
**When** another report is requested
**Then** it uses a new authoritative snapshot and produces a collision-safe output
**And** the already published workbook remains unchanged.

**Given** the documented app-closed demo reset is executed
**When** the database is recreated and fixtures are reseeded
**Then** previously generated reports remain untouched
**And** subsequent runs can save new reports normally.

**Given** automated verification runs
**Then** tests cover incomplete, complete, and zero-unmatched gates; snapshot consistency; exact workbook structure; reopen validation; atomic publication; filename collisions; failure cleanup; retry; and report preservation
**And** the packaged prototype supports the continuous three-minute Dashboard-to-report demonstration within the recorded performance targets.
