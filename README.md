# CROSSROADS — Foundation 2B.3S

## Actual 2B.3 startup regression

`scenarios.js` declared top-level classic-script constants named
`CORE_SCENARIO_12A` and `SCENARIOS`.

The inline battle engine then declared constants with those same names as
aliases to the external data. Classic browser scripts share one global lexical
environment, so the duplicate declarations caused a startup SyntaxError before
the engine could initialize.

That explains:

- no units
- nonfunctional camera controls
- no deployment initialization
- `Loading board…` remaining visible

## Fix

`scenarios.js` now assigns its data directly to:

- `window.CROSSROADS_CORE_SCENARIO_12A`
- `window.CROSSROADS_SCENARIOS`

It no longer creates colliding top-level `const` bindings.

Upload every file to the repository root and wait until the visible badge says
`Foundation 2B.3S`.
