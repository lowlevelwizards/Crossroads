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


## v0.4 — Stages 0–8: Data-driven 3D battlefields

- **Stage 0:** The prior v0.3.1 study is preserved at `diorama-study.html`,
  continuing to use its original `src/diorama/diorama.js`. The public Play
  route launches `diorama.html` for the authored version.
- **Stage 1:** `src/diorama/scenario-adapter.js` loads the live scenario
  registry and `CrossroadsTerrainGeometry.setActiveScenario`. Authoritative
  normalized *rules* footprints remain distinct from 2D visual rectangles.
- **Stage 2:** Roads and their surface/ruts are placed from both actual
  `road_straight` instances, instead of the handmade diagonal path.
- **Stage 3:** Wall length, center and full crossing footprint derive directly
  from both normalized wall entries; the old decorative gate is gone.
- **Stage 4:** A farmhouse and a distinct timber barn are scaled and positioned
  using normalized solid building footprints. Appearance metadata selects
  material colors; no independent collision rectangles are created.
- **Stage 5:** Deterministically seeded faceted woodland trees and shrubs fill
  each authored woods footprint, with a ground surface. Reusable field stalk
  rendering supports other scenarios that have crop fields.
- **Stage 6:** All eight *Hold the Farm* units spawn at their exact authored
  coordinates: 34 miniatures in all, with the correct 1939 kits, soldier counts,
  roles and distinct three-person MMG crews.
- **Stage 7:** The original pure `CrossroadsMovementRules` module receives the
  exact normalized terrain instances shared with the new renderer, so legal
  movement respects 6-inch Advance, wall costs, rough woods, impassable
  buildings, the table edge and the existing unit-separation rule.
- **Stage 8:** The authored Farm Yard objective is rendered as a painted ring
  and flag, and `?debugTerrain=1` adds opt-in wireframe rules footprints and
  console diagnostics, hidden in ordinary play.

The standalone page can also display the simpler *Take the Crossroads* scenario
via `diorama.html?scenario=take_the_crossroads`. This is a visual/Advance
movement preview, not player deployment or the full battle coordinator.
The original handcrafted reference remains at `diorama-study.html`.

### Validation

`tests/3d-scenario-smoke.html` checks scenario objects, unit positions,
34 soldier roles, building footprint normalization, exact wall crossing
cost, woods movement multiplier and second-scenario adapter support.

### Still future work

Full battle state/turns, randomized order dice, shooting and cover,
morale, casualties, assaults, building occupancy, objective scoring,
victory, editor scenario handoff, and 3D renderers for editor-authored
`linearTerrain`, `terrainPatches`, junctions and crossings. This stage
preserves the 2D game and its authoritative rules modules.


## v0.4.1 — model proportions and physical scale

The authored long farmhouse is rebuilt as six discrete architectural bays with
human-scale doors and windows and real pitched roof panels. Its 13.6 x 3.76 in
rules footprint stays unchanged. Painted stone walls are now roughly 0.72
model inches thick and 1.22 inches tall inside the original larger 2.5-inch
crossing rule zone: full-thickness slab geometry was removed. Both model
families read measurements from `src/diorama/scale-spec.js`; physical game
units remain 0.30 Three.js world units per inch. The former v0.4 production
scene and page were preserved at `diorama-v040.html` and
`src/diorama/scenario-scene-v040.js` for before/after review.


## v0.5 experimental battle session (in development)

In v0.5.0 the production homepage stayed on the v0.4.1 battlefield while
`battle3d.html` exposed a separate, experimental client of the original
2D `InfantryCore.session` coordinator.

The same-origin `classic-session.html` hosts the original engine with 2D
presentation effects disabled to avoid waste and animation stalls in an
invisible frame. Only the coordinator controls die drawing, eligibility,
selection, order commitment, movement, LOS/shooting, morale, reactions,
assault, objectives and victory. An immutable read-model snapshot and
validated command dispatch are exported from the original `src/engine.js`.
The 3D scene watches that session and animates results, not decisions.

The battle client supplies a contextual order tray for draw/selection/orders,
move, fire, assault, reaction, score round, cancel and restart. Read-only
state projection updates figures and casualties. Mobile pan/orbit remain.
This is an *experimental integration*, not certified complete playability;
it needs a full iOS/WebGL browser playtest. In particular, hidden-frame
compatibility and extended activation sequences require live validation.

