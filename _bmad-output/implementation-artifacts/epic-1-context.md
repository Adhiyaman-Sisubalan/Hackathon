# Epic 1 Context: Run a Trusted Reconciliation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the secure desktop foundation and trusted first workflow: users can open the app, navigate its operational surfaces, launch a seeded reconciliation for a valid business date, and arrive at persisted Results. This establishes the durable, deterministic run lifecycle that every later investigation, review, and reporting capability relies on.

## Stories

- Story 1.1: Set Up the Initial Project from the Electron Forge Template
- Story 1.2: Run a Deterministic Seeded Reconciliation
- Story 1.3: Reopen Runs and View Latest Exceptions

## Requirements & Constraints

- Build a local-only macOS Electron prototype from the Electron Forge Vite + TypeScript template. Pin the approved stack in the committed lockfile: Electron 43.4.0, Node 24.18.1, Forge 7.11.2, Vite 8.2.1, React 19.2.8, TypeScript 7.0.2, Zod 4.4.3, TanStack React Table 9.1.2, ExcelJS 4.4.0, Vitest 4.1.10, and Playwright 1.62.1. No runtime server, cloud, or network service is permitted.
- Provide persistent, keyboard-reachable Overview, Reconciliation Runs, and Exceptions destinations. Overview is the Dashboard; Runs shows persisted completed runs; Exceptions opens the newest completed run with every non-matched status selected. Each surface needs a useful first-use empty state, and navigation must be in place rather than URL- or reload-based.
- Dashboard must show a compact loading state, a first-run empty state, or the latest persisted summary (total, matched, Unresolved, reconciliation rate). Local read failures must offer Retry without removing the start action or losing focus context.
- The visibly labelled As-of date defaults to 2026-08-15. Only 2026-08-13, 2026-08-14, and 2026-08-15 can start a run; an invalid or absent selection must state “No seeded data for this date” and return focus to the date control or its linked error summary. Present exactly one adjacent Run reconciliation action.
- During a run, preserve the selected date, prevent duplicate submission, and announce progress politely. At most one reconciliation may be active in main.
- A successful run consumes stable seeded Broker and OT/MUREX Trades, creates a distinct Run ID, and preserves prior reruns. Persist the Run, source Trades, canonical Results, and metrics atomically; any failure leaves no partial run and supports a safe retry.
- Reconcile by the composite ISIN/buy-sell/currency/settlement-date key. Within each source/key group, sort Trade IDs in bytewise ASCII order and pair ordinally. Emit one Result per pair or surplus, using only `matched`, `unmatched`, `missing-from-broker`, and `missing-from-ot-murex`; unmatched Results explain amount, quantity, or both. Keep both source records available as Result evidence.
- Validate unique ASCII-format Trade IDs within each source/run before persistence, failing duplicates with `DUPLICATE_TRADE_ID`. Amount, quantity, and price are canonical decimal strings: domain equality and sorting never use binary floating point, and formatting stays in renderer/report adapters.
- After completion, route in place to the Results Workspace with its summary and Status filters visible. Runs list newest completed first; reopening a Run must load persisted data without recomputation. Stale Run selection after a reset must yield a typed not-found response, refresh the list, and clear stale Results.
- Bootstrap SQLite under Electron userData with ordered transactional migrations and seed version tracking. An absent database receives its seed once; later launches do not reapply migrations. Inject clock, ID generation, fixture registry, database path, and report directory so tests do not depend on environment state.
- Cover secure bootstrap, contracts, dashboard states, navigation, reconciliation pairing/classification, atomic rollback, reruns, invalid dates, duplicate submissions, progress, Results routing, run-history ordering, latest Exceptions, and retry paths with Vitest plus Playwright Electron acceptance tests.

## Technical Decisions

- Use a process-isolated modular monolith: React renderer → named preload API → schema-validating main IPC → application modules → pure domain and ports. The renderer owns temporary view state only; main solely owns SQLite and filesystem access. Domain modules must not import Electron, React, SQLite, filesystem, or Excel APIs.
- Model shared renderer/main commands, queries, events, DTOs, and result envelopes as versioned Zod schemas. Use `area.action.v1` naming: `dashboard.get.v1`, `runs.list.v1`, `run.workspace.get.v1`, `reconciliation.run.v1`, and `reconciliation.progress.v1` are the Epic 1 boundary. Preload exposes named methods only; main validates both sender and payload. Failures are typed envelopes with stable code, safe message, retryability, and optional field.
- Keep `RunAggregate`, `RunsRepository`, and `RunsUnitOfWork` owned by the Runs module. The aggregate holds Run metadata, source Trades, Results, review state, Comments, and metrics; other modules consume published application APIs instead of repositories.
- Use an injected UUID adapter for runtime IDs, `YYYY-MM-DD` business dates, UTC ISO timestamps, kebab-case files, PascalCase entities/components, and application-command-owned transactions. Query DTOs are immutable snapshots; successful commands return the changed aggregate or snapshot for the renderer to replace state.
- Apply secure Electron defaults to every BrowserWindow: sandbox and context isolation enabled, Node integration disabled, restrictive packaged-content CSP, blocked navigation/new windows, hardened packaged fuses, and no raw IPC, SQL, path, or filesystem primitive exposed to renderer code.
- Start from the prescribed project layout: `src/domain`, `src/shared/contracts`, `src/main/{bootstrap,ipc,modules,adapters,workers}`, `src/preload`, `src/renderer/{app,features,components,styles}`, plus `fixtures`, `migrations`, `scripts`, and `tests`. Use `node:sqlite` behind a main-side adapter and `PRAGMA user_version` migrations.

## UX & Interaction Patterns

- Use one `tokens.css` system and CSS Modules/shared semantic primitives. It follows active light/dark, reduced-motion, and forced-colors preferences; no theme toggle or competing UI/token framework. Preserve the professional, dense operational character: no gradients, glass, oversized hero content, decorative motion, or card-heavy layout.
- The compact application shell makes the active destination explicit. Dashboard is the landing view with a quiet operational summary and one visually dominant start action. Use visible focus, keyboard/pointer parity, native reading-order activation, 4.5:1 text contrast, and 3:1 contrast for essential controls, borders, and focus indicators.
- Keep loading, date validation, progress, and error treatments compact and stable. Progress and success use polite live regions; errors are assertive and associated with their affected control. Preserve user input, active navigation, and focus during in-place retries.

## Cross-Story Dependencies

- Story 1.1 establishes the secure process boundary, visual/token foundation, typed Dashboard contracts, migration bootstrap, and in-place `AppView` navigation that Stories 1.2 and 1.3 extend.
- Story 1.2 supplies the persisted Run aggregate, Result snapshots, progress contract, and completion routing required for Story 1.3 to list, reopen, and filter historical runs.
- The basic Results Workspace exposed by this epic is intentionally the handoff point for Epic 2’s summary, grid, filtering, inspection, and review capabilities; preserve its Run summary and Status-filter state contract.
