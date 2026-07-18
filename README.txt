Crossroads route overlay + false building obstruction hotfix

Replace:
- src/engine.js
- src/rules/movement.js
- styles/stabilization.css

Optional regression test:
- tests/movement-overlay-clearance-regression.test.js

Changes:
1. The movement route now owns a positioned overlay layer at z-index 7600,
   above roads, field patches, promoted terrain, buildings, and units.
2. Route segments rotate from their actual starting point and cannot intercept input.
3. Buildings no longer inflate their collision area by the full 1.6-inch unit radius.
   They use a small 0.55-inch body clearance, reducing false blockage around roofs,
   sheds, cottages, and narrow village gaps while buildings themselves remain impassable.
4. Deployment and movement use the same building-overlap helper.

Validated with movement animation, terrain footprint, scene compositor, Mokra scenario,
and viewport interaction regression tests.