Open `tests/3d-session-smoke.html` for browser-based coordinator integration
checks and `tests/3d-scale-smoke.html` for model dimensions.


## v0.5.1 — Battle promoted to Play (October 2026)

The normal GitHub Pages homepage (`index.html`) now routes PLAY directly to
`battle3d.html`, the existing authoritative battle-session client. This
changes the public entry point **only**; it does not create a second rules
engine or alter the existing battle coordinator. The previous data-driven
scenery/movement-only scene is preserved at `diorama.html`, the original
handcrafted reference at `diorama-study.html`, and the legacy 2D game at
`classic.html`. The release integrity regression test enforces the new
entry point and the presence of its engine host/client dependencies.

Known work for the next milestones: mobile animation hitch profiling,
selection and camera focus, visible order dice and turn-draw presentation,
fire/cover/pin/casualty state feedback, contextual status, and battle-end
presentation. These were deliberately not bundled into the routing change.


## Crossroads 3D v0.6.0 — Command & Clarity

This is the default Play experience. `battle3d.html` still runs the
authoritative `InfantryCore.session` behind a 3D presentation client; the
earlier 3D scene remains available at `diorama.html`.

### Presentation
- A subtle faction-colored die appears during an active activation, with a
  compact bag/dice count, Polish/German scores and round progress.
- The selected squad has contextual identity/strength/pin status. Eligible
  units receive a separate physical ring, and ordered/activated squads show
  a small order token beside their bases.
- Pins are represented by physically stacked basing tokens and a readable
  count. Casualties and unit destruction are reflected in living soldier
  counts, brief visual effects, and an event history derived from the
  **original engine's actual battleLogEntries**, never fabricated rolls.
- Distinct muzzle and recoil responses for rifles, SMGs and MMGs (with
  crew/loaders excluded). Objective marker tint comes from the canonical
  scenario-runtime evaluator.
- The command overlay displays only legal orders and the current
  action phase. Movement and shooting still require a reversible preview
  and a second tap to confirm. Last-round scores, casualty and losses
  summary are taken from the authoritative battle statistics.
- A compact, collapsible log shows the 16 most recent actual engine messages,
  including order failures, pins, Ambush and scenario-scoring events.

### Camera and performance
- The camera eases to a newly selected unit, optionally closes the framing
  to 1.85×, and never resets the orbit angle. A manual pointer gesture,
  wheel zoom or arrow-key orbit cancels auto-focus.
- The hidden 2D coordinator skips expensive, invisible DOM miniature rendering
  and log-node creation only when `CROSSROADS_3D_SESSION_HOST` is set; the
  2D classic page remains unchanged.
- Miniature height samples are cached in a bounded grid, sampled per walking
  soldier no more than once every three rendered frames, and always refreshed
  at arrival. Miniature labels are projected at 15 Hz rather than 60 Hz.
- The 3D client polls the original coordinator at 250ms to capture delayed
  reactions, but suppresses scene notifications and DOM rebuilds when the
  relevant battle state has not changed.
- `battle3d.html?perf3d=1` enables a 3-second moving performance summary
  in the browser console (approximate frame cost, render calls, ground rays).

### Fallbacks and caveats
- `battle3d-v051.html` preserves the previous v0.5.1 battle interface and
  scene scripts for A/B comparison (sharing the latest compatible engine
  coordinator). `diorama.html` preserves the independent movement study,
  while `classic.html` remains the complete 2D presentation.
- Syntax, scenario-data, simulated host UI interaction and simulated WebGL
  initialization checks were performed. **Real iOS WebGL frame pacing,
  combat outcome timing and full-turn AAR still need on-device verification.**


## v0.6.1 — Tabletop Interaction and Motion Fixes

**Orbit:** The orthographic camera now always orbits around the global board
center. Selection focus and two-finger panning shift the orthographic frustum
while keeping the orbit pivot fixed. The player can still interrupt focus with
a drag, wheel, pinch or keyboard command. Auto-focus uses a smaller 1.5x zoom.

