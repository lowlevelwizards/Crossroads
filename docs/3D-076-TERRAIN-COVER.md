# Crossroads 3D v0.9.76 — Physical Terrain & Cover

## Scope and rules authority
Everything in this version describes physical **presentation**. InfantryCore
continues to own model-base locations, movement previews, crossing legality,
building occupancy, line of sight, cover saves, morale and attacks. Cosmetic
cover/roof/window gestures never grant legal protection, firing authority or
movement permission.

## A. Terrain contact and cover geometry
- `src/diorama/terrain-interactions.js` provides pure segment projection,
  threat-side cover detection, terrain-proximity crouches, authorized path
  intersections, traverse animations and occupied window presentation.
- Unknown threat direction or wrong-side barriers produce no fake bracing.
- Crossing events require an actual approved `plan.path`, not merely a
  straight inferred line between units or untrusted local collision guesses.

## B. Cover poses
- Low walls, hedges and fences now inform individual readable stance choices,
  weapon-ready postures and nearby protective shelter. A standing soldier
  may visibly brace; hedges favor a kneel.
- Real model positions remain untouched; interactions blend with Pin/Down,
  crew and existing ADS/recoil priorities.

## C. Movement and obstacles
- Actual approved movement paths define crossing timing. One-time computed
  segment intersections guide small body lifts and alternating foot clearance.
- Rough regions still influence gait; no extra movement allowance or hidden
  terrain collision is introduced.
- Reduced motion disables crossing embellishment; the authoritative path
  remains the same. A remote event with no published path does not invent
  a crossing.

## D. Buildings
- Existing door waypoints, roof fade, garrison window sockets and rules-level
  occupancy remain authoritative. New pure entry/exit threshold poses add
  alternating steps and ducking through the actual doorway.
- Window poses acknowledge occupied window presentation without granting
  independent per-window combat origins or cover saves.
- Roof transparency still reflects occupied buildings and selection, not an
  added interior simulation.

## E. AI and independent Lab
- AI movement evaluates defensive shelter and risk through existing
  legal `previewMove`, on top of objective priorities and support sectors.
- Miniature Lab adds braced wall, hedge kneel, three crossing types, rough
  walking, active window and door entry/exit sequences.
- Desktop and iOS battle and Lab assets use cache token 0.9.76.

## Validation
Run `node tests/run-all-node.js`. Exercise legal wall/fence moves, blocked
moves, pin interrupts, entry/exit, occupied roofs, close-up window display,
skip/restart and mobile Safari performance. Automated Node tests cannot
visually certify arm reach, rooftop clipping, or actual device frame pacing.

## Explicit deferrals
No per-window attacks, truly interior navmesh, procedural climbing of
impassable walls, or changes to rules movement/cover. These require a
separate explicit gameplay design and regression review.
