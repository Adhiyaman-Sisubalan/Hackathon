---
title: 'Add and Persist Resolution Comments'
type: 'feature'
created: '2026-08-16'
status: 'done'
baseline_commit: '163871ee09ecb6595f2d4b0b967a868705f9ae9e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An operator can inspect and review a reconciliation Result but cannot retain the finding or follow-up decision that explains how it will be resolved. Notes lost on reopening a Run make the investigation incomplete and prevent the next workflow from preparing reliable broker communication.

**Approach:** Add a set-to-value, Run-scoped resolution-comment command and a Detail Panel editing workflow. The main process authorizes and persists the comment, then returns an authoritative workspace so the visible comment stays durable without resetting table or inspector context.

## Boundaries & Constraints

**Always:** Permit comments for every unresolved Status—`unmatched`, `missing-from-broker`, and `missing-from-ot-murex`—but never for `matched`. Store one nullable comment per Result in its Run; saving replaces the value idempotently, including a retry of the same value. Reload the authoritative Result by Run ID and logical Result ID in a transaction, persist only through the Runs API, and return the updated immutable workspace. Prefill the selected unresolved Result from persisted state; preserve draft text, selection, filters, scroll, detail/inspector context, and focus through save success or failure. Use labelled controls, polite success, linked assertive error, and the existing system-mode token/focus behavior.

**Ask First:** Adding comment fields or formats beyond plain text, changing unresolved eligibility/status meanings, changing Result identity, adding comments to matched Results, or introducing collaboration, audit history, cloud sync, rich text, a new persistence layer, or router.

**Never:** Optimistically present a failed comment as saved; create duplicate comment records; expose SQLite/raw SQL to the renderer; lose an entered comment on a retryable error; copy a comment to a rerun; require pointer/hover input; or alter Story 2.3’s unmatched-only review eligibility.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Create/update | Selected unresolved Result, new or saved text | Labelled field preloads persisted text; Save sets that exact value and authoritative workspace displays it | Same-value retry is idempotent |
| Eligible statuses | `unmatched` or either missing-record Status | Comment editing and saving are available while evidence/review state remain intact | `matched` stays inspectable but explains comments are unavailable |
| No selection | No selected Result | Detail Panel prompts selection and submits no comment command | No disabled hidden mutation path |
| Save failure | Typed retryable persistence failure | Text, Result, filters, focus, and inspector stay unchanged; associated assertive error offers Retry | Retry resends the preserved value/identity |
| Reopen/rerun | Reviewed Run reopened or later Run created | Reopened Result preloads its comment; a new Run starts with no comment | Data remains Run-scoped |

</frozen-after-approval>

## Code Map