**Labels:** Only the selected unit has a contextual nameplate, and only while
choosing its order, plotting a move, or targeting at a useful zoom. Names for
eligible, activated, pinned or lost units no longer cover the scene. The one
visible label is anchored to its moving base and projected every frame, so
rotation or movement cannot leave a 15Hz label trailing across the sky.

**Soldier motion:** No passive breathing/bob animations at rest. Soldiers
settle into their final authored formation slots. Individual steps taper near
the end of each soldier's motion. Visual Run animations travel approximately
70% faster than before (from 0.8 to 1.42 model units/second) with a slower,
larger vertical gait cadence. Logical rules allowances remain unchanged.

**Selection/order markers:** Thicker gold selection rings and a
terrain-following gold movement ruler replace thin pale lines. Eligible rings
use distinct teal (Poland) and rust (Germany) colors. Used dice only appear
after an order activates/finishes; they are hidden during movement, rather than
dragged behind a traveling formation.

**Controls and die presentation:** Polish/German scores and order dice have
distinct palettes. A drawn die makes a large, brief physical reveal and
selection rings pulse when a unit is chosen. The command tray is narrower,
scrolls horizontally as needed, and the event summary fades into a small log
button instead of occupying a persistent full-width HUD strip.

**Validation:** `tests/3d-v061-interaction-smoke.html` checks key visual
contracts and the deterministic gait settings. Actual iPhone WebGL and
firing/pinning play still warrant hands-on verification.

**Rollback:** `battle3d-v060.html` retains the prior 3D renderer, motion
module, UI scripts and CSS (still using the shared authoritative coordinator).

## v0.7 — Living Firefight prototype

The original combat runtime emits bounded, sequenced shooting, Order Test and
assault events, including exact dice, modifiers, hits, cover, Pins, casualties
and defeat. The 3D client uses a deduplicating event timeline to present
aiming, muzzle response, dice, impacts and suppression without rerolling.
A temporary dice tray renders the real hit, damage and cover-save rolls.
The player may opt into procedural weapon audio using the ♪ control.

Building roofs become transparent when occupied. Targeting uses a thick,
color-coded firing indicator. `scenarios3d.html` provides an authored scenario
selection route. `?solo=1` enables an **experimental** German AI opponent,
operating exclusively through the normal legal command/preview API.
This AI is intentionally conservative, not a complete tactical opponent.

The public Play button still opens Hold the Farm. Previous v0.6.1 presentation
files are archived at `battle3d-v061.html`; legacy 2D and movement study
remain available.

This release does not claim completion of every phase of the longer roadmap.
Detailed casualty transitions, advanced assault choreography, building entry
animations, optimized solo AI, robust audio spatialization, complete scenario
coverage and actual iPhone performance validation need further iterations.


## 3D v0.7.2 — Battlefield Depth

This is an iterative pass across the remaining ten gameplay/presentation
priorities, NOT a claim of full v1.0 feature completion. The original rules
engine continues to resolve all orders, rolls, movement and losses.

* Firefights now animate individually staggered aim and capped shot bursts.
  Actual hit, damage and cover-save dice play in distinct presentation steps.
  Muzzle effects are capped for mobile performance.
* Structured Ambush interruptions/Fire/Hold choices and objective-round scores
  are emitted from the original coordinator and projected by the 3D director.
  Assaults receive a modest visible charge impulse; the underlying 2D rules
  still decide defensive fire, casualties and any position changes.
* Target previews reveal real permitted weapon group shots, hit thresholds,
  range and cover save. Occupied buildings have tinted physical garrison
  markers alongside their translucent roofs.
* Procedural shot stereo panning now responds to camera orbit and pan.
* The scenario picker presents the real force roster, objectives, victory
  conditions and deployment style for authored scenarios.
* Experimental Solo now uses pure deterministic objective/enemy utility scoring
  for unit selection, target selection, and candidate legal movement points.
  It still sends only original rules-validated commands.

Known work: real on-device WebGL performance and full-session testing; full
close-assault animation and individual door/window choreography; sophisticated
cover-aware tactical AI; proper multitrack spatial sound, artillery and
vehicles. These are NOT implemented by this pass.

The previous v0.7.1 3D client, event director, audio, AI and renderer are archived
at `battle3d-v071.html`, with their own versioned front-end module copies.
