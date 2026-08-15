# Spine Pair Review — Hackathon

## Overall verdict

The pair has a clear, coherent prototype journey and strong desktop-product intent, but it is not yet a reliable downstream implementation contract. The `DESIGN.md` frontmatter is intentionally placeholder-based, yet it violates the required token types: downstream consumers cannot resolve concrete light/dark colors, typography properties, or component token objects. Resolve those machine-readable decisions and make mandatory human review operational before treating the spines as build-ready.

## 1. Flow coverage — thin

Checked the approved product brief’s core journey, required grid fields, summary/anomaly outcome, mock-only constraints, and every stated prototype surface against the two named Priya flows. Both flows have named protagonists, numbered steps, and a climax. The core happy path and anomaly path are represented, including date selection, results, inspection, comments, broker draft preview, and report save.

### Findings

- **[high]** The requirement that *every unmatched record receives human review* has no operational completion model: the flow says Priya begins review and then "proceeds to the next" record, but no reviewed state, progress indicator, completion condition, or rule prevents a report being saved before review is complete ([brief.md:35](../../briefs/brief-Hackathon-2026-08-15/brief.md#L35); [EXPERIENCE.md:104-107](EXPERIENCE.md#L104-L107)). *Fix:* define how a record becomes reviewed and the user-visible review-progress/completion behavior, including whether report save is gated or simply warned.
- **[medium]** Neither Key Flow supplies a labeled failure path, although comment and report-save failure/retry behavior is a consequential part of the stated interaction contract ([EXPERIENCE.md:68-70](EXPERIENCE.md#L68-L70); [EXPERIENCE.md:99-114](EXPERIENCE.md#L99-L114)). *Fix:* add a short failure branch to the core reconciliation flow for comment or report-save failure and recovery; add run failure only if the mock run can fail.

## 2. Token completeness — broken

Extracted all frontmatter tokens and all brace references. Every brace reference resolves by name (`colors`, `typography`, `rounded`, `spacing`, and `components`); however, the resolved token values do not satisfy the required `DESIGN.md` types. Rounded and spacing values are valid CSS dimensions, but the remaining load-bearing tokens are not machine-usable.

### Findings

- **[critical]** The complete color palette is unresolved: `colors.canvas` through `colors.danger` are assumption prose rather than hex values, while `matched`, `unresolved`, and `missing` only alias those unresolved values. The system-theme requirement also has no concrete light/dark token pairs, so contrast for primary action, text, focus, grid, status, and warning treatments cannot be checked ([DESIGN.md:8-21](DESIGN.md#L8-L21); [DESIGN.md:59-70](DESIGN.md#L59-L70); [EXPERIENCE.md:87](EXPERIENCE.md#L87)). *Fix:* commit flat, kebab-case, concrete hex tokens for each light/dark semantic role and document the load-bearing contrast pairs.
- **[high]** `typography` roles are strings rather than nested objects with `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, and optional `letterSpacing`; `components` entries are also strings rather than component-token objects. Several token keys use underscores (`surface_raised`, `text_primary`, `data_grid`, `detail_panel`) where the design spec requires kebab-case color keys and conventionally component names ([DESIGN.md:11-13](DESIGN.md#L11-L13); [DESIGN.md:22-29](DESIGN.md#L22-L29); [DESIGN.md:43-48](DESIGN.md#L43-L48)). *Fix:* replace each prose value with the required YAML object shape, use canonical hyphenated names, and keep explanatory prose in the body.

## 3. Component coverage — thin

Checked the visual and behavioral contracts for application shell, primary action/button, summary strip, results grid/data grid, status treatment, detail panel, comments, broker-email preview, report save, and motion. The body explains the principal grid and panel behavior well, but there is no complete shared component inventory that downstream consumers can extract consistently.

### Findings

- **[high]** Several load-bearing components used in the experience have no matching typed visual component entry—at minimum the as-of date control, summary strip, comments input/save feedback, broker-email preview, and report-save feedback. Conversely, `status` and `motion` exist as visual frontmatter entries but have no identically named behavioral component pattern; the available component strings are not valid component-token objects ([DESIGN.md:43-48](DESIGN.md#L43-L48); [DESIGN.md:92-104](DESIGN.md#L92-L104); [EXPERIENCE.md:40-56](EXPERIENCE.md#L40-L56)). *Fix:* establish one canonical, hyphenated component inventory; give every component a typed visual entry in `DESIGN.md` and an identically named behavioral contract in `EXPERIENCE.md`.

## 4. State coverage — thin

The state table covers first use, ready/running/completed reconciliation, no unresolved records, selected exception, comment/report save outcomes, anomaly warning, and system theme/reduced motion. This is a strong start for the happy path and for persistence failures.

### Findings

- **[medium]** State coverage does not close every IA surface: Dashboard has no latest-run cold-load/read-failure state; Start reconciliation has no invalid-date feedback; Results has no empty filtered-view state; Trade detail panel has no no-selection state; and Broker email preview has no no-broker, draft-generation failure, or dismissal/return behavior ([EXPERIENCE.md:20-27](EXPERIENCE.md#L20-L27); [EXPERIENCE.md:58-71](EXPERIENCE.md#L58-L71)). *Fix:* add only the applicable local-prototype states, mapping each to a surface and an explicit recovery action.

## 5. Visual reference coverage — strong

No `mockups/`, `wireframes/`, or `imports/` files exist in the workspace, so there are no orphaned visual artifacts or unlinked references. The absence of visual artifacts is mechanically valid; the two spines remain the source of truth.

### Findings

No findings.

## 6. Bloat & overspecification — strong

The pair is compact and focused on downstream decisions. `DESIGN.md` carries the visual rationale; `EXPERIENCE.md` carries information architecture, behavior, states, accessibility, platform behavior, and user journeys without repeating the entire product brief or imposing needless pixel-level layout constraints.

### Findings

No findings.

## 7. Inheritance discipline — thin

Both `sources` entries resolve to the approved product brief, and the two spines use the same product name and point `EXPERIENCE.md` to `DESIGN.md`. All brace references resolve syntactically to an existing token name, but their invalid token types are recorded in Token completeness.

### Findings

- **[medium]** Status vocabulary is not identical across the source and both spines: the brief/IA use `broker-missing` and `OT/MUREX-missing`, while Voice and Tone requires `Missing from broker` and `Missing from OT/MUREX`; the brief also distinguishes `matched` and `unmatched` while the dashboard uses the umbrella `unresolved` ([brief.md:34-36](../../briefs/brief-Hackathon-2026-08-15/brief.md#L34-L36); [EXPERIENCE.md:24](EXPERIENCE.md#L24); [EXPERIENCE.md:35](EXPERIENCE.md#L35)). *Fix:* define canonical status IDs and their exact user-facing labels once, then use the IDs consistently in data/filter contracts and the labels consistently in UI copy.

## 8. Shape fit — strong

`DESIGN.md` includes all eight canonical sections in the required order. `EXPERIENCE.md` includes Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, and Key Flows; Responsive & Platform is appropriately present for constrained desktop widths. Omitting Inspiration & Anti-patterns is defensible because the memlog names Apple/FAANG only as a quality benchmark, not as a specific reference product to emulate.

### Findings

No findings.

## Mechanical notes

- Both relative `sources` paths resolve to the approved product brief.
- All brace references resolve by path name: `colors.canvas`, `colors.surface`, `colors.surface_raised`, `colors.text_primary`, `colors.text_secondary`, `colors.border`, `colors.accent`, `colors.success`, `colors.warning`, `colors.danger`, `typography.data`, `rounded.control`, `rounded.card`, `rounded.panel`, `rounded.pill`, `spacing.unit`, `components.button`, `components.data_grid`, and `components.detail_panel`.
- Resolution by name does not make the tokens type-correct: color values are not hex strings, typography values are not nested objects, and component values are not objects. This is the principal implementation blocker.
- No Mermaid diagrams are present; therefore there is no Mermaid syntax to validate.
- Finding counts: **critical 1, high 3, medium 3, low 0**.
