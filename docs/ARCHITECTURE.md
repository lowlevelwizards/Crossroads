# Editor viewport and interaction boundaries (S1.1.1)

`src/camera/table-viewport.js` is the shared pure geometry authority for table normalization, natural board pixels, fit zoom, pan-surface margins, and centered scrolling. Both `src/camera/camera.js` and `src/editor/editor.js` consume it, so neither application owns a private 6×4 camera formula.

`src/editor/editor-tools.js` owns the small interaction-mode vocabulary and transient-mode transitions:

- Select
- Pan
- Place
- Draw linear terrain
- Draw terrain patch
- Edit points
- Scale

The editor coordinator still commits document mutations, but active tool modes receive pointer input before canvas selection. Locked and canvas-hidden objects are excluded from hit testing rather than selected and rejected afterward.

`src/camera/coordinates.js` converts browser pointer positions to table-space from the board's visual bounding rectangle. Gameplay coordinates therefore remain correct across zoom, arbitrary table aspect ratios, and rotated mobile presentation.

# Editor shell boundary (S1.1.0)

`src/editor/editor-shell.js` owns only transient interface state: active workspace, active right-panel tab, popovers, and responsive drawers. It does not own the scenario document, selection, history, tools, or persistence. `src/editor/editor.js` remains the authoring coordinator and renders the visual asset library and scene hierarchy from the authoritative registries and document.

The editor has three focused workspaces:

- **Build** — searchable visual asset library and placement/drawing entry points.
- **Organize** — grouped scene hierarchy, multi-selection, visibility, locking, and layer order.
- **Scenario** — scenario management, template, victory, and objective-authoring entry points.

Inspector, validation, and canonical scenario data are mutually exclusive right-panel tabs rather than a permanent vertical stack.

---

# Crossroads Architecture

## Current foundation

Crossroads is a browser game hosted through GitHub Pages. It uses ordered classic
scripts rather than a build tool or package manager so the project remains easy
to upload and test from a phone.

The primary flow is:

```text
data → rules/state → presentation
         ↑            ↓
       input ← camera/coordinates
```

## Repository ownership

```text
index.html
  Semantic application structure and ordered script loading.

styles/main.css
  Current historical stylesheet. It remains in one file until visual behavior
  is stable enough to split without changing cascade order.

data/
  Static definitions, build metadata, and authored unit formations. These files
  are authoritative. The engine must not contain fallback copies.

src/engine.js
  Remaining battle coordinator: runtime state, turn flow, rule commitment,
  deployment, scoring, reports, adaptive UI, and bootstrap.

src/infrastructure/
  Shared browser helpers and startup validation.

src/rules/movement.js
  Pure movement legality, terrain cost, collision, and allowance fitting.

src/rules/morale.js
  Pure officer-support lookup, Order Test targets and outcomes, Rally outcomes,
  and incoming-Pin routing analysis. It does not mutate units, render, log, or
  update statistics.

src/rules/shooting.js
  Pure fire-group availability, range, MMG arcs, LOS, cover, hit targets, damage
  rolls, cover saves, and casualty-count calculation. Incoming Pins are
  interpreted by the morale module rather than by shooting itself.

src/rules/assault.js
  Pure charge legality, reaction-fire eligibility, Defensive Position analysis,
  assault dice order, combat rounds, casualties, and winner calculation. It does
  not mutate units, move winners, occupy buildings, render, log, or update stats.

src/rules/combat-runtime.js
  Explicit combat composition factory. It receives engine-owned query and commit
  adapters, creates the pure morale/shooting/assault rule instances, and returns
  the callbacks used by the engine and battlefield renderer. It does not replace
  globals or reach into engine lexical state.

src/runtime/building-occupancy.js
  Focused building controller for occupancy queries, doorway entry/exit commands,
  occupancy rendering, building target selection, and custody cleanup.

src/editor/editor.js
  Authoring coordinator for rendering, inspector composition, pointer interaction,
  transforms, validation, and event binding.

src/editor/editor-persistence.js
  Safe local draft storage, built-in overwrite protection, last-scenario restoration,
  clipboard persistence, and editor-playtest handoff.

src/rules/terrain-geometry.js
  Normalized terrain instances, authored building doorway anchors, rotation-aware
  entry points, and approach-marker geometry.

src/presentation/
  Battlefield, unit, miniature, terrain, building, overlay, targeting, and effect
  presentation. Presentation reads current truth and does not resolve combat.

tests/combat-rules.html
  Combined browser dashboard for deterministic shooting, morale, and assault
  tests.

tests/run-combat-rules-node.js
  Runs shooting, morale, assault, integration, and architecture checks from Node.

tests/startup-smoke.html
  Loads the real production module chain without starting the battle engine and
  reports missing globals or invalid registries.

tests/release-integrity.test.js
  Parses every production entry point and verifies local resources, dependency
  order, cache tokens, release metadata, mandatory milestone files, and removal
  of retired production files.

release-manifest.json
  Authoritative standalone-release contract: version, E1.5 base, cache token,
  entry points, and mandatory files.
```

