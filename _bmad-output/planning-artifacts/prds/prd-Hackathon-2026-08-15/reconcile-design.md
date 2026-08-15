# Input Reconciliation: DESIGN.md

## Input

`../../ux-designs/ux-Hackathon-2026-08-15/DESIGN.md`

## Verdict

The PRD preserves the design's main direction: a professional, system-theme-aware Electron workspace; a compact application shell; a data-dense grid with adjacent detail context; non-blocking anomaly treatment; restrained surfaces; and accessibility requirements for contrast, focus, forced colors, keyboard use, and non-color status communication. The detailed palette, typography, spacing, radii, and component styling correctly remain owned by `DESIGN.md` rather than being duplicated in the PRD.

Four constraints should be made explicit in the PRD because they materially affect acceptance of the product experience, not just its styling.

## Gaps

### 1. NFR-1 is not objectively testable

`DESIGN.md` defines the product as a fast desktop workspace with instantaneous feedback and transitions that never delay work. NFR-1 says common actions must “feel immediate,” but provides no observable acceptance boundary. An implementation could exhibit noticeable web-like lag and still claim compliance.

**Recommended PRD treatment:** Add measurable prototype response budgets for application readiness, grid filter/sort feedback, row selection/detail-panel updates, navigation, theme changes, and functional transitions. If exact thresholds are not yet approved, retain this as a build-blocking performance acceptance item rather than silently leaving “immediate” subjective.

### 2. The single-primary-action rule is not protected

`DESIGN.md` specifies that `primary-action` is the single visually dominant action on a surface. FR-3 defines the As-of date and run action but does not prohibit a duplicate reconciliation trigger elsewhere on the Dashboard. This already matters to the approved dashboard direction: a duplicate top-level start button would dilute the core flow and regress the application-like experience.

**Recommended PRD treatment:** Amend FR-3 to require one primary **Run reconciliation** action, colocated with the As-of date control, with no duplicate start action on the Dashboard.

### 3. Data-scanning requirements omit numeric typography and alignment

`DESIGN.md` requires platform-native typography and tabular numerals for amount, quantity, rate, and date columns so values compare vertically. FR-8 lists the required fields, while NFR-6 states the general visual direction, but neither makes scan-comparable numeric presentation an acceptance criterion. This is central to “dense data made effortless,” not merely decorative styling.

**Recommended PRD treatment:** Add to FR-8 or NFR-6 that numeric and date columns use tabular numerals, consistent alignment, and stable formatting across rows and themes; the platform-native font stack remains governed by `DESIGN.md`.

### 4. Stable workspace geometry is not required

`DESIGN.md` requires stable grid, filter, panel, and focus positions so repeat users can build muscle memory. The PRD requires the persistent adjacent Detail Panel, but it does not protect against filters, selection, validation, loading, or expanded details shifting the grid and its controls. Such movement would conflict with the native, seamless experience and can create accessibility problems for keyboard and low-vision users.

**Recommended PRD treatment:** Extend NFR-1 or NFR-4 to require stable placement of the results toolbar, grid, selected-row context, focus target, and adjacent Detail Panel across filtering, selection, validation, loading, and error states; state changes must not cause avoidable layout shifts or obscure focus.

## No Conflict Requiring Resolution

- The PRD's four Status values are compatible with the design's success/warning/danger treatment. NFR-3 correctly requires Status to remain understandable without color alone.
- The PRD's non-blocking Anomaly Warning matches the design's warning-for-judgment posture.
- FR-13's persistent adjacent Detail Panel matches the design's explicit rejection of modal-only investigation.
- NFR-2 and NFR-3 correctly capture system light/dark mode, reduced motion, forced colors, contrast, focus, and keyboard support.
- NFR-6 faithfully carries forward the prohibition on spreadsheet cloning, card-heavy composition, decorative animation, gradients, glass effects, oversized hero content, and modal-only inspection.
