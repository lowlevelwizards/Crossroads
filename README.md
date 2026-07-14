# CROSSROADS — Foundation 2D

## Render coordinator

The existing battlefield presentation now runs through one ordered pipeline:

1. `beforeRender` hooks
2. unit layer
3. building state
4. range ring
5. waypoint and route
6. exit zone
7. scenario UI
8. targeting mode
9. activation transaction badge
10. cancel-button label
11. deployment tray
12. startup diagnostic
13. adaptive UI queue
14. `afterRender` hooks

The former `renderUnits()` API remains as a compatibility wrapper, so all
existing gameplay callers continue to work unchanged.

## What changed internally

- old unit-building body renamed to `renderUnitLayer()`
- orchestration moved into `renderGame`
- `renderGame` is created by `CrossroadsRefresh.create(...)`
- existing hook infrastructure is now active around complete renders
- startup diagnostic now includes `RENDER OK`

## What did not change

- combat rules
- movement rules
- camera behavior
- deployment
- scenario logic
- order flow
- visual ordering

Upload every file to the repository root and wait until the visible badge says
`Foundation 2D`.

A healthy diagnostic includes:

`DOM OK · CMD OK/SHARED · RENDER OK`
