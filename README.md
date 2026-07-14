# CROSSROADS — Foundation 2C.3

## Shared order-command descriptions

Desktop order buttons and the mobile choose-order tray now consume the same
command factory:

- `orderCommand(unit, order, presentation)`
- `availableOrderCommands(unit, orders, presentation)`

The shared command owns:

- order id
- desktop/mobile label
- enabled state
- execution handler
- unavailable reason
- tooltip metadata

The underlying order rules remain in the existing `orderAvailability()` and
`chooseOrder()` functions. This pass does not rewrite movement, shooting,
assault, rally, Down, or Ambush behavior.

## Diagnostic

A healthy startup line includes:

`CMD OK/SHARED`

## Upload

Extract and upload every file to the repository root. Wait until the visible
badge says `Foundation 2C.3` before testing.

Recommended test:

1. Complete deployment.
2. Draw a die.
3. Select a unit.
4. Confirm desktop order buttons enable correctly.
5. On phone, confirm the same legal orders appear in the tray.
6. Test at least Run, Fire, Rally with pins, and an unavailable Assault case.
