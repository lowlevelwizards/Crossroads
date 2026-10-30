# Crossroads 3D v0.9.73 — One Physical Battlefield

**Authoritative source:** InfantryCore and `CrossroadsModelGeometry.models`
remain the only owners of model-base positions, firing distances, friendly
separation and movement legality. The scene never commits a per-model move.

## Position contract
- The session snapshot publishes each unit's exact model bases in tabletop
  inches as `units[].models`, including deployment and MMG state.
- The same `models` accompany a legal move preview (including shortened
  paths), while shot previews expose shooter and target model bases.
- `physical-footprints.js` converts tabletop positions to world space without
  altering coordinates and can compare physical minis to their base positions.
- Non-garrison soldiers settle onto **exactly those model bases**. Cover
  staging changes stance/looking direction, not the model's position.
- Movement ghosts show model-base positions at the legal destination.
  The 3D scene may not reject coordinator-approved movement because of
  separate cosmetic formation positions.
- Target previews use closest actual model bases rather than unit centers.
- Selection rings/tap targets continue to surround visible miniature bases.

## Garrison caveat
InfantryCore's garrison rules are **building occupancy abstraction**, not
independent model-window firing sockets. Visible window positions are still
presentation-only and are explicitly flagged `garrison-display`; a future
garrison rules migration would be required to make every individual window
an authoritative shooting point. This release does not change range, cover
saves, or LOS from an interior facade.

## Verification
- Add `?debugFootprints=1` to a battle URL to display gold rules-base rings,
  red drift tethers and audit totals. Blue rings/tethers identify deliberate
  garrison display offsets. The overlay is off by default.
- Run `node tests/run-all-node.js` and verify GitHub Actions.
- On iPhone test deployment, cover, Advance / Run / shortened movement, MMG
  deploy/pack, firefights, casualty reflow, garrison entry/exit, and replay.
- The release does **not** introduce independent soldier movement orders,
  physically traversed door/window firing legality, or procedural combat rules.
