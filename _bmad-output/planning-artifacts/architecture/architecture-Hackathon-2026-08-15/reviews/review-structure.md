# Editorial Structure Review — Architecture Spine

This document exists to help implementation agents and engineers make compatible technical choices while building the reconciliation prototype.

**Structure model:** Reference/Database with a short conceptual opening. The paradigm establishes the mental model; the remaining document is a random-access contract whose decisions should be MECE, consistently shaped, and easy to locate by concern.

**Exact word count:** 2,802 words.

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | §Invariants & Rules — 30 ADs in one flat numeric sequence (~1,460 words) | **MOVE/GROUP** the existing AD blocks under five concern headings while keeping every AD ID and Rule unchanged: **Process boundaries and state ownership** (AD-1, AD-2, AD-3, AD-4, AD-6, AD-7, AD-14, AD-27); **Domain and data integrity** (AD-5, AD-18, AD-20, AD-22, AD-29); **Workflow, reporting, and recovery** (AD-8, AD-10, AD-17, AD-21, AD-26, AD-28); **Renderer and experience** (AD-11, AD-15, AD-16, AD-19, AD-23, AD-24, AD-25); **Security, testing, deployment, and operations** (AD-9, AD-12, AD-13, AD-30). Add one line stating that AD IDs are stable identifiers and do not imply reading order. | The late-added AD-27–AD-30 decisions currently sit far from the rules they complete. Concern grouping makes aggregate ownership, report publication, deterministic ordering, and reset discoverable without renumbering or changing decisions. Adds ~20 heading/orientation words; no content reduction. |
| structure | AD-14 and AD-27 — both state Runs-module repository ownership (~118 words combined) | **CONDENSE** AD-14 to the general cross-module rule and point persisted Run state to AD-27; keep the complete Run aggregate and Unit-of-Work ownership decision only in AD-27. | Removes duplicated ownership detail while preserving both IDs and decisions; saves ~15 words. |
| structure | AD-21 — “The final PRD rule supersedes older unresolved-review wording.” | **CUT** from the spine; retain the history in `.memlog.md`. | Historical process detail does not help implementers apply the surviving predicates; saves 9 words. |

## Summary

Three recommendations. If all are accepted, the document grows by roughly 20 navigation words and removes roughly 24 duplicated or historical words, for a negligible net reduction of about 4 words (<0.2%). The benefit is scanability, not brevity. No diagram, capability map, convention, stack entry, structural seed, or Deferred item should be removed; each serves the reference model without true redundancy.