- `src/shared/contracts/reconciliation.ts` -- existing review schemas/channels and immutable Result/Workspace DTOs; add nullable comment, strict `comment.save.v1` request/result, and exported types without loosening version validation.
- `src/shared/contracts/preload.ts`, `src/preload/index.ts`, and `src/preload/global.d.ts` -- existing named review bridge; expose only typed `runs.saveComment(runId, resultId, comment)`.
- `migrations/004-result-review.sql`, new `migrations/005-result-comment.sql`, and `src/main/index.ts` -- current versioned migration list; add nullable Result comment storage and register it in every development/packaged path.
- `src/main/adapters/sqlite/database.ts` -- `workspaceSnapshotForRun` and review transaction use internal `runId:logicalResultId`; hydrate comments and add a transactional set-to-value unresolved-comment mutation returning its workspace.
- `src/main/modules/runs/runs-service.ts` and `src/main/ipc/reconciliation.ts` -- existing aggregate command/error and sender-validating typed handler seams; enforce unresolved eligibility and safe not-found/ineligible/persistence responses.
- `src/renderer/features/results/Results.tsx` and `Results.module.css` -- existing shared DetailPanel, review request guards, compact inspector, and workspace replacement callback; add keyed draft/save/error/success state without duplicate IDs across mounted panels.
- `tests/integration/reconciliation-runs.test.ts`, `tests/integration/reconciliation-ipc.test.ts`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- current durable-review seams for migration, secure IPC, resilient detail-panel editing, restart, rerun, and packaged validation.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/contracts/*`, `src/preload/*`, and `src/main/ipc/reconciliation.ts` -- define/expose a strict, sender-validated versioned comment-save boundary with typed failure envelopes -- preserves the secure Electron boundary.
- [x] `migrations/*`, `src/main/adapters/sqlite/database.ts`, and `src/main/modules/runs/runs-service.ts` -- add nullable storage, Run-scoped unresolved eligibility, idempotent update, and authoritative hydration -- makes comment state durable and rerun-isolated.
- [x] `src/renderer/features/results/*` -- add accessible Detail Panel/compact-inspector comment drafting, save, confirmation, and retry behavior -- keeps investigation context stable for keyboard and pointer use.
- [x] `tests/integration/*`, `tests/unit/results.test.tsx`, and `tests/e2e/electron.acceptance.ts` -- cover every matrix row plus strict IPC authorization, migration upgrade, restart, and system-mode behavior -- proves the durable end-to-end contract.

**Acceptance Criteria:**
- Given an unresolved Result is selected, when its Detail Panel opens or is reopened, then it presents a labelled Comment field and Save comment action prefilled from that Result’s durable Run-scoped value.
- Given an operator saves a new, updated, or repeated value, when main validates unresolved membership and persists it, then the returned workspace displays the exact saved value, announces polite success, and creates no duplicate comment.
- Given no Result or a matched Result is selected, when the comment section renders, then no command is submitted and matched editing is unavailable with a clear explanation while source evidence remains visible.
- Given a typed retryable save failure, when it is reported, then the unchanged draft/selection/table/inspector context remains available with an associated assertive Retry that does not require re-entry.
- Given a Run is reopened or a new rerun is examined, when its selected Result loads, then the original Run restores its comment while the new Run has none.

## Design Notes

Use `comment: string | null` in the Result DTO; `null` represents the intentional absence of a saved comment. The renderer may hold a selected-result draft, but success must replace the workspace from main and failure must retain only the unsaved draft. Use result-specific state and unique control/error IDs because desktop and compact detail surfaces may render at the same time.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript/lint checks pass.
- `npm test` -- expected: schema, migration, persistence, IPC, renderer accessibility, and idempotency tests pass.
- `npm run test:e2e` -- expected: packaged comment save, reopen, rerun-isolation, and keyboard flow pass.

## Suggested Review Order

**Secure command boundary**

- Validate, authorize, and normalize comment saves at the sole renderer-to-main entry point.
  [`reconciliation.ts:55`](../../src/main/ipc/reconciliation.ts#L55)

- Keep empty-comment normalization and unresolved eligibility inside the Runs application API.
  [`runs-service.ts:47`](../../src/main/modules/runs/runs-service.ts#L47)

**Durable Run state**

- Update and rehydrate the Result in one transaction for idempotent authoritative replies.
  [`database.ts:141`](../../src/main/adapters/sqlite/database.ts#L141)

- Add nullable, backwards-compatible comment storage without broad new persistence infrastructure.
  [`005-result-comment.sql:1`](../../migrations/005-result-comment.sql#L1)

**Stable operator workflow**

- Coordinate draft edits, saves, and shared workspace mutations without stale state overwrites.
  [`Results.tsx:203`](../../src/renderer/features/results/Results.tsx#L203)

- Cover every unresolved status, migration backfill, restart, and rerun isolation.
  [`reconciliation-runs.test.ts:161`](../../tests/integration/reconciliation-runs.test.ts#L161)

- Exercise authoritative comments, missing-record controls, retry, and concurrency regressions.
  [`results.test.tsx:107`](../../tests/unit/results.test.tsx#L107)
