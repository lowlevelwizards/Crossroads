# Crossroads Architecture

## Current foundation

Crossroads is a browser game hosted through GitHub Pages. It uses ordered classic
scripts rather than a build tool or package manager so the project remains easy
to upload and test from a phone.

The primary flow is:

```text
data → rules/state → presentation
         ↑            ↓
       input ← camera/coordinates
```

## Repository ownership

```text
index.html
  Semantic application structure and ordered script loading.

styles/main.css
  Current historical stylesheet. It remains in one file until visual behavior
  is stable enough to split without changing cascade order.

data/
  Static definitions, build metadata, and authored unit formations. These files
  are authoritative. The engine must not contain fallback copies.

src/engine.js
  Remaining battle coordinator: runtime state, turn flow, combat commitment,
  deployment, scoring, reports, adaptive UI, and bootstrap.

src/infrastructure/
  Shared browser helpers and startup validation.

data/formations.js
  Canonical unit formation slots and medium-zoom abbreviations.

src/presentation/units.js
  Pure unit markup, labels, packed/deployed MMG views, and formation assembly.

src/presentation/buildings.js
  The six reusable SVG building shapes and twelve material appearances. It owns
  building artwork only; occupancy and rules remain elsewhere.

src/presentation/terrain.js
  Generic terrain-instance DOM creation. Building instances delegate their art
  to the building presentation module.

src/presentation/battlefield.js
  Unit-layer DOM rendering, visual state classes, and current unit event binding.

src/camera/camera.js
  Camera state, fit, zoom, rotation, surface sizing, centering, and framing.

src/camera/coordinates.js
  Conversion between browser coordinates, battlefield pixels, and table inches.

src/input/camera-input.js
  Mouse and touch camera gestures.

src/input/battlefield-input.js
  Battlefield DOM event binding.

src/rules/movement.js
  Pure movement legality, terrain cost, collision, and allowance fitting.

src/rules/terrain-geometry.js
  Normalized terrain instances, authored building doorway anchors, rotation-aware
  entry points, and approach-marker geometry.

tests/startup-smoke.html
  Loads the modular shell without starting the battle engine and reports missing
  globals or broken script references.
```

## Architectural rules

1. Data files describe things; they do not manipulate DOM or battle state.
2. Rule modules calculate results; they do not render, log, or commit state.
3. Presentation modules render current truth; they do not resolve combat.
4. Input modules translate browser events into calls; they do not own rules.
5. Camera modules own view transforms; gameplay coordinates remain table-space.
6. `engine.js` coordinates modules and commits state while it is gradually reduced.
7. Do not add silent fallback copies of external data.
8. One subsystem extraction or behavior change per foundation commit.
9. Building geometry and building appearance are separate registries; new colors
   must not duplicate a shape implementation.

## Current known boundary leaks

- `presentation/battlefield.js` still derives target legality and binds unit input.
- `engine.js` still owns shooting, assault, morale, scenarios, reports, and mobile UI.
- `styles/main.css` remains a cascade-preserving stylesheet monolith.
- Medium and close unit views currently duplicate formation markup.
- Visual edge containment is not yet implemented.

## Next likely foundation work

1. Shooting analysis and resolution extraction.
2. Assault and morale extraction.
3. Runtime state and app coordinator.
4. Presentation/input boundary cleanup.
5. CSS split only after visual behavior stabilizes.
