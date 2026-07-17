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