## Architectural rules

1. Data files describe things; they do not manipulate DOM or battle state.
2. Rule modules calculate results; they do not render, log, or commit state.
3. Presentation modules render current truth; they do not resolve combat.
4. Input modules translate browser events into calls; they do not own rules.
5. Camera modules own view transforms; gameplay coordinates remain table-space.
6. `engine.js` coordinates modules and commits state while it is gradually reduced.
7. Do not add silent fallback copies of external data.
8. One subsystem extraction or behavior change per foundation stage.
9. Random rule resolution accepts injected dice so it can be characterized
   deterministically.
10. A rule result describes intended state changes; the engine remains the only
    owner of runtime mutation until the state layer is deliberately extracted.

## Foundation 4B.1 morale boundary

The pure morale module owns:

- finding a friendly officer within the 6-inch command radius
- excluding officers from receiving officer support
- the +1 command Morale bonus
- deciding whether an Order Test is required
- Rally ignoring Pin penalties
- Order Test target calculation and 2-to-11 clamping
- 2d6 pass/fail calculation
- the described one-Pin removal after an ordinary passed test
- the described all-Pin removal after a successful Rally
- the described Down state after a failed test
- deciding whether newly received Pins reach the unit's Morale and cause routing

The engine still owns:

- deciding when an order becomes committed
- preserving reversible Fire targeting until a legal target is confirmed
- supplying dice
- transaction locking
- combat and morale logs
- Order Test and battle statistics
- mutating Pins, Down, activated, order, and outcome state
- Rally presentation effects and final Pin clearing
- finishing or continuing the activation

## Foundation 4B.1 shooting boundary

The pure shooting module owns:

- legal fire groups and weapon range
- moving and fixed-weapon restrictions
- MMG crew output and firing arcs
- building and terrain LOS
- woods, walls, Down, and occupied-building cover
- per-weapon hit targets
- hit, damage, save, and casualty-count calculation
- requesting incoming-Pin interpretation from morale

The engine still owns:

- target selection and action flow
- dice presentation and combat logs
- battle statistics
- Pin and casualty mutation
- casualty-order weapon removal
- MMG undeployment after crew loss
- unit outcomes and building reconciliation
- effects, rendering, and activation completion



## S1.0.1 explicit combat and building boundaries

The combat load order remains simple and classic-script friendly:

1. `src/rules/morale.js`
2. `src/rules/shooting.js`
3. `src/rules/assault.js`
4. `src/runtime/building-occupancy.js`
5. `src/rules/combat-runtime.js`
6. startup validation
7. `src/engine.js`

The engine now constructs both runtime controllers explicitly:

```text
engine-owned dependencies
  ├─→ CrossroadsBuildingOccupancy.create(...)
  └─→ CrossroadsCombatRuntime.create(...)
          ├─ morale rules
          ├─ shooting rules
          └─ assault rules
```

`combat-runtime.js` no longer replaces `CrossroadsBattlefieldPresentation`,
assigns engine function bindings, or relies on late global lexical lookup. The
engine passes all state queries and commit callbacks through one visible
composition block, then passes returned rule callbacks to presentation.

The previous shooting, morale, and assault implementations have been removed
from `engine.js`. There is now one physical implementation of each calculation:
the pure rules modules, with one commit adapter factory.

`building-occupancy.js` owns:

- building lookup, labels, center/door/approach points
- vacant-building and movement-based entry analysis
- occupancy custody and one-unit capacity
- Enter/Exit command creation and execution
- building combat context labels
- occupied-building selection and presentation
- invalid or destroyed occupant cleanup

The engine still owns authoritative unit state, turn/activation flow, movement
analysis, logs, announcements, selection state, and final mutation. The building
controller receives those capabilities through explicit callbacks.

Retired integration files and compatibility aliases are deleted. Future combat
or building work must extend the explicit factories rather than add wrapper
scripts or replacement globals.

## Permanent combat regression suite

Run:

```text
node tests/run-combat-rules-node.js
```

Expected coverage:

- 28 shooting tests
- 20 morale tests
- 22 assault tests
- shooting/morale state-commit integration
- assault and building-capture state-commit integration
- permanent runtime ownership and load-order audit

The browser dashboard remains:

```text
tests/combat-rules.html
```

## Next highest-impact work

1. Build Mokra M1 with existing infantry, officers, MMGs, railway, woods,
   buildings, walls, Ambush, and Assault.
2. Use playtesting to tune deployment, pressure, objectives, and terrain.
3. Add only the support weapon Mokra proves is missing first.
4. Keep combat rule changes separate from scenario-content commits.

