# Adversarial PRD Review

**Artifact:** `prd.md`  
**Review focus:** implementation derailers for a hackathon prototype  
**Verdict:** **Not implementation-safe as written.** The experience is coherent, but two core contracts—the mock reconciliation engine and mandatory review—are internally ambiguous. Several persistence, report, anomaly, performance, and accessibility requirements also lack enough boundaries to be estimated or tested consistently.

## Severity summary

| Severity | Count |
|---|---:|
| Critical | 2 |
| High | 6 |
| Medium | 6 |
| Low | 1 |
| **Total** | **15** |

## Critical findings

### C-1 — The reconciliation engine has no executable contract

**Evidence:** Lines 79–87 require the application to compare two seeded sources and classify every Trade, while lines 169–170 explicitly exclude VBA mapping migration and parity validation.

**Why this derails the prototype:** “Compare” can mean at least three materially different builds: display preclassified fixtures, implement a small deterministic matching algorithm, or re-create business mapping rules. The PRD defines neither match keys nor amount/quantity tolerances, duplicate handling, source-pair identity, or mismatch-reason precedence. Two teams can satisfy FR-5/FR-6 with incompatible products, and a developer may accidentally rebuild the excluded VBA scope.

**Required resolution:** Choose and state one prototype boundary. Recommended: a deterministic mock reconciliation fixture keyed by As-of date, with either (a) precomputed results explicitly allowed, or (b) a deliberately small published rule set. Define the exact fixture inputs, expected result counts, statuses, mismatch reasons, and a golden expected-output test. State explicitly that no VBA/business-rule parity is implied.

### C-2 — “Mandatory review” is neither mandatory nor meaningful

**Evidence:** The PRD says every unresolved Trade is investigated (line 26), every unmatched Trade is reviewed (line 28), and MVP scope calls review of Unresolved Trades mandatory (line 180). Yet Review progress counts only `unmatched` (line 48), selection alone marks a Trade reviewed (line 111), and Save Report can continue with incomplete review after confirmation (line 115).

**Why this derails the prototype:** A user can arrow through rows—or click Save Report and confirm—without reading the mismatch reason, commenting, or taking any action. Missing-from-broker and missing-from-OT/MUREX records are Unresolved but are excluded from progress. The implementation cannot tell whether the climax of UJ-1 is a hard gate, a warning, or a presentation metric.

**Required resolution:** Rename it to **review tracking with override** or make it a true gate. Define the reviewed population (`all Unresolved` or only `unmatched`), the explicit action that sets `reviewed` (for example a **Mark reviewed** control after the Detail Panel is opened), whether the flag can be cleared, and whether Save Report is blocked or overrideable. Align the glossary, UJ-1, FR-11/12, and MVP scope.

## High findings

### H-1 — Report “save” is not testable and invites production-like scope

**Evidence:** Lines 52, 151–155 call for a “complete mock Report” saved to a “shared-path simulation” but define no file type, content, destination, naming, overwrite rule, or success contract.

**Consequence:** One implementation may show a toast without writing a file; another may build a multi-sheet XLSX exporter and network-path picker. Both can claim compliance. “Full” is especially dangerous because it can imply all grids, fields, comments, summary data, and review status.

**Tightening needed:** Define the prototype artifact (for example one XLSX with named sheets, or a JSON/CSV fixture), mandatory columns/sheets, deterministic local demo directory, filename rule, overwrite behavior, and what the success confirmation displays. If no physical file is required, call it a simulated save and define the state change instead.

### H-2 — SQLite record identity and lifecycle semantics are missing

**Evidence:** Lines 43–50 define run-scoped Comments; FR-14 persists them; NFR-5 persists runs, comments, brokers, and historical statistics across sessions. No stable IDs, uniqueness rules, reseeding behavior, or same-date rerun behavior are defined.

**Consequence:** Rerunning the same As-of date could duplicate runs, overwrite results, orphan Comments, or incorrectly attach a Comment to a similarly shaped fixture row. Resetting or reseeding the demo may erase user work or accumulate stale data. These choices affect schema, UX, anomaly baselines, and demo reliability.

