# Scenario Runtime S1.0 — Objective Foundation

- Added a canonical scenario compiler, runtime session, scenario-event stream, and victory-policy boundary outside `engine.js`.
- Added registry-driven control, grouped-control, presence, exit, casualty, destroy, protect, hold, and custom objective evaluators.
- Migrated existing control, breakthrough, containment, and Mokra scoring into scenario data with no scenario-ID runtime branches.
- Added Scenario Schema v2 and automatic migration of legacy objective/scoring fields.
- Added runtime objective cards, exit lanes, control markers, and destroy/protect target badges.
- Added Scenario Composer controls for victory policies, thresholds, objective configuration, and visual target selection.
- Removed the old Mokra-specific scenario-runtime wrapper and temporary unsupported-objective conversion.
- Preserved all 70 combat-rule characterizations and current terrain/editor behavior.

# Terrain Editor E1.5 — Scene Depth, Terrain Semantics & Multi-Selection

- Split generated woodland trees into body and canopy fragments that depth-sort naturally with units.
- Added shallow building foreground fragments and centralized fragment offsets in the existing layer policy.
- Added pure terrain-semantic and polygon-spatial modules shared by movement, shooting, assault, editor, and runtime geometry.
- Promoted polygon terrain patches into authoritative gameplay footprints.
- Added local-width semantics for procedural linear terrain, including impassable wide-stream thresholds.
- Added Shift-click and marquee multi-selection, collective move/scale/rotate, and copy/paste across scenarios.
- Added reference remapping and collision-safe IDs for pasted scenario compositions.
- Added E1.5 regression tests for scene fragments, polygon clipping, terrain meaning, multi-selection, and clipboard behavior.
- Preserved all 70 combat-rule characterizations and current Mokra/scenario behavior.

# Terrain Editor E1.4.1 — Selection and Scenario Polish

- Expanded linear-terrain hit regions to match their authored width, with a safe minimum for thin paths and walls.
- Empty-space clicks, Esc, and Enter now reliably clear editor selection outside drawing mode.
- Replaced passive slider readouts with linked numeric inputs for precise typed values.
- Added rename and delete controls for locally saved custom scenarios while protecting built-in scenario definitions.
- Preserved E1.4 procedural woodland, schema, locking, combat, and scenario behavior.
- Reserved seasonal terrain changes for a future shared material/palette system.

# Terrain Editor E1.4 — Procedural Terrain Containers

- Added Scenario Schema v1 with explicit migrations, canonical visibility/locking fields, and legacy `hidden` cleanup.
- Added dedicated editor state, selection, and tool boundaries while retaining the existing snapshot history model.
- Replaced repeating woodland patch fills with deterministic generated layered-circle trees inside polygon boundaries.
- Added woods, dense-woods, and orchard generator variants with seed, density, spacing, edge padding, scale, rotation, and row controls.
- Kept generated trees presentation-only; scenario files serialize the polygon and compact generator settings rather than child objects.
- Shared woodland generation and tree rendering between the editor and live-game terrain runtime.
- Added object locking, grouped browser sections, and group-level visibility/locking controls.
- Added a permanent visual fixture and regression checks for deterministic generation, polygon containment, edge padding, orchard rows, and unit/tree depth ordering.
- Preserved current combat, scenario, objective, and terrain-rule behavior.

# Terrain Editor E1.3 — Advanced Terrain Authoring

- Added full-path selection feedback and group move, resize, rotate, duplicate, normalize, layer, and delete controls.
- Added second-click section/waypoint selection, per-waypoint widths, interpolated procedural widths, and branch authoring.
- Added working start/end cap treatments for fade, taper, off-table continuation, and junctions.
- Added irregular polygon terrain patches with editable vertices for woods, fields, hard-surface patches, mud, and ponds.
- Added building, road, stream, and patch material/color choices.
- Added explicit default layer bands plus per-object manual layer overrides.
- Added object thumbnails and per-object hide/show controls in both the object list and inspector.
- Hidden objects remain in scenario data and the editor list but are omitted from playtests.
- Rebuilt railway presentation around striped gray ballast, thicker outlined sleepers, closer spacing, and outlined rails.
- Added transform normalization controls and retained full E1.2 scenario-authoring behavior.

# Terrain Editor E1.2 — Scenario Authoring Controls

- Added cursor-centered wheel zoom and drag panning.
- Added editor visibility controls and a filtered, independently scrollable object browser.
- Added waypoint path drawing, segment selection, midpoint insertion, section deletion, and path splitting.
- Added blank/duplicate scenario creation with persistent local drafts.
- Added scenario types and objective-type-specific editor fields.
- Extended editor document tests and preserved the full combat/terrain regression suite.

## Terrain T3.5 — Scaling, Placement, and Label Cleanup

- Removed non-scaling SVG strokes so building outlines shrink naturally with battlefield zoom.
- Added far-zoom building detail reduction while preserving silhouettes and defining features.
- Hid persistent terrain labels; building labels now reveal on desktop hover and mobile tap, with Terrain Library tap support.
- Moved the Crossroads cottage and Hold the Farm farmhouse beside their roads instead of directly over them.
- Kept occupancy nameplates separate from terrain identification labels.
- Preserved one parent transform per terrain piece and avoided child-level inverse scaling.

## Terrain T3.4a — Building Integration Hotfix

- Removed an obsolete startup compatibility loop that attempted to assign into deleted legacy terrain aliases.
- Explicitly neutralized the old farmhouse background, border, and shadow skin so only the new SVG building art renders.

