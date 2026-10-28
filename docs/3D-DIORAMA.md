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
- Arrow buttons: orbit in steps. Plus/minus buttons: zoom.
- Reset View restores the starting three-quarter isometric angle and framing.
- Keyboard left/right arrows and +/- keys also work.

## Deliberate boundaries

This first study is **visual only**: no selection, orders, game rules, movement,
unit logic, line of sight, or scenario import. Breathing is a subtle decorative
idle motion, not a gameplay update.

The self-contained files are diorama.html and src/diorama/*. Existing data,
rules, editor, scenario flow, and 2D presentation are not modified.

## Next integration pass

Agree on miniature scale, camera framing, and terrain aesthetics first. Then
build a coordinate adapter between the existing table dimensions and a 3D
world, and a scene renderer driven by canonical unit and terrain data. Do not
duplicate or rewrite the battle rules in the 3D scene.