**Tightening needed:** Define stable `run_id`, `trade_result_id`, and mock `broker_id`; state whether every click creates a new run; declare Comments run-scoped versus business-entity-scoped; specify upsert/append behavior, seed versioning, first-launch seeding, and an explicit demo-reset policy.

### H-3 — The anomaly rule is mathematically stated but operationally incomplete

**Evidence:** FR-18 (line 147) uses the mean Unresolved rate of “five prior seeded Reconciliation Runs”; NFR-5 (line 163) also persists runs and historical statistics.

**Consequence:** It is unclear whether completed prototype runs join the baseline, whether the five fixtures are fixed forever, how the rule works before five histories exist, how zero baseline is treated, what denominator defines a rate, or how rates are rounded for the dual threshold. An as-of date could produce the same current fixtures but a changing warning as local history accumulates.

**Tightening needed:** For the hackathon, freeze five named baseline fixtures separate from user-created runs. Define `unresolved_rate = unresolved_result_count / total_result_count`, behavior for total zero, full-precision threshold comparison, display rounding, and at least one golden scenario that triggers and one that does not. Remove “configurable” unless a configuration surface or fixture constant is explicitly in scope.

### H-4 — Navigation creates two undefined products

**Evidence:** FR-1 and the shell description (lines 59–63) require Overview, Reconciliation Runs, and Exceptions. No requirements define the contents, states, or actions of Reconciliation Runs or Exceptions; the only fully defined surfaces are Dashboard and Results Workspace.

**Consequence:** Implementers must invent history and exception screens despite historical analytics being a non-goal (line 172), or ship empty/dead navigation that hurts the pitch.

**Tightening needed:** Either remove unneeded routes for the prototype, or define each route with a minimal acceptance contract and its relationship to Dashboard/Results. A safe prototype cut is Overview plus the active/latest Results Workspace, with prior runs surfaced only if explicitly required.

### H-5 — Accessibility requirements reference undefined interactions and can balloon scope

**Evidence:** NFR-3 mentions an **Open inspector** control and closing/collapsing the panel (line 161), but FR-13 specifies a persistent panel and no open/close control. NFR-4 requires a documented keyboard model for a complex ARIA-style grid (line 162) without choosing native-table versus composite-grid semantics. NFR-2 also requires forced-colors behavior (line 160) without naming the demo platform.

**Consequence:** The build may implement two incompatible detail-panel models and a full spreadsheet-grade keyboard interaction system late in the hackathon. Applying ARIA Grid semantics partially can make accessibility worse than a native table.

**Tightening needed:** Pick one responsive inspector behavior at a defined width, specify its exact focus lifecycle, and choose the grid model. For the prototype, a semantic table with keyboard-reachable row actions, filters, and column controls may be safer unless cell-level navigation is an explicit demo need. State the target OS and the specific high-contrast/forced-colors verification environment.

### H-6 — Performance budgets cannot be reproduced

**Evidence:** NFR-1 (line 159) sets launch, interaction, transition, and memory limits only “on the hackathon demo laptop.” Dataset size, build type, cache state, measurement method, number of trials, percentile, and process accounting are absent. “Updates begin within 100 ms” and “functional transitions complete” are not observable end states.

**Consequence:** Electron launch and memory can pass or fail depending on dev versus packaged mode, warm filesystem caches, and whether renderer/GPU/helper processes are included. The team may spend disproportionate time chasing an unverifiable 250 MB budget.

**Tightening needed:** Record the laptop/OS, packaged production build, fixture size and visible column count, cold-launch procedure, number of trials and threshold (for example median of five), memory measurement scope, and observable endpoints. Consider treating 2 seconds/250 MB as pitch targets until baselined rather than release blockers.

## Medium findings

### M-1 — Comment behavior is underspecified

**Evidence:** The glossary describes “user text” (line 50), while FR-14 says the user can “add and save a Comment” (line 127). It does not say whether a Trade has one editable note or an append-only history, whether blank text is valid, or what is shown after restart.

