---
title: 'Set Up the Initial Project from the Electron Forge Template'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project has approved planning artifacts but no application, tooling, tests, or Electron security boundary. The reconciliation prototype needs a secure, accessible local desktop foundation before feature work can begin.

**Approach:** Create the Electron Forge Vite + TypeScript foundation: secure process boundaries, typed dashboard data access, SQLite bootstrap, and an in-place shell with first-use, loading, and recoverable-error states. Stories 1.2 and 1.3 extend this base.

## Boundaries & Constraints

**Always:** Preserve `.agents/`, `_bmad/`, and `_bmad-output/`. Pin the approved Electron 43.4.0, Node 24.18.1, Forge 7.11.2, Vite 8.2.1, React 19.2.8, TypeScript 7.0.2, Zod 4.4.3, TanStack Table 9.1.2, ExcelJS 4.4.0, Vitest 4.1.10, and Playwright 1.62.1 stack in `package-lock.json`. Sandbox/context isolation stay enabled; Node integration is disabled; navigation/new windows are blocked; preload is allowlisted. Main alone owns SQLite/filesystem; shared IPC uses versioned Zod schemas. Use the prescribed source layout, one `tokens.css`, CSS Modules/shared primitives, and an in-place closed app-view model—no router or reload.

**Ask First:** Changes to the pinned stack, a native SQLite-driver substitution, production signing/distribution setup, a runtime network/cloud dependency, or any change to existing planning artifacts.

**Never:** Implement reconciliation, Results, run history, integrations, reports, or theme controls. Do not expose raw Electron, SQL, filesystem, or paths to the renderer; add a competing UI system, global client state, URL router, decorative motion, gradients, or card-heavy Dashboard.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| First launch | No database or completed run | One-time migration/seed bootstrap and calm first-use Dashboard with one reachable start action | Typed failure keeps action available; Retry preserves focus/context |
| Loading or query failure | Latest-summary query pending or retryable failure | Stable loading shell, then summary or calm control-associated error | Retry reissues the named query in place; no raw error/stack |
| System accessibility mode | OS light/dark, reduced-motion, or forced-colors changes | Sole token system maintains discernible focus/status treatment | No theme toggle; forced-colors uses system colors |

</frozen-after-approval>

## Code Map

- `package.json` and `forge.config.ts` -- pinned Forge/Vite/TypeScript scripts and packaged migration resource configuration.
- `src/main/index.ts`, `src/main/bootstrap/window.ts`, and `src/main/ipc/dashboard.ts` -- application startup, hardened BrowserWindow, and schema-validated Dashboard IPC.
- `src/main/adapters/sqlite/database.ts`, `src/main/modules/runs/runs-service.ts`, `migrations/001-initial.sql`, and `fixtures/initial-seed.ts` -- main-owned migration/seed and latest-summary lifecycle.
- `src/preload/index.ts`, `src/shared/contracts/*`, `src/renderer/app/App.tsx`, `src/renderer/features/dashboard/Dashboard.tsx`, and `src/renderer/styles/tokens.css` -- named preload boundary, versioned contracts, closed navigation, Dashboard states, and OS-aware styling.
- `tests/integration/bootstrap.test.ts`, `tests/unit/dashboard-retry.test.tsx`, `tests/unit/tokens.test.ts`, and `tests/e2e/electron.acceptance.ts` -- matrix coverage and packaged Playwright Electron acceptance.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `package-lock.json`, `forge.config.ts`, `vite.*.config.ts`, and `tsconfig*.json` -- scaffold Forge/Vite/TypeScript, pin dependencies, and define development, test, package, and demo-reset scripts -- establishes the offline toolchain.
- [x] `src/main/bootstrap/*`, `src/main/index.ts`, `src/main/ipc/*`, and `src/shared/contracts/*` -- add secure window/bootstrap, typed result envelopes, and versioned dashboard IPC with sender/payload validation -- makes main the secure boundary.
- [x] `src/main/modules/runs/*`, `src/main/adapters/sqlite/*`, `migrations/*`, `fixtures/*`, and `scripts/demo-reset.*` -- add minimal one-time migration/seed lifecycle, injected seams, and main-owned latest-summary query -- supports Dashboard state without renderer persistence.
- [x] `src/preload/*` -- expose only named, contract-backed dashboard/navigation methods -- blocks renderer access to privileged primitives.
- [x] `src/renderer/app/*`, `src/renderer/features/dashboard/*`, `src/renderer/components/*`, and `src/renderer/styles/tokens.css` -- implement Overview/Runs/Exceptions shell and accessible Dashboard states/retry/start action -- delivers the first operational surface.
- [x] `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`, and test configuration -- verify contracts, bootstrap, secure window, Dashboard states/retry, keyboard navigation, and offline Electron launch -- proves the foundation is extensible.

**Acceptance Criteria:**
- Given installed dependencies, when the development or package command runs, then Electron opens to Dashboard from the pinned lockfile without a runtime server/network dependency.
- Given a BrowserWindow and handlers, when inspected, then sandbox/context isolation are enabled, Node integration and navigation/new windows are blocked, and preload exposes only schema-validated named methods.
- Given no database or completed run, when bootstrap finishes, then ordered migrations/one-time seeding complete through configured seams and all destinations show useful keyboard-reachable first-use states without reload.
- Given latest-summary loading, success, or failure, when Dashboard renders, then it shows stable loading, compact summary, or retryable error while retaining the one start action and focus context.
- Given keyboard use or system accessibility modes, when operating the shell, then reading-order focus, appropriate live feedback, non-color-only status, and OS token treatment are preserved.
- Given automated and packaged smoke tests, when run, then bootstrap, IPC, window security, Dashboard states, retry, navigation, and offline launch pass reproducibly.

## Design Notes

Keep the renderer thin: it owns the closed current-view union and ephemeral request state, replaces immutable main DTOs, and never reconstructs persistence facts. The visually minimal Dashboard must preserve state and feedback seams for Story 1.2.

## Verification

**Commands:**
- `npm run lint` -- expected: TypeScript/style checks pass with no source or configuration errors.
- `npm test` -- expected: unit and integration coverage passes deterministically using injected seams.
- `npm run test:e2e` -- expected: Electron acceptance checks pass for launch, secure shell, and keyboard Dashboard navigation.
- `npm run package` -- expected: packaged macOS application builds and opens without runtime network dependencies.

## Suggested Review Order

**Startup and security boundary**

- Establishes secure bootstrap and preserves a recoverable Dashboard when startup fails.
  [`index.ts:28`](../../src/main/index.ts#L28)

- Applies isolated web preferences, navigation guards, and explicitly reveals the loaded window.
  [`window.ts:14`](../../src/main/bootstrap/window.ts#L14)

- Restricts Dashboard IPC to the exact expected main-frame renderer URL.
  [`dashboard.ts:7`](../../src/main/ipc/dashboard.ts#L7)

**Durable local state**

- Applies ordered transactional migrations and deterministic latest-summary selection.
  [`database.ts:15`](../../src/main/adapters/sqlite/database.ts#L15)

- Packages the migration resource so the released application can bootstrap locally.
  [`forge.config.ts:4`](../../forge.config.ts#L4)

**Operational shell**

- Keeps Dashboard state, retry behavior, and Story 1.2 handoff feedback explicit.
  [`Dashboard.tsx:7`](../../src/renderer/features/dashboard/Dashboard.tsx#L7)

**Verification**

- Exercises the packaged visible application and keyboard shell navigation through Playwright.
  [`electron.acceptance.ts:10`](../../tests/e2e/electron.acceptance.ts#L10)
