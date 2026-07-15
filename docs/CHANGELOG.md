# Changelog

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
