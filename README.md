# CROSSROADS — Foundation 2E.1

## Why Enter/Exit did not appear

The first integrated building command only appeared when a unit was within
3.5 inches of the farmhouse door. Because the building footprint blocks normal
movement, tapping or running directly into the farmhouse correctly showed red,
but gave no clear way to enter it.

## Fix

- Farmhouse entry now uses a legal exterior approach point.
- Entry availability uses the existing Advance movement path rules.
- `Enter Farmhouse` appears when the selected unit can legally Advance to the
  doorway in the current activation.
- The mobile tray and desktop button use the same command.
- Entering stores the doorway approach as the unit's later exit point.
- Running directly into the building footprint remains invalid by design.

## Test

1. Wait for `Foundation 2E.1`.
2. Move a unit within one legal Advance of the farmhouse doorway.
3. On its next order die, select the unit.
4. `Enter Farmhouse` should appear in the mobile tray.
5. Tap it; the unit should occupy the farmhouse.
6. On a later activation, `Exit Farmhouse` should appear.

Upload every file to the repository root.
