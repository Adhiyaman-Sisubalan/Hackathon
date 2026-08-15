# Current-Technology Reality Check

- **Target:** `ARCHITECTURE-SPINE.md`
- **Checked:** 2026-08-15
- **Recheck:** Updated spine after reviewer fixes
- **Method:** Compared every named framework, library, runtime version, and starter against current first-party release pages, documentation, or repository package metadata. The workspace still contains no `package.json` or `package-lock.json`, so installed compatibility remains a scaffold-time verification.
- **Verdict:** **Pass with low-priority patch drift.** No critical or high current-technology finding remains. Electron, bundled Node, Forge, Vite, TypeScript, Zod, TanStack Table, and Playwright now align with current stable releases or exact current release lines. The spine explicitly adopts TanStack Table v9 in AD-11 and pins `@tanstack/react-table` 9.1.2. React and Vitest trail only within their stable patch lines. The experimental Forge Vite plugin and release-candidate `node:sqlite` remain clearly declared and architecturally isolated prototype risks.

## Remaining Findings

### Low — React is one patch behind

The spine pins React 19.2.7; the current stable release is 19.2.8. This does not change architecture or APIs.

**Disposition:** Resolve React to 19.2.8 when creating the initial lockfile.

Primary source: [React releases](https://github.com/react/react/releases)

### Low — Vitest is three patches behind

The spine pins Vitest 4.1.7; the current stable release is 4.1.10. Vitest 5 remains pre-release, so staying on the 4.1 stable line is correct.

**Disposition:** Resolve Vitest to 4.1.10 when creating the initial lockfile.

Primary source: [Vitest releases](https://github.com/vitest-dev/vitest/releases)

### Advisory — `node:sqlite` is usable but not yet stable

Electron 43.4.0 bundles Node 24.18.1, whose `node:sqlite` module is documented as **Stability 1.2 — Release candidate**. The spine explicitly accepts this prototype risk and contains it behind main-process repository boundaries and migrations.

**Disposition:** Keep the current adapter boundary and run database migration/persistence smoke tests inside the packaged Electron runtime.

Primary source: [Node 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

### Advisory — Forge's Vite plugin remains experimental

Electron Forge 7.11.2 is the latest stable Forge release and its first-party `vite-typescript` template exists. Forge still labels the Vite plugin experimental and permits breaking changes in minor versions. The spine already pins this risk behind the build boundary.

**Disposition:** Generate from the first-party template, commit the resolved lockfile, then require development-build and packaged-build smoke tests before feature work.

Primary sources: [Electron Forge releases](https://github.com/electron/forge/releases), [Electron Forge Vite template](https://www.electronforge.io/templates/vite)

### Advisory — ExcelJS is latest but aging

ExcelJS 4.4.0 remains the repository's latest published version. Its age and open dependency-health reports are acceptable for this controlled mock-data prototype because workbook generation is isolated in a worker and verified before publish.

**Disposition:** Run `npm audit` after scaffold and retain workbook reopen/validation tests. Reassess before production.

Primary sources: [ExcelJS package metadata](https://github.com/exceljs/exceljs/blob/master/package.json), [ExcelJS current issues](https://github.com/exceljs/exceljs/issues)

## Complete Stack Recheck

| Declared item | Current reality | Result |
| --- | --- | --- |
| Electron 43.4.0 | 43.4.0 current stable | Current |
| Bundled Node 24.18.1 | Bundled by Electron 43.4.0 | Current and Electron-owned |
| Electron Forge 7.11.2 | Latest stable; Forge 8 remains alpha | Current |
| Forge Vite + TypeScript starter | First-party `vite-typescript` template exists; plugin is experimental | Supported prototype choice with declared risk |
| Vite 8.2.1 | 8.2.1 current stable | Current |
| React 19.2.7 | 19.2.8 current stable | Low patch drift |
| TypeScript 7.0.2 | Current TypeScript 7.0 stable line | Current |
| Zod 4.4.3 | Repository package metadata is 4.4.3 | Current |
| TanStack React Table 9.1.2 | React Table 9.1.2 stable | Current; explicit v9 contract in AD-11 |
| Node `node:sqlite` | Available in Node 24.18.1; Stability 1.2 release candidate | Supported prototype risk, not stable API |
| ExcelJS 4.4.0 | Latest published version, with maintenance cautions | Current version |
| Vitest 4.1.7 | 4.1.10 latest stable; 5.0 is pre-release | Low patch drift |
| Playwright 1.62.1 | 1.62.1 current stable | Current |
| npm + committed lockfile | No local package or lockfile exists yet | Valid rule; verify at scaffold |

## TanStack v9 Adoption Check

AD-11 now explicitly requires stable TanStack Table v9 and the stack pins `@tanstack/react-table` 9.1.2. The major-version ambiguity from the initial review is fully resolved. The remaining native semantic `<table>`, client-side operations, and no-virtualization rules are compatible with TanStack's headless v9 model.

Primary source: [TanStack Table releases](https://github.com/TanStack/table/releases)

## Recommended Initial Lockfile

Use the spine's current pins, adjusting only React to 19.2.8 and Vitest to 4.1.10. Then validate:

1. Forge development build and packaged macOS build.
2. TypeScript 7 typecheck across main, preload, renderer, and worker entries.
3. TanStack v9 semantic-table sorting, filtering, selection, and column-visibility behavior.
4. SQLite migrations and persistence under packaged Electron.
5. ExcelJS worker generation/reopen validation and Playwright Electron acceptance tests.
