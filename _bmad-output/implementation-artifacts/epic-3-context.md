# Epic 3 Context: Resolve Exceptions and Complete the Run

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable an operations user to finish a reconciliation run with confidence: retain investigation comments for unresolved results, prepare a broker-specific email draft without sending it, enforce review of every unmatched result, and publish a validated workbook. The workflow must preserve the user's in-progress context through failures, so the application remains trustworthy for a short end-to-end desktop demo.

## Stories

- Story 3.1: Add and Persist Resolution Comments
- Story 3.2: Preview Broker Follow-up Emails
- Story 3.3: Enforce Review Completion and Save the Verified Report

## Requirements & Constraints

- Comments are available for selected unresolved results, are persisted by Result ID within the active Run, and replace the existing value idempotently rather than creating duplicates. A reopened run restores its own comments; reruns never inherit comments.
- A broker draft is available only for a selected result with broker details. It must show recipient, subject, professional body, and a clearly visible Draft state; it must never expose a send action or claim that email was sent.
- A broker draft includes each unmatched result for the chosen broker in the selected Run exactly once, excluding other brokers and missing-record statuses. Its trade table includes Trade ID, ISIN, buy/sell, amount, quantity, currency, settlement date, mismatch reason, and comment.
- Report saving is disabled until every `unmatched` result is reviewed, with the exact outstanding count explained. Missing-record statuses do not satisfy this gate; a Run with zero unmatched results is eligible automatically.
- A saved workbook uses a collision-safe `reconciliation-YYYY-MM-DD-{runId}.xlsx` name in the configured mock-output directory. It includes Summary, Matched, Unmatched, Missing from Broker, and Missing from OT-MUREX sheets. Summary includes Run identity, date, metrics, review progress, and anomaly values; result sheets include trade fields, status, reason, review state, and comment.
- Saving succeeds only after the workbook exists at the shown destination and can be reopened as a valid workbook. Failures preserve the Run and user context, clean up only the operation's temporary artifact, and offer Retry.
- Core actions remain keyboard accessible and understandable without color alone. Use system light/dark, reduced-motion, and forced-colors behavior; retain the stable grid, filters, selection, panel, and focus context through ordinary updates and failures.

## Technical Decisions

- Treat the main process as the authority for SQLite and filesystem state. The renderer uses only named, versioned, Zod-validated preload contracts; main revalidates requests and returns typed success/failure envelopes with retryability.
- Use the Runs application API and its aggregate/unit-of-work boundary for comments, broker drafts, and reports. The aggregate owns run metadata, source trades, results, review state, comments, and computed metrics; feature modules do not persist directly.
- Main reloads persisted state before every command. It enforces comment eligibility, broker-draft membership, and report-review eligibility independently of renderer affordances. Commands are set-to-value and return replacement DTOs so retry is idempotent.
- Keep financial amount, quantity, and price values as normalized decimal strings; shared domain helpers compare and order them, while renderer and workbook layers handle formatting.
- Use `comment.save.v1`, `broker.preview.v1`, and `report.save.v1` contracts. Queries return immutable snapshots; successful commands return the changed DTO or aggregate snapshot rather than relying on a client-side persistence cache.
- For a report, evaluate eligibility and construct immutable `RunReportV1` from the same read-transaction snapshot. Dispatch that DTO, plus an operation-specific temporary path, to a worker thread that validates, writes, reopens, and verifies the workbook. Main verifies the receipt and atomically renames the temporary file to the final destination.
- Do not block the Electron main event loop during workbook work. The worker has no database handle, final output path, or broad filesystem-discovery capability.

## UX & Interaction Patterns

- Keep comments and broker actions in the persistent Detail Panel beside the semantic Results table. With no selection, prompt the user to select a record and submit no command; with no broker, explain why no draft can be prepared.
- Open the broker preview as a labelled, non-modal detail-panel section. Explicit keyboard invocation moves focus into it; close returns focus to its invoker. At constrained widths, use the explicit inspector pattern rather than compressing the table.
- Preserve entered comment text, selected result, filters, scroll position, detail context, and focus when an operation fails. Announce success or progress politely; expose associated errors assertively with Retry and, for draft failure, a route back to detail.
- Use calm operational wording such as “Email draft ready.” Status treatment pairs labels with semantic color and icon/shape; never rely on color alone.

## Cross-Story Dependencies

- Story 3.2 consumes the comments and authoritative result state established by Story 3.1 so broker drafts show current comments for the selected Run.
- Story 3.3 exports the same persisted comments and review state used by the first two stories. Its authoritative snapshot prevents a report from passing the review gate against one Run state while exporting another.