## Mokra M1 scenario extension

Mokra originally introduced grouped control points through a temporary runtime wrapper. Scenario Runtime S1.0 removes that wrapper and compiles Mokra through the same evaluator registry as every other scenario. Named deployment sub-zones remain normal scenario data, while railway crossing behavior still emerges from terrain composition rather than scenario-specific movement code.

Scenario definitions remain pure data. Grouped-control scenarios use `type: "control_group"`; split deployments put `subzones` on the normal faction zone and assign `deploymentZone` on force entries.

## Mokra M1.1 terrain contracts

Terrain now separates its visual rectangle from its authoritative rules footprint. Scenario data continues to describe the artwork size; `terrain-geometry.js` normalizes inset building footprints once, and all existing movement, deployment, LOS, occupancy, and assault consumers receive that same rules rectangle.

`terrain-runtime.js` is the concise composition boundary loaded after the base terrain renderer. It adds field decoration and invokes the connected linear renderer; it does not mutate terrain rules or scenario state. Camera transforms are continuous, while LOD and overlay refresh are deferred until zoom settles.

Road, stream, and field variants remain registry data using shared renderers. New scenarios should compose those reusable pieces rather than add scenario-specific CSS or combat branches.


## Terrain Foundation L1 — Connected Linear Terrain

Scenario terrain is now divided by geometry type:

- `terrain`: discrete pieces such as buildings, woods, fields, foxholes, and scatter.
- `linearTerrain`: waypoint-authored roads, streams, ditches, railways, hedges, fences, and walls.
- `junctions`: explicit seam-hiding nodes such as T-junctions and crossroads.
- `crossings`: explicit relationships such as a bridge or culvert where two paths intersect.

`path-geometry.js` owns deterministic centerline creation and sampling. `linear-terrain.js` compiles those paths into shared presentation data and conservative gameplay corridors. `presentation/linear-terrain.js` renders the same centerlines as layered SVG strokes and repeated details. Scenarios author waypoints; they do not position individual visual tiles.

Closed terrain patches and an editor may reuse control-point concepts later, but remain separate systems.


## Terrain L1.2 scene composition

Linear terrain shares path geometry but retains family-specific visual recipes. Ground paths stay below discrete terrain. Buildings are promoted into the battlefield scene and depth-sort against units by their table Y position. Objectives and interaction overlays use fixed layers above the scene. `scene-compositor.js` is the sole owner of dynamic building/unit depth; arbitrary terrain z-index patches should not be added elsewhere.

## Terrain Editor E1 — Internal Scenario Composer

The editor is a separate application surface at `editor.html`. It deliberately
loads scenario data, terrain registries, shared path geometry, and the existing
terrain renderers without loading `src/engine.js`.

The editor boundary is:

```text
frozen runtime scenario
        ↓ clone
mutable editor document
        ↓ validate / render
shared terrain and path presentation
        ↓ export
clean scenario JSON or JavaScript
```

`src/editor/editor-document.js` owns cloning, collection lookup, collision-safe
ID generation, duplication, deletion, serialization, and playtest-document
creation. It contains no DOM behavior.

`src/editor/editor-validation.js` owns authoring-time validation for table
bounds, IDs, registered terrain and unit definitions, path geometry, intentional
off-table endpoints, deployment zones, hard-terrain overlap, unit spacing,
objectives, and explicit junction/crossing attachments. It reports findings but
does not mutate the document.

`src/editor/editor.js` owns authoring interaction and presentation: selection,
dragging, resize and rotation handles, waypoint editing, object creation,
undo/redo, inspector fields, overlays, import/export, and launch controls.

The editor reuses `CrossroadsTerrainPresentation`,
`CrossroadsLinearTerrainPresentation`, `CrossroadsPathGeometry`, and the
registries in `data/`. It must not create editor-only approximations of terrain
geometry.

`data/editor-playtest.js` is an optional pre-engine bridge. It runs only when
`index.html?editorPlaytest=1` is opened, reads the editor document from
same-origin local storage, injects it into `CROSSROADS_SCENARIOS`, selects it
before engine startup, and leaves normal game startup unchanged otherwise.

Run the editor regression check with:

```text
node tests/editor-e1.test.js
```

The next editor stage should rebuild Mokra from a clean duplicate using direct
manipulation, then add explicit junction and crossing editing before any broad
linear-terrain visual rewrite.
## Terrain Editor E1.4 authoring boundary

E1.4 introduces a canonical scenario-loading pipeline:

```text
raw scenario → schema migration → normalization → editor/runtime document
```

`src/scenario/` owns schema versioning, migrations, visibility, and locking.
New exports write `schemaVersion: 1`, use `visible`, and do not preserve the
legacy `hidden` field.

Procedural terrain follows a separate pure-data pipeline:

