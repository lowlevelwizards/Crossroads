# CROSSROADS — Gameplay 2.2B

Combined building combat audit and cleanup.

## Included

- Occupancy card and farmhouse plaque remain screen-readable at any table rotation.
- Building shooting context helper:
  - firing from farmhouse window
  - target in farmhouse hard cover
  - target Down
  - Ambush fire
- Building assault feedback:
  - defender strikes first announcement when available
  - farmhouse cleared announcement when attacker takes the position
- Edge-case reconciliation:
  - destroyed/routed/empty occupants are removed from the farmhouse
  - stale building selection is cleared
  - occupancy state is reconciled after unit outcome/casualty changes
- Diagnostics now show:
  - `BLDG OK/COMBAT:<occupant>/CARD`

## Gameplay rules

This pass preserves the existing building rules rather than inventing new ones.

## Recommended test

1. Fire out of the farmhouse in multiple directions.
2. Fire into the farmhouse and verify hard-cover behavior.
3. Put the occupant Down, then fire at it.
4. Set Ambush inside and assault the building.
5. Destroy the occupant by shooting.
6. Win a building assault with one surviving attacker.
7. Restart while occupied.
8. Confirm the card stays horizontal at rotated/close table views.

Wait until the visible badge says `Gameplay 2.2B`.
