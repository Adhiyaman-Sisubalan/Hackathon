---
name: Reconciliation Prototype
description: Professional visual identity for a premium, data-dense Electron reconciliation prototype.
status: final
sources:
  - ../../briefs/brief-Hackathon-2026-08-15/brief.md
updated: 2026-08-15
colors:
  canvas-light: '#F7F8FA'
  surface-light: '#FFFFFF'
  surface-raised-light: '#F1F5F9'
  text-primary-light: '#111827'
  text-secondary-light: '#475569'
  border-light: '#64748B'
  accent-light: '#0B5CAD'
  accent-foreground-light: '#FFFFFF'
  focus-ring-light: '#0B5CAD'
  success-light: '#166534'
  warning-light: '#9A6700'
  danger-light: '#B42318'
  canvas-dark: '#111827'
  surface-dark: '#182230'
  surface-raised-dark: '#1F2937'
  text-primary-dark: '#F9FAFB'
  text-secondary-dark: '#CBD5E1'
  border-dark: '#94A3B8'
  accent-dark: '#6CB6FF'
  accent-foreground-dark: '#0B1F33'
  focus-ring-dark: '#93C5FD'
  success-dark: '#4ADE80'
  warning-dark: '#F6C453'
  danger-dark: '#F87171'
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '28px'
    fontWeight: '600'
    lineHeight: '34px'
    letterSpacing: '-0.01em'
  heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '20px'
    fontWeight: '600'
    lineHeight: '26px'
  section:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '14px'
    fontWeight: '600'
    lineHeight: '20px'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '14px'
    fontWeight: '400'
    lineHeight: '20px'
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '12px'
    fontWeight: '500'
    lineHeight: '16px'
  data:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif'
    fontSize: '12px'
    fontWeight: '400'
    lineHeight: '18px'
    letterSpacing: '0'
rounded:
  control: '8px'
  card: '12px'
  panel: '14px'
  pill: '999px'
spacing:
  unit: '4px'
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
components:
  application-shell:
    background: '{colors.canvas-light}'
    border: '{colors.border-light}'
    radius: '0px'
  dashboard:
    background: '{colors.canvas-light}'
    surface: '{colors.surface-light}'
    radius: '{rounded.card}'
  primary-action:
    background: '{colors.accent-light}'
    foreground: '{colors.accent-foreground-light}'
    radius: '{rounded.control}'
  as-of-date-control:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.control}'
  summary-strip:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.card}'
  results-grid:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.card}'
  status-treatment:
    success: '{colors.success-light}'
    warning: '{colors.warning-light}'
    danger: '{colors.danger-light}'
  detail-panel:
    background: '{colors.surface-raised-light}'
    border: '{colors.border-light}'
    radius: '{rounded.panel}'
  comments:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.control}'
  broker-email-preview:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.card}'
  report-save:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.control}'
  feedback:
    focus: '{colors.focus-ring-light}'
    radius: '{rounded.control}'
  inspector-toggle:
    background: '{colors.surface-light}'
    border: '{colors.border-light}'
    radius: '{rounded.control}'
---

# Brand & Style

The reconciliation prototype is a serious, fast desktop workspace. It earns premium polish through restraint, alignment, and instantaneous feedback—not decorative effects. Its defining visual goal is **dense data made effortless**: the business can scan operational state immediately and investigate without losing context.

The application follows the active system light or dark theme. Motion confirms cause and effect but never delays work, feels web-like, or competes with data.

# Colors

The light palette uses a restrained slate base with one professional blue action color. The dark palette uses cool charcoal surfaces and a brighter blue action color. System-theme mapping is direct: use the `*-light` token set in light mode and the corresponding `*-dark` token set in dark mode.

- Primary text meets at least 4.5:1 against its canvas and surface; secondary text also targets 4.5:1 for data-heavy reading.
- `{colors.accent-light}` / `{colors.accent-dark}` are reserved for the dominant action and visible focus treatment, never decoration.
- Status colors reinforce text and icons: success for `matched`, warning for the unresolved umbrella, and danger for missing or failed states.
- Interactive boundaries, focus rings, and essential grid separators maintain at least 3:1 contrast against adjacent surfaces.

In OS high-contrast or forced-colors mode, use system colors rather than these custom values. Status labels, selected rows, focus, validation, warning, and error states must remain distinct without color alone.

# Typography

Use the platform-native system sans-serif stack for immediate, familiar rendering. `{typography.data}` uses tabular numerals at runtime for amount, quantity, rate, and date columns so values compare vertically at a glance. Preserve a restrained hierarchy: no decorative display type and no all-caps data labels.

# Layout & Spacing

Use the `{spacing.unit}` scale consistently. The desktop shell keeps the dashboard summary and dominant start action clear, then gives the grid the visual priority in the results workspace. The adjacent detail panel preserves the user’s investigation context.

Dense content earns space through grouping, alignment, and stable placement—not oversized cards. Use larger spacing between sections and compact, predictable spacing inside rows, toolbars, and field groups.

# Elevation & Depth

Separate surfaces primarily with tone and subtle borders. Reserve modest elevation for transient menus, confirmation feedback, and the raised inspection panel. Avoid stacked floating cards, dramatic shadows, gradients, or glass effects.

# Shapes

Use `{rounded.control}` for controls, `{rounded.card}` for summary and grid surfaces, and `{rounded.panel}` for the trade-detail panel. Status badges use `{rounded.pill}`. Avoid excessive rounding that weakens the operational character of the workspace.

# Components

All components use their named `{components.*}` contract; matching behavioral contracts live in `EXPERIENCE.md`.

- **application-shell** — a compact persistent desktop navigation frame for orientation, with no marketing-style header treatment.
- **dashboard** — quiet operational overview with summary surfaces and a dominant start action.
- **primary-action** — the single visually dominant action on a surface.
- **as-of-date-control** — compact, clearly labelled date input with visible validation.
- **summary-strip** — compact operational metrics and inline anomaly context.
- **results-grid** — dense, scan-friendly table with quiet structure and stable selected-row treatment.
- **status-treatment** — text, icon, and semantic color together; warning remains non-blocking.
- **detail-panel** — persistent adjacent context, not an interruptive modal.
- **comments**, **broker-email-preview**, and **report-save** — focused secondary surfaces that remain clear without competing with the primary workflow.
- **feedback** and **inspector-toggle** — plain, visible, system-theme-aware state and access affordances.

Visual references: [dashboard mockup](mockups/dashboard.html) illustrates the `dashboard`, `primary-action`, `summary-strip`, and `status-treatment` contracts; [results-workspace mockup](mockups/results-workspace.html) illustrates `results-grid`, `detail-panel`, `comments`, and `broker-email-preview`.

# Do's and Don'ts

Do:

- Make business-critical data legible at a glance and every trade field reachable without leaving the results workspace.
- Preserve stable grid, filter, panel, and focus positions so repeat users build muscle memory.
- Pair all status color with text and a distinct icon or shape where useful.
- Make the post-run summary and non-blocking anomaly warning understandable in seconds.

Don't:

- Turn the product into a spreadsheet clone or a card-heavy dashboard.
- Use decorative animation, oversized hero content, or visual clutter that delays investigation.
- Hide important trade data behind a modal-only experience.
- Signal an anomaly as a failure; it is a warning for human judgment.
