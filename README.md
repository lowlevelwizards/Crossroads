# CROSSROADS — Foundation 2E

## Building prototype integration

This pass keeps the existing farmhouse gameplay but removes its late function
replacement wrappers.

### Explicit integrations

- `restartBattle()` now clears invalid occupancy directly.
- `orderAvailability()` directly blocks Run, Advance, and Assault while inside.
- desktop Enter/Exit uses the shared `buildingCommand()`.
- mobile Enter/Exit uses the same shared `buildingCommand()`.
- `renderBuildingState()` remains part of the Foundation 2D render coordinator.
- startup diagnostics include `BLDG OK:<occupant>`.

### Removed

- `restartBattle = function restartBattleWithBuildings(...)`
- `updateAdaptiveUI = function updateAdaptiveUIWithBuildings(...)`
- `orderAvailability = function orderAvailabilityWithBuildings(...)`

### Gameplay intentionally unchanged

- one farmhouse occupant
- Enter/Exit consumes an Advance-style activation
- occupant renders as a compact counter
- enemy occupancy blocks entry
- Run, Advance, and Assault require exiting first

Upload every file to the repository root. Wait until the badge says
`Foundation 2E`.

A healthy diagnostic includes:

`DOM OK · CMD OK/SHARED · RENDER OK · BLDG OK:none`

Recommended test:

1. Restart both scenarios and confirm occupancy resets.
2. Deploy a unit near the farmhouse door.
3. Confirm Enter Farmhouse appears on desktop and phone.
4. Enter, then confirm Exit Farmhouse appears.
5. Confirm Run, Advance, and Assault are unavailable while inside.
6. Fire or Rally from inside.
7. Restart and verify the farmhouse is empty.
