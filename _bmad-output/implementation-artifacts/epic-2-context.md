# Epic 2 Context: Investigate and Review Reconciliation Outcomes

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give reconciliation operators a dense, trustworthy workspace for understanding a completed run, isolating the records that need attention, examining complete source evidence, and recording completed unmatched-trade reviews. The workspace must keep the run summary and investigation context stable so an anomaly or discrepancy becomes specific, actionable work rather than an interruption or a separate analytics flow.

## Stories

- Story 2.1: Understand the Run Summary and Anomaly Context
- Story 2.2: Explore and Filter Reconciliation Results
- Story 2.3: Inspect and Review Unmatched Results

## Requirements & Constraints

- Show the selected run's persisted total Results, matched Results, Unresolved Results, and reconciliation rate throughout investigation. Unresolved is every Status other than `matched`; total is the Result count, matched is the `matched` count, and unresolved is `total - matched`. Counts are integers; reconciliation and unresolved rates are rounded to one decimal place, with both rates `0.0%` for a zero-total run.
- Calculate an explainable, non-blocking anomaly only from exactly five seeded historical unresolved rates. Exclude user-created runs and reruns. The warning requires both a five-percentage-point increase and a current rate at least twice the unrounded baseline; typed bootstrap configuration supplies both thresholds. With fewer than five seeded histories, say that history is insufficient without failing the run. Show current and baseline rates; provide no drill-down, alarm, or blocking dialog.
- Use a native semantic table, not an ARIA composite grid. Default columns are Counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and Status. Make Trade ID, Broker, source system, trade date, price, account/book, and mismatch reason available through column controls or the detail surface. Use broker-side values when present and OT/MUREX values otherwise.
- Filtering, sorting, and column visibility are renderer-owned view state only: they must not change persisted Result data or Status. Support Status filtering, announced total/filtered counts, accessible sort direction, and domain-appropriate ordering. Decimal ordering must use normalized-decimal helpers rather than binary floats or formatted strings; format decimal data only at presentation boundaries. Use consistent date formatting, right-aligned tabular numeric data, and aligned dates.
- Preserve filters when no rows match, state “No matching records,” and offer Clear filters. When a run has no Unresolved Results, show an all-resolved state while retaining matched rows, summary, and table controls. A failed workspace load retains the selected run and summary, reports a linked retryable error, and retries in place.
- Treat the canonical Status IDs as `matched`, `unmatched`, `missing-from-broker`, and `missing-from-ot-murex`. Every Status must have its canonical label, semantic color, and a distinct icon or shape so it remains understandable without color.
- Selecting a row exposes selected state, leaves ordinary focus in the table, and updates a persistent adjacent detail surface with both source records where available, the reconciliation key, Status, and reason. Missing-source evidence must explicitly identify the absent side. Selecting an unreviewed `unmatched` Result persists it as reviewed and updates `reviewed unmatched / total unmatched`; missing-record Statuses are not review-required. Repeated selection or retry is idempotent, never a toggle. Restored runs retain review state, while later reruns do not inherit it.
- Keep grid, controls, selected row, detail content, scroll context, and focus stable through ordinary updates. Support keyboard and pointer parity: labelled filters, column and sort controls, and one labelled row selection control; native Tab order; Enter/Space activation; exposed headers, filter state, selection, validation, and result count. At demo width the table and raised adjacent detail panel are visible together with the table visually dominant. At constrained widths, use an explicit Open inspector control; opening moves focus to its heading and closing by its control or Escape restores focus to the invoker without clearing selection.
- Follow OS light/dark, reduced-motion, and forced-colors modes. Use the sole token system, CSS Modules, calm operational copy, 4.5:1 text contrast, and 3:1 essential-control, boundary, and focus contrast. Use polite announcements for ordinary state/success and assertive, control-associated errors. Avoid decorative motion, gradients, glass, oversized cards, and modal-only inspection.
- Meet the packaged 1,000-Result acceptance target: p95 filter, sort, visibility, and selection feedback begins within 100 ms across ten runs without virtualization. Cover formulas, threshold boundaries, seeded-history provenance, table behaviors, accessibility lifecycle, persistence/retry/idempotency, responsive inspector behavior, and Electron acceptance.

## Technical Decisions

- Preserve the process-isolated modular-monolith boundary: renderer presentation calls named preload methods backed by shared versioned Zod contracts; main validates sender and payload, owns SQLite, and returns immutable DTO snapshots in typed success/failure envelopes. The renderer owns only ephemeral workspace state and replaces persisted data with command/query responses.
- Build the workspace with pinned TanStack React Table v9 over one semantic `<table>` for client-side filters, sorting, selection, and column visibility; do not add a state library, persistence cache, router, or a second table system.
- The Runs module exclusively owns the `RunAggregate`, repository, and Unit of Work. Results, anomaly calculation, and review operations use its published application API. Durable run metadata, source Trades, Results, review state, and metrics remain in the aggregate; application commands own transactions.
- Main reloads authoritative state before review mutations. The versioned `result.review.v1` operation is set-to-value (`reviewed = true`) and returns the resulting DTO, preventing stale UI or retry from double-counting. Keep runtime IDs opaque, business dates as `YYYY-MM-DD`, timestamps as UTC ISO strings, and amount/quantity/price as normalized decimal strings across contracts and persistence.
- Compute summary metrics and anomaly provenance once through shared domain/application behavior, with injected fixtures and typed configuration for deterministic tests. Main-side structured logs may record operation, code, Run/Result ID, and duration, but never full Trade records.

## UX & Interaction Patterns

- The Summary Strip is a compact stable surface for totals, reconciliation rate, review progress where relevant, and amber warning context. The anomaly wording supports human judgment and directs investigation into Results.
- The Results Workspace is desktop-first and data-dense: quiet table borders, stable selected-row treatment, compact toolbar controls, and a persistent raised Detail Panel. Design polish comes from alignment, restrained spacing, and immediate feedback rather than decoration.
- Row selection announces the chosen Trade while retaining focus in the table. The Detail Panel is a persistent inspection surface, not a modal; the narrow-screen inspector is the sole exception and has an explicit keyboard return path.

## Cross-Story Dependencies

- Epic 2 consumes the persisted completed-run workspace, source evidence, canonical Results, and typed query boundary established by Epic 1. Summary and review state must remain tied to each individual Run ID.
- Epic 3 depends on Epic 2's authoritative review persistence and displayed progress to enforce report eligibility; it also reuses the selected-Result/detail context without altering the Results Workspace lifecycle.
