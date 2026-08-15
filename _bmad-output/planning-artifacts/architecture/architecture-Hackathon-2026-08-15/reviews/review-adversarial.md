# Focused Adversarial Divergence Recheck

**Artifact:** `ARCHITECTURE-SPINE.md`  
**Lens:** Previously blocking cross-unit seams  
**Verdict:** **Pass.** The five previously critical/high divergence paths are now bound by explicit, enforceable ADs. No critical or high finding remains in this focused recheck.

## Scope

This recheck tested only the five seams requested after the first adversarial review:

1. persisted `RunAggregate` and Unit-of-Work ownership;
2. the main-to-worker Report DTO contract;
3. Report eligibility/content snapshot consistency;
4. duplicate-key Trade pairing; and
5. review-command retry semantics.

For each seam, two independently implemented units were again assumed to obey every AD literally. The revised spine now prevents the prior incompatible constructions.

## Resolution evidence

| Prior finding | Current binding | Recheck result |
| --- | --- | --- |
| Split ownership of Run, source Trades, Results, review state, and Comments | AD-14 names the Runs module as the sole persisted aggregate repository/UoW owner; AD-27 defines `RunAggregate`, `RunsRepository`, `RunsUnitOfWork`, and requires all other capabilities to use the Runs application API. AD-7 assigns the reconciliation commit to that UoW. | **Resolved.** A Results or Reports module that creates its own Run/Result repository would now violate AD-14 and AD-27. One command has one persistence owner. |
| Unversioned, incompatible main/worker payloads | AD-17 requires a Zod-validated `RunReportV1` and `WorkerReportReceiptV1`, with validation on both sides and a constrained temporary path. | **Resolved.** Independent producer/worker implementations must converge on the same versioned schemas and cannot substitute private payload shapes. |
| Gate check and workbook rows from different states | AD-28 requires `report.save.v1` to evaluate eligibility and construct immutable `RunReportV1` inside one Runs read transaction, then close it before dispatch. | **Resolved.** Summary, review state, Results, and Comments must represent one point-in-time snapshot. Later mutations explicitly belong only to a later Report request. |
| Locale/natural-sort divergence when pairing duplicate reconciliation keys | AD-29 restricts Trade IDs to ASCII, fixes ascending bytewise ASCII ordering, requires uniqueness per source within a Run, and defines `DUPLICATE_TRADE_ID`. AD-5 rejects duplicates before persistence. | **Resolved.** Lexicographic-vs-natural and locale-dependent ordering are no longer compliant alternatives; equal-ID ties are rejected. |
| Retry turns a reviewed Result back to unreviewed | AD-21 defines `result.review.v1` as idempotent `reviewed = true`, never toggle. AD-29 generalizes mutation commands as set-to-value operations returning the resulting DTO. | **Resolved.** Repeated or retried review commands converge on the same durable state. |

## Remaining critical/high findings

**None.**

## Focused gate recommendation

The focused adversarial gate passes. The spine can proceed without further changes for these five seams.