## Terrain T3.4 — Polish Village Buildings

- Replaced the old span-built building art with one modular inline-SVG presentation module.
- Added six exact building types: small cottage, medium cottage, long farmhouse, barn, shed, and church.
- Added twelve reusable Poland 1939 material appearances without duplicating geometry.
- Added authored doorway anchors and rotation-aware entry/approach geometry.
- Updated the three playable scenarios to use the new building family and proportional footprints.
- Rebuilt the Terrain Library building section to show both appearances for all six shapes.
- Removed obsolete farmhouse-specific DOM cache references and generic building-art CSS.
- Added startup validation for building shapes, appearances, and doorway metadata.
- Added a roof-group hook for future interior/roof-fade presentation.

## Terrain T3.3 — Layered Circle Woods

- Replaced outlined single-blob woods trees with parented, three-layer circle crowns.
- Added authored balanced, broad, tall, left-heavy, and right-heavy canopy presets.
- Added one shared soft patch shadow and a small optional trunk per tree.
- Woods and dense woods now use fixed authored arrangements while preserving existing rules footprints.
- Added far-zoom trunk suppression and a denser palette for dense woods.

# Changelog

## Visual Stability 3K — Formation and silhouette pass

- Locked clean Rifle zig-zag, Assault wedge, HQ stagger, and packed-MMG wedge formations.
- Raised all unit labels closer to their formations.
- Lowered individual shadows beneath the soldiers' feet.
- Rebuilt rifles with brown stocks and gray barrel/muzzle sections.
- Rebuilt SMGs as compact dark-gray weapons with visible box magazines.
- Redesigned packs to read as strapped equipment rather than brown limbs.
- Added deterministic left/right/up/down unit facing.
- Unit facing now updates from the dominant movement direction.
- Preserved selection, gameplay coordinates, and rule behavior.

## Visual Stability 3J — Unit presentation cleanup

- Added authored Rifle, Assault, Officer, and packed-MMG formations.
- Added compact medium-zoom labels using quality stripes plus HQ/RIF/SMG/MMG.
- Kept full unit names for close inspection only.
- Rebuilt deployed MMG crew markup so the carried weapon disappears.
- Increased deployed MMG visual scale and stabilized crew arrangement.
- Normalized individual miniature shadows.
- Added presentation-only edge containment without changing unit coordinates.
- No intended gameplay changes.

## Foundation 3I — Stabilization and single sources of truth

- Added explicit startup validation for required data and modules.
- Removed silent weapon, terrain, and unit-definition fallbacks from `engine.js`.
- Removed duplicate weapon range constants from the general rules object.
- Kept build-label application in the early independent `index.html` bootstrap only.
- Updated architecture documentation and historical source comments.
- Added `tests/startup-smoke.html`.
- No intended gameplay changes.

## Foundation 3H — Movement rules extraction

- Added `src/rules/movement.js`.
- Extracted movement legality, terrain cost, collision, and allowance fitting.

## Foundation 3G — Input and gesture extraction

- Added `src/input/camera-input.js`.
- Added `src/input/battlefield-input.js`.
- Extracted wheel, drag, pan, pinch, double-tap, and battlefield DOM bindings.

## Foundation 3F — Camera and coordinate extraction

- Added `src/camera/camera.js`.
- Added `src/camera/coordinates.js`.
- Extracted fit, zoom, rotation, surface sizing, framing, and coordinate conversion.

## Foundation 3E — Battlefield presentation extraction

- Added `src/presentation/battlefield.js`.
- Extracted unit-layer DOM rendering, command rings, MMG arcs, and visual effects.

## Foundation 3D — Unit presentation extraction

- Added `src/presentation/units.js`.
- Extracted unit markup, formation builders, counters, labels, Pins, and MMG views.

## Foundation 3C — Engine extraction

- Moved the inline battle engine from `index.html` to `src/engine.js`.

## Foundation 3B — Stylesheet extraction

- Moved the complete inline stylesheet to `styles/main.css` without changing
  cascade order.

## Foundation 3A — Repository architecture

- Created the clean folder architecture.
- Relocated existing data and infrastructure modules.
- Updated script paths.

## Terrain Editor E1.0 — Internal Scenario Composer

- Added `editor.html`, a desktop-first internal scenario authoring surface.
- Added a mutable editor document model separate from frozen runtime scenario data.
- Added direct manipulation for discrete terrain, units, objectives, deployment zones, and path waypoints.
- Added discrete terrain and linear path creation, duplication, deletion, resize, and rotation controls.
- Added path width, smoothing, style, cap, waypoint insertion, and waypoint removal editing.
- Added table grid, deployment-zone, and authoritative rules-footprint overlays.
- Added validation for IDs, bounds, unknown definitions, deployment zones, hard-terrain overlap, unit spacing, path geometry, junction caps, and objective placement.
- Added undo/redo, JSON import/export, JavaScript copy output, and download support.
- Added a localStorage playtest bridge that loads the editor document into the existing battle runtime without changing `engine.js`.


## Terrain Editor E1.1 — Main Menu Editor Integration

- Promoted Terrain Editor to a dedicated, clearly labeled live-game main-menu action.
- Main-menu launch uses the same packaged scenario and terrain data as the game.
- Editor launches Mokra by default and remembers the most recently edited scenario.
- Scenario selection is preserved when returning to the game.
