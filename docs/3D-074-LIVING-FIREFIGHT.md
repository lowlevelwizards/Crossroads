# Crossroads 3D v0.9.74 — Living Firefight

This release integrates presentation of actual adjudicated shooting events.
InfantryCore continues to own shot counts, attack legality, range, saves,
casualties, morale and unit identities.

## a. Deterministic shot director
`weapon-presentation.schedule` expands the actual event's firing groups into
ordered, role-specific shot timestamps and physical gunners. No generic crew
models or loaders fire; each emitted shot is grounded in a rules group. The
fire presentation phase now reserves enough time for the final muzzle event.
When frames are dropped, effects are dispatched in authored order.

## b. Mechanical firearms
A shared analytic `motionAt(role,time)` supplies bounded recoil/cycle
curves; the heroic armature drives bolt, pistol slide and automatic action
without introducing extra shots. Each discharge emits from the current weapon
muzzle (or display-only garrison outlet) and moves with the posed miniature.

## c. Impacts and morale
Hit/save/casualty events produce bounded, deterministic near-model impact
effects. Casualty models receive their existing animation and eventual removal.
Pin increments drive the established suppression and defensive reactions.
Misses never create fake hit decals.

## d. Audio / rendering / skip
Procedural gunfire is emitted once at the exact corresponding muzzle event;
whole-volley audio was removed to avoid duplicate bursts. Visual effect counts
remain bounded for mobile WebGL. Skip clears delayed shots and immediately
settles any pending casualty models; reset clears all transient state.

## e. Independent Miniature Lab
Added `fire-sequence`, `burst-sequence`, and `impact-sequence`, reusing
the exact weapon motion curves in deterministic, scrub-able poses for selected
soldier archetypes. The Lab remains separate from gameplay.

## Validation
Run `node tests/run-all-node.js` and check the PR's Actions run. On iPhone
test one rifle squad, mixed squad, deployed MMG and officer firing in regular
and 2.8x modes, including SKIP, restart, casualties and Lab scrubbing. No
browser-based real-device/WebGL playtest is asserted by Node CI alone.
