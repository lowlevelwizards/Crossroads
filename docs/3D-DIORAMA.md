# Crossroads — Living Tabletop, Study 01

A 3D movement-study scene in the Crossroads repository.

## Open

On GitHub Pages, open **/** (the normal site homepage) and choose **PLAY**.
The main menu launches **diorama.html** directly with no scenario selector.
The old full 2D game is retained, unlinked, at **classic.html**, and the
terrain editor remains unchanged at **editor.html**. No 2D scripts load
behind the public homepage.
Three.js is loaded as a pinned ESM module from jsDelivr, with an unpkg
fallback; an internet connection is needed when first loading the scene.
Requires a browser with WebGL support.

## Controls

- Drag left/right (mouse or one finger): orbit around the scene horizontally.
- Mouse wheel / two-finger pinch: orthographic zoom.
- Keyboard left/right arrows: orbit in steps; +/-: zoom.
- Keyboard 0 or Home: reset the starting three-quarter isometric camera.
- The view contains no controls or captions, just a small version number.

## Deliberate boundaries

This first study is **visual only**: no selection, orders, game rules, movement,
unit logic, line of sight, or scenario import. Breathing is a subtle decorative
idle motion, not a gameplay update.

The self-contained files are diorama.html and src/diorama/*. On-screen controls
and explanatory text were removed after Study 01 to keep the view uncluttered.
Existing data,
rules, editor, scenario flow, and 2D presentation are not modified.

## Next integration pass

Agree on miniature scale, camera framing, and terrain aesthetics first. Then
build a coordinate adapter between the existing table dimensions and a 3D
world, and a scene renderer driven by canonical unit and terrain data. Do not
duplicate or rewrite the battle rules in the 3D scene.

## 3D movement study v0.2.0

The study's physical battlefield is **72 x 48 inches (6 x 4 feet)**,
projected as 21.6 x 14.4 Three.js world units, at 0.30 units/inch.
The wooden rim extends outside the logical playing surface. All movement
coordinates and distances remain in inches.

The single six-person squad is constructed using the **live** `hold_the_farm`
Polish rifle squad record for identity, quality and kit, the shared
`CROSSROADS_UNIT_TYPES.rifleSquad` weapons/size, the shared
`CROSSROADS_FORMATIONS.line` arrangement, and
`CrossroadsMiniaturePresentation.resolveModelRecipe` for roles.
Its starting coordinate is deliberately overridden for this standalone study;
the actual scenario definition and 2D game are not modified.

**Tap the miniature squad to select it, then tap ground to order Advance.**
The study starts with that single squad selected for convenience.
The shared `CrossroadsMovementRules.create` function validates the straight
route and cost against the study's building and wall footprints.
A destination beyond 6 inches is capped by the *same* movement allowance
fitting routine used by the 2D engine, provided the whole requested segment
does not cross an impassable obstacle. Invalid destinations do nothing.
Advancing animates the entire formation (no navigation/pathfinding yet).
A new tap-move can follow once the previous movement finishes; this is an
interaction laboratory, **not** real turn/activation commitment. There are
no enemy units, shooting, cover, victory, combat, round timers, or scene HUD.

**Limitations:** Farmhouse and stone-wall footprints match this handmade
vignette. Other decorative features remain visual-only; the full
`hold_the_farm` terrain and scenario state are **not** rendered in 3D yet.
Movement constants are matched to the 2D engine, but are not currently
exported by it as a public settings module. Future full rules integration
must extract a shared authoritative rules settings source.


## Grounding, turning and model proportions — v0.2.1

- All six physical miniature bases are placed on the **highest visible**
  ground/paint patch/road mesh beneath nine footprint samples. The base
  cylinder's *bottom face* is lifted 0.009 world units above that surface,
  without disabling depth testing (so walls still occlude figures correctly).
  Footing is sampled on first render, during walking, and at landing.
- Orders have two separate animation phases: **each figure independently
  turns** toward the new movement heading on its own pivot; only after all
  six finish turning does the unchanged formation translate to its endpoint.
  The squad group never rotates, so six formation slots do not orbit around
  one another. The shared 6-inch Advance rules are unchanged.
- The original farmhouse is scaled to 66%, and its rules footprint is derived
  from its scaled foundation width/depth; stone wall height is roughly halved
  and thickness reduced, with the crossing footprint matching the new wall.
  Gateposts, fences, trees, hedges, road width, wheat and crates were reduced
  in proportion to the unchanged heroic soldier sculpt.
- Camera gestures, 72×48-inch physical board, clean HUD and shared squad data
  remain untouched.


## First platoon study — 3D v0.3.0

Four selectable units are borrowed from live Hold the Farm scenario definitions:
Polish rifle squad (6) and officer (2), German rifle squad (6) and assault squad (6).
The scenario itself is not modified; these four units have study-specific starts.
They use shared unit templates, faction kits, formation slots, and miniature recipes.

Tap any squad's miniatures to select the unit (subtle faction-colored ring), then
tap terrain to Advance. 3D movement delegates to the live movement rule module
for the 6-inch allowance, building and wall checks, and separation from all
other units (3.4 inches). One unit moves at a time for now, with independent
positions and state; this remains a sandbox, not an order-die turn system.

Distinctive equipment silhouettes now include field-grey German uniforms and
flared helmets, Polish khaki and helmets, officers' peaked caps and sidearms,
SMGs, rifles and LMGs. Grounding stays accurate for every miniature.

Each soldier independently turns before formation motion, has a subtly
different walking pace (0.925–1.075x), delayed start, stride rhythm and bob,
and settles back into its exact authored formation slot at the end of a move.
These changes do not alter the legal 6-inch game movement distance.


## Touch camera & organic movement — v0.3.1

- One finger horizontally orbits around a freely movable camera target.
- **Two fingers sliding together pan the tabletop** in any direction. Pinch
  zoom and two-finger panning happen simultaneously, keeping the point under
  the gesture's centroid anchored to the visible ground plane (Y = 0.20).
  The gesture starts from its previous two touch coordinates, preventing jumps
  when the second finger is first placed.
- Maximum zoom is now **6.75×** the fit baseline (formerly 3.35×). Mouse
  wheel zoom also anchors the tabletop beneath the cursor. Press 0/Home to
  reset yaw, zoom **and** pan to center. Camera target motion is bounded to
  the table plus a small border so the board is not lost.
- Every soldier's cosmetic walking pace now varies within **±14%** of the
  shared movement duration. Start delays, walking cycle and body bob have
  slightly wider variation; turning finish fractions now span 0.66–1.0, so
  soldiers pivot at more visibly distinct speeds before advancing.
- These are presentation timings only; the live 6-inch Advance allowance,
  unit separation, figure counts, positions, and formation convergence remain
  unchanged. No new HUD elements were added.
