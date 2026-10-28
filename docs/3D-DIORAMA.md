# Crossroads — Living Tabletop, Study 01

A non-playable 3D scene experiment in the Crossroads repository.

## Open

Serve this repository as a static website (GitHub Pages or a local static
server) and open **diorama.html**. The 2D game remains at **index.html**.
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
