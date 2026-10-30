# Crossroads 3D v0.9.72 — Living Battlefield integration

This is a **first implementation slice**, not completion of all ten requested
build directions. The original InfantryCore session still owns the dice,
orders, model legality, movement, LOS, cover, scoring, and casualties.

## Implemented
- Stabilize degenerate two-bone IK, bound stride/lift targets, and constrain
  cross-body elbows outside the torso in the shared heroic rig.
- Expose cosmetic formation deviation diagnostics for a later full
  authoritative model-base reconciliation.
- Prefer cover between the known threat and the unit; do not cosmetically
  label wrong-side cover as protective.
- Verify authored garrison window sockets, deterministic ordering, deeper
  second ranks, and safe fallback muzzle locations.
- Individually time assault contact and bracing poses.
- Add objective assignments to the deterministic solo AI on each round;
  every command still goes through legal coordinator previews.
- Improve shot recovery timing while keeping the authoritative dice unchanged.
- Two compact 3-vs-3 authored skirmish scenarios (Patrol Clash and Farm Raid),
  plus a dedicated mobile Quick Skirmish launcher and fresh asset cache tokens.
- New regression tests for these changed systems.

## Explicit future work
- Full model-position unification for combat and movement: diagnostics are
  not a new source of rules truth.
- Full planted-foot gait and iPhone replay/animation acceptance.
- Detailed role-specific firing, reload, impact, gun-crew and morale effects.
- Building traversal, complete close-combat choreography, exact LOS sockets.
- Strategic AI match simulation and calibration.
- Validated editor-to-rules import, custom force selection, procedural map
  generation and AI difficulty levels.

## Validation
Run `node tests/run-all-node.js` and verify GitHub Actions. On iPhone, test
`skirmish.html`, `miniature-studio.html` and
`battle3d.html?scenario=patrol_clash&solo=1&benchmark=1&ai-debug=1`.
Compare cover saves to physical positions, inspect soldier knees/elbows,
weapon firing and replay motion over a complete battle.
