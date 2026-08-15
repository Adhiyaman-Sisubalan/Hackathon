# PRD Quality Review — Reconciliation Prototype PRD

## Overall verdict

This is an appropriately scoped, coherent PRD for an internal hackathon prototype: it has a clear pitch thesis, explicit non-goals, stable requirement IDs, concrete desktop-performance bounds, and a credible operator journey. It is not yet fully decision-ready for story creation because the stated mandatory-review policy conflicts with the report-save behavior, and several demo-critical output contracts are too vague to produce a uniquely testable implementation.

## Decision-readiness — adequate

The PRD makes the main product choices visible: Electron desktop form factor, mock enterprise inputs, SQLite persistence, a single run action, a persistent Detail Panel, no email sending, and an explainable fixed anomaly threshold (§§1, 4, 6–7). The explicit Non-Goals section is particularly effective at preventing the hackathon prototype from turning into an integration project.

One central operational policy is not actually settled. The Target User section says every unmatched Trade must be reviewed, UJ-1 culminates in confirmation that every unmatched Trade has been reviewed, and §4.3 calls the feature “Mandatory Review”; FR-12 then permits Report saving after an explicit acknowledgement while review is incomplete. Either behavior could be defensible, but downstream teams cannot infer which promise wins.

### Findings

- **high** Resolve the mandatory-review contradiction (§§2.1, 2.3 UJ-1, 4.3 FR-12, 4.6 FR-19) — The PRD simultaneously treats complete review as mandatory and allows the user to bypass it before saving the Report. This changes the control model, demo climax, acceptance criteria, and likely UI wording. *Fix:* Decide whether incomplete review is a hard gate or an overrideable warning, then align the job, journey climax, section title, FR-12, FR-19, and SM-1 to that decision.
- **low** Record the cost of the prototype boundary (§§1, 6–7) — The scope choice is clear, but its consequence is only implied: the prototype validates experience and local persistence, not correctness of live ingestion or parity with VBA. A decision-maker could otherwise overread a polished demo as production feasibility evidence. *Fix:* Add one sentence to MVP Scope stating what a successful prototype does not validate and what evidence would still be required before production approval.

## Substance over theater — strong

The document is unusually disciplined for a hackathon PRD. Its two journeys drive actual requirements; the anomaly feature has a defined baseline and threshold; accessibility requirements name focus behavior, live-region behavior, contrast ratios, and grid semantics; and performance requirements contain measurable bounds (§§2.3, 4.5, 5). The product language is specific to trade reconciliation rather than generic dashboard language.

### Findings

No substantive findings.

## Strategic coherence — adequate

The thesis is coherent: compress a believable daily reconciliation workflow into a polished three-minute desktop demo, using mock inputs while preserving dense investigation and human judgment (§§1, 2.1, 4, 7). The feature set follows that thesis from run initiation through exception investigation, comments, broker preview, and report save. SM-C1 provides a useful guard against sacrificing operational density for superficial polish.

The success section is weaker than the rest of the PRD. SM-1 is measurable, but SM-2 has no task, time, or accuracy threshold, and SM-3 is an unstructured personal judgment. These measures could all report success even if the primary reviewer struggles to identify or act on an exception.

### Findings

- **medium** Make pitch success observable (§8 SM-2–SM-3) — “Can find” and “judges … cohesive” do not specify a repeatable test or passing threshold, so they cannot reliably validate the thesis that dense data is effortless and the application is convincing. *Fix:* Define a short scripted evaluation, such as locating the mismatch reason and next action for a named Trade within a time bound without assistance, plus a simple post-demo rating threshold for credibility/polish.
- **low** Add a behavioral counter-metric (§8 SM-C1) — SM-C1 protects information density, but it does not guard against the opposite failure: a polished dense UI that causes mistakes or hides critical states. *Fix:* Add one counter-metric tied to operator error or missed unresolved Trades during the scripted demo.

## Done-ness clarity — thin

Many requirements have observable consequences: FR-3 prohibits duplicate run actions, FR-4 covers duplicate submission, FR-10 defines empty states, FR-14 preserves failed Comment text, FR-18 defines the anomaly calculation, and NFR-1/NFR-3 provide measurable bounds. Those are good story-ready requirements.

However, the two artifacts that close the pitch—the Broker Email Preview and Report—lack content contracts. “Relevant mock Trade details” and “full mock Report” admit materially different implementations. The mock engine also lacks a defined scenario contract, so a build can classify correctly in code yet fail to produce the mix of states needed to demonstrate the journeys. Failure recovery is named repeatedly, but only Comment failure explicitly says what user-entered state is preserved.

