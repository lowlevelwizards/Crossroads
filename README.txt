Crossroads movement animation hotfix

Root cause fixed:
1. Movement effects captured the default 72x48 table dimensions when the app started.
   Mokra's taller table later changed RULES.tableHeight, but the animation still
   positioned the visual using the old 48-inch height. This created large false
   southward movement before the unit snapped to its real destination.

2. The animation measured a delta in screen coordinates, then applied that delta
   inside the rotated board's local coordinate system. On portrait/rotated maps,
   this rotates the animation vector a second time, sending units sideways or
   vertically through terrain.

The patch now:
- queries the active scenario table size at animation time;
- positions every path segment using the active width and height;
- calculates the FLIP inverse in board-local pixels;
- leaves camera rotation to the board transform exactly once;
- preserves movement-facing calculation from the actual visible direction.

Changed files:
- src/engine.js
- src/presentation/effects.js
- tests/movement-animation-coordinate-regression.test.js