```text
polygon + generator settings + seed
  → pure deterministic generation
  → shared presentation renderer
```

`src/generation/` owns seeded candidate generation, polygon tests, row layouts,
and woodland placement. It has no DOM or CSS knowledge. Generated tree children
are never authoritative scenario objects and are not serialized.

`src/presentation/woodland-trees.js` is the shared tree-shape renderer used by
both authored discrete woods and generated polygon woods. The polygon remains
the authoritative gameplay footprint. Generated tree bodies use the same table-Y
depth contract as units.

The editor controller has begun separating into:

- `editor-state.js` for application state and snapshot history containers.
- `editor-selection.js` for whole-object/component selection normalization.
- `editor-tools.js` for drawing-tool lifecycle.

This is an incremental split, not a framework migration. Classic ordered scripts,
plain JavaScript, and snapshot undo remain intentional. Future editor extraction
should move one coherent responsibility at a time and delete the controller logic
it replaces.

## Terrain Editor E1.5 scene, semantics, and selection boundary

E1.5 keeps terrain appearance, terrain meaning, and editor manipulation as three
separate concerns:

```text
scenario geometry
  ├─ pure spatial queries → movement / shooting / assault
  ├─ semantic normalization → movement, cover, LOS, access
  └─ shared presentation → body / foreground / canopy fragments
```

`src/rules/terrain-semantics.js` is the canonical rules vocabulary for terrain.
It normalizes stable fields such as movement, cover, line of sight, defensive
position, infantry access, and vehicle access. Local linear-terrain width may
refine those semantics without changing the authored style definition.

`src/rules/terrain-spatial.js` owns polygon point and segment queries. The
terrain geometry registry now includes discrete rectangles, polygon patches,
and compiled linear corridors. Combat rules receive one optional
`segmentTerrainClip` dependency and preserve their previous rectangle fallback
for isolated characterization tests.

Complex scenery may emit multiple presentation fragments while remaining one
scenario object. Woodland floor remains a ground patch; tree bodies share the
unit table-depth band; tree canopies receive a small fragment offset. Buildings
may emit a shallow foreground clone. `layer-policy.js` remains the only numeric
layer authority, and manual layering remains an authored exception rather than
the normal occlusion mechanism.

Multi-selection is object-level. `editor-multiselect.js` owns selection-set
identity, collective bounds, intersection tests, and point rotation. The editor
document owns clipboard serialization and paste-time ID/reference remapping.
Component editing remains single-selection so path waypoints and polygon
vertices retain unambiguous behavior. Snapshot undo remains intentional.
## Editor persistence boundary

`src/editor/editor-persistence.js` is constructed explicitly by `editor.js` with the
canonical document model, built-in scenario registry, shared source map, and optional
browser storage. It owns local drafts, remembered scenario selection, clipboard
persistence, and playtest transfer. Storage failures return explicit status rather than
breaking editor initialization. Built-in scenario IDs cannot be overwritten by local
storage.

## Standalone release integrity

S1.0.1 is distributed as a complete project folder. Incremental overlays are no
longer the primary release format.

`release-manifest.json` and `tests/release-integrity.test.js` make assembly part
of the tested product. The integrity test resolves every local `<script>` and
`<link>` from `index.html`, `editor.html`, and `tests/startup-smoke.html`; an
absent E1.5 dependency now fails immediately in Node.

The Scenario Composer installs a tiny inline error boundary before external
resources. Missing files, uncaught startup exceptions, and unhandled promise
rejections produce a visible fatal panel instead of a populated-looking but
inert editor shell.

## Scenario Runtime S1.0 objective boundary

Scenario loading now follows one canonical pipeline:

```text
raw scenario
  → schema migration and normalization
  → scenario compiler
  → objective runtime session
  → score requests and victory result
```

`src/scenario-runtime/scenario-runtime.js` owns per-battle objective state and a small scenario-specific event history. The engine emits normalized events only after committing authoritative battlefield changes. Objective evaluators never move units, apply casualties, or update the DOM.

`src/rules/objectives/objective-registry.js` is the single runtime authority for supported objective types. Each evaluator may create private state, handle committed events, calculate a presentation snapshot, and validate its definition. Current evaluators cover control, grouped control, presence, exits, casualties, destroy, protect, hold, and passive custom objectives.

`src/rules/objectives/victory-policies.js` interprets accumulated scores and decisive-objective results. Objectives report progress and score deltas; victory policy decides whether the battle ends and how ties are resolved.

`src/scenario-runtime/scenario-presentation.js` renders objective cards and battlefield markers from evaluator snapshots. It does not calculate ownership or scoring. The editor, validator, and live game all load the same objective registry and Schema v2 definitions.

The former Mokra-specific rules wrapper has been deleted. New scenario mechanics belong in evaluators or generic runtime events, never scenario-ID branches in `engine.js`.

