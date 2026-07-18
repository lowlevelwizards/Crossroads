# Crossroads S1.0.1 — P1–P3 Implementation Report

## Scope

This pass begins from the fully reconstructed E1.5 → S1.0 project rather than the broken hybrid folder. It completes the three remediation priorities from the architecture audit:

1. prevent incomplete releases from loading silently;
2. remove low-risk stale and duplicate code;
3. reduce oversized coordinators without changing rules behavior.

## P1 — Release integrity

### Standalone release contract

`release-manifest.json` now defines the release version, base milestone, cache token, entry points, and mandatory files. S1.0.1 is packaged as a complete project folder; it does not depend on previous overlays.

### Automated integrity test

`tests/release-integrity.test.js` parses the actual HTML entry points and verifies:

- every local script and stylesheet exists;
- each resource appears once;
- cache tokens agree with the release manifest;
- critical modules load in dependency order;
- required E1.5 and S1.0 files are present;
- retired files are absent and are not loaded;
- README, editor shell, build metadata, and manifest versions agree.

`tests/run-all-node.js` runs this check first, so an incomplete folder fails before behavior tests can provide false confidence.

### Visible editor startup failure

`editor.html` now captures missing resources, uncaught startup exceptions, rejected promises, and initialization timeout. A failed editor displays a readable fatal-startup panel instead of blank selects and inert buttons.

### Current smoke boundary

`tests/startup-smoke.html` mirrors the current production module chain and validates required globals. The container used for this pass cannot complete Chromium headless startup because its system DBus/inotify facilities are restricted, so final interactive browser verification remains the acceptance step for this standalone ZIP.

## P2 — Cleanup

Removed:

- stale root `main.css` duplicate;
- empty placeholder files `src/infrastructure/Infrastructurd` and `src/input/Input`;
- retired `shooting-integration.js` and `assault-integration.js` wrappers;
- obsolete Mokra `src/rules/scenario-runtime.js` compatibility tombstone;
- overlay-only changed-file manifests.

Documentation and build metadata now describe one coherent S1.0.1 standalone release.

## P3 — Coordinator reduction

### Explicit combat composition

`src/rules/combat-runtime.js` is now an explicit factory:

```js
CrossroadsCombatRuntime.create(dependencies)
```

It receives query and commit adapters from `engine.js`; it no longer reaches into engine lexical state, installs itself after startup, replaces global engine functions, or monkey-patches battlefield presentation.

The superseded shooting, morale, and assault implementations were physically removed from `engine.js`. Pure rule modules plus the explicit combat runtime are now the only implementations.

### Building occupancy controller

`src/runtime/building-occupancy.js` now owns:

- building lookup and geometry queries;
- entry eligibility and door approach analysis;
- enter/exit commands;
- occupancy custody and reconciliation;
- occupied-building selection and rendering;
- building combat-context labels.

This leaves `engine.js` responsible for constructing the controller and providing authoritative state adapters rather than implementing the whole subsystem itself.

### Editor persistence boundary

`src/editor/editor-persistence.js` now owns:

- safe local-storage access;
- custom scenario draft loading, writing, and deletion;
- built-in scenario overwrite protection;
- last-scenario restoration;
- clipboard persistence;
- editor playtest handoff.

The editor coordinator now consumes one explicit persistence boundary. Storage unavailability degrades predictably instead of throwing during initialization or playtest launch.

### Size change

- `engine.js`: approximately 4,968 → 4,421 lines.
- `editor.js`: approximately 2,861 → 2,817 lines.
- The extracted modules are independently testable and receive explicit dependencies.

This is intentionally an incremental reduction rather than a wholesale rewrite. Inspector, rendering, and pointer-interaction extraction remain future deletion-driven passes after S1.0.1 is accepted in a real browser.

## Verification

The complete Node suite passes, including:

- release assembly and load-order integrity;
- 28 shooting, 20 morale, and 22 assault characterizations;
- explicit combat integration and ownership audits;
- building occupancy controller tests;
- scenario runtime, objective, Mokra, terrain, compositor, woodland, and editor tests;
- editor persistence behavior and storage-failure handling;
- syntax checks for all JavaScript in `src`, `data`, and `tests`.

## Recommended acceptance check

After extraction, open `editor.html` and confirm:

1. the header reads **S1.0.1**;
2. the Scenario dropdown contains built-in scenarios;
3. terrain, unit, and objective controls respond;
4. Mokra loads and playtest launches;
5. a custom scenario survives refresh;
6. a Destroy, Protect, or Hold objective can be selected and edited;
7. `index.html` starts and existing combat still resolves normally.