### Findings

- **high** Specify the demo-critical output contracts (§4.4 FR-15; §4.6 FR-19) — Neither the minimum email-preview fields nor the Report format, sections/sheets, included statuses, comments, review state, summary, filename, and mock destination are defined. “Relevant” and “full” are not testable. *Fix:* Add minimum content and observable-success criteria for both artifacts, while leaving file-generation mechanisms to architecture.
- **medium** Define the seeded reconciliation scenario contract (§4.2 FR-5–FR-7; §4.5 FR-18) — The PRD does not state whether a selected As-of date deterministically maps to a seed scenario or which statuses and anomaly conditions must be present. This makes the three-minute demo and anomaly journey nondeterministic from a requirements perspective. *Fix:* Require at least one named normal scenario and one anomalous scenario, each with deterministic counts/statuses for its As-of date, including enough unmatched Trades to exercise review, comments, broker preview, and incomplete-review behavior.
- **medium** State preservation rules for recoverable failures (§2.3 UJ-1; §4.1 FR-2; §4.4 FR-16; §4.6 FR-19) — “Offers Retry,” “provides recovery,” and “retains the Reconciliation Run” do not consistently define what selection, filters, comments, progress, and destination state survive failure. *Fix:* Add a cross-cutting retry requirement that identifies the state which must remain intact for summary-load, preview-generation, Comment-save, and Report-save failures.

## Scope honesty — strong

The document is candid about what is mocked and what is excluded (§§1, 2.2, 6–7). Live Outlook and OT/MUREX access, VBA parity, real email delivery, production operations, collaboration, and advanced analytics are all explicit non-goals. The absence of open questions and assumptions is credible only if the mandatory-review conflict is resolved; otherwise that conflict is a hidden open decision.

### Findings

No additional findings beyond the mandatory-review decision above.

## Downstream usability — adequate

The PRD is easy to extract: FR, UJ, NFR, and SM IDs are unique and contiguous; product nouns are mostly governed by a glossary; feature descriptions identify the journeys they realize; and requirements are grouped around implementation-relevant capabilities. This is a strong base for UX, architecture, and story creation.

Downstream extraction becomes ambiguous at the output boundary and around failure-state preservation, covered under Done-ness clarity. There is also some terminology outside the glossary—particularly “Exceptions,” “Status views,” “Summary Strip,” and “shared-path simulation”—whose exact surfaces or relationships are not defined locally.

### Findings

- **low** Normalize ungoverned surface terms (§§4.1, 4.3, 4.5–4.6) — “Exceptions,” “Status views,” “Summary Strip,” and “shared-path simulation” are capitalized or used as stable concepts without glossary definitions, and the relationship between Exceptions and the Results Workspace is unclear. *Fix:* Either define these terms in the Glossary or replace them with already-defined vocabulary; explicitly state whether Exceptions is a filtered Results Workspace or a separate surface.

## Shape fit — strong

The capability-led structure fits a single-operator internal desktop tool, while two short named-protagonist journeys carry only the context needed for the UI-heavy demo (§2.3). The PRD avoids persona theater, keeps production mechanism choices out of the main narrative, and gives extra rigor to accessibility and desktop behavior because it feeds architecture and story work. Its length and formality are proportionate to a hackathon prototype that must still produce a convincing implementation.

### Findings

No substantive findings.

## Mechanical notes

- FR IDs are contiguous and unique from FR-1 through FR-19. UJ IDs (UJ-1–UJ-2), NFR IDs (NFR-1–NFR-7), and success IDs (SM-1–SM-3 plus SM-C1) are unique; no broken explicit ID references were found.
- Both User Journeys use the named protagonist Priya and carry relevant context inline.
- The Assumptions Index says “None,” and there are no inline `[ASSUMPTION]` tags, so the roundtrip is internally consistent.
- No `[NOTE FOR PM]` callouts appear. Once the mandatory-review conflict is resolved, this is acceptable for the agreed prototype stakes.
- Glossary casing is mostly consistent. “buy/sell” is not capitalized like the named Trade fields around it, and the ungoverned surface terms identified above should be normalized.
- NFR-4 cites W3C guidance by title but not by resolvable URL or pinned reference. This does not block the PRD, but a downstream accessibility review will be more reproducible if the exact references are linked.