**Consequence:** Schema and UI can diverge immediately (`comment` column versus comments table), and “durable resolution context” may not survive a credible demo.

**Tightening needed:** Define one comment per run-result or a comment history, editing/deletion rules, maximum length, whitespace/blank handling, saved timestamp/author expectations, and reload acceptance.

### M-2 — Broker Email Preview lacks its unit of work

**Evidence:** The product discussion describes broker-specific follow-up, but FR-15 only says “relevant mock Trade details” (line 131); FR-16 has generic recovery (line 135).

**Consequence:** The preview could contain the selected Trade, all Unresolved Trades for its broker, or all filtered Trades. Recipient, subject, grouping, and required fields are unknowable; a broker dropdown may be invented or omitted.

**Tightening needed:** Define the triggering context and aggregation rule, recipient source, subject/body template, mandatory included fields, missing-email behavior, and confirm that Preview is view/copy/close only with no send or draft integration.

### M-3 — Required failure states have no deterministic demo trigger

**Evidence:** UJ-1 and FR-14/FR-19 require failed Comment/Report saves with Retry (lines 38, 127, 155), and FR-16 requires preview creation failure recovery (line 135).

**Consequence:** These paths are difficult to test reliably with local SQLite and a simulated destination. Developers may add debug UI, random failures, or unreachable branches.

**Tightening needed:** Specify either injectable automated-test failures only, a documented demo fixture/flag, or remove failure simulation from the pitch scope while retaining ordinary error handling. Never use random failure.

### M-4 — Result counting and rate semantics are ambiguous

**Evidence:** A Trade is defined as “a broker or OT/MUREX trade record” (line 45), while a matched result logically represents two records. Dashboard and Summary total “Trades” (lines 67, 143), and reconciliation rate is not defined.

**Consequence:** Totals can double-count matched pairs or count reconciliation result rows. `matched / total` may disagree between developers and with anomaly denominators.

**Tightening needed:** Introduce a **Reconciliation Result** entity, define how source records map to result rows, and define every metric formula and rounding rule using result counts.

### M-5 — As-of date has no effect or validation contract

**Evidence:** FR-3 requires selection and validation (line 71), but FR-5 says seeded data is used for every run (line 83) without explaining fixture selection by date.

**Consequence:** The date can become decorative. Future dates, missing fixture dates, locale display, default date, and timezone boundaries may behave inconsistently.

**Tightening needed:** Define allowed date range/fixtures, default date, input/display format, invalid/no-data message, timezone basis, and whether multiple dates select distinct mock scenarios.

### M-6 — Success metrics are mostly subjective or over-broad

**Evidence:** SM-1 claims to validate all FR-1–FR-19 through one three-minute journey (line 189), although failure states, empty state, theme modes, persistence across restart, keyboard support, and anomaly non-trigger behavior cannot all be exercised. SM-2 and SM-3 use unscored “can find” and personal judgment (lines 190–191).

**Consequence:** The prototype can be declared successful without exercising important contracts, or blocked by subjective disagreement after implementation.

**Tightening needed:** Separate the pitch walkthrough from acceptance checks. Define a small scripted demo plus a test checklist for persistence, failure recovery, light/dark, keyboard completion, and anomaly thresholds. Give information-confidence and product-credibility a simple observable rubric.

## Low finding

### L-1 — Terminology and capitalization increase implementation drift

**Evidence:** “Trade,” “Status,” “Report,” and other common nouns are capitalized as entities, while UI labels mix title-like and sentence-case forms; “Open inspector” appears only in an NFR.

**Consequence:** Test names, copy, and component labels may drift, especially where terms such as Trade and Reconciliation Result already need separation.

**Tightening needed:** Add canonical UI labels and reserve capitalization for defined domain entities. Remove labels that are not actual controls.

## Minimum gate before implementation

The PRD becomes safe enough for a hackathon build when the team resolves C-1 and C-2 and then locks five thin contracts: mock fixture/golden output, SQLite identity/reset behavior, report artifact, anomaly fixtures/formula, and the exact grid/inspector keyboard model. The remaining medium findings can be resolved in acceptance examples without expanding the product.
