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
  Remaining battle coordinator: runtime state, turn flow, rule commitment,
  deployment, scoring, reports, adaptive UI, and bootstrap.

src/infrastructure/
  Shared browser helpers and startup validation.

src/rules/movement.js
  Pure movement legality, terrain cost, collision, and allowance fitting.

src/rules/morale.js
  Pure officer-support lookup, Order Test targets and outcomes, Rally outcomes,
  and incoming-Pin routing analysis. It does not mutate units, render, log, or
  update statistics.

src/rules/shooting.js
  Pure fire-group availability, range, MMG arcs, LOS, cover, hit targets, damage
  rolls, cover saves, and casualty-count calculation. Incoming Pins are
  interpreted by the morale module rather than by shooting itself.

src/rules/shooting-integration.js
  Foundation 4B.1 integration seam for pure morale and shooting callbacks. It
  keeps logs, statistics, state mutation, effects, outcomes, and activation flow
  in engine.js.

src/rules/assault.js
  Pure charge legality, reaction-fire eligibility, Defensive Position analysis,
  assault dice order, combat rounds, casualties, and winner calculation. It does
  not mutate units, move winners, occupy buildings, render, log, or update stats.

src/rules/assault-integration.js
  Foundation 4B.2 integration seam. It installs pure assault analysis and
  close-combat resolution before the renderer captures target callbacks, while
  leaving reaction-fire coordination and state commitment in engine.js.

src/rules/terrain-geometry.js
  Normalized terrain instances, authored building doorway anchors, rotation-aware
  entry points, and approach-marker geometry.

src/presentation/
  Battlefield, unit, miniature, terrain, building, overlay, targeting, and effect
  presentation. Presentation reads current truth and does not resolve combat.

tests/combat-rules.html
  Combined browser dashboard for deterministic shooting, morale, and assault
  tests.

tests/run-combat-rules-node.js
  Runs shooting, morale, assault, integration, and architecture checks from Node.

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
8. One subsystem extraction or behavior change per foundation stage.
9. Random rule resolution accepts injected dice so it can be characterized
   deterministically.
10. A rule result describes intended state changes; the engine remains the only
    owner of runtime mutation until the state layer is deliberately extracted.

## Foundation 4B.1 morale boundary

The pure morale module owns:

- finding a friendly officer within the 6-inch command radius
- excluding officers from receiving officer support
- the +1 command Morale bonus
- deciding whether an Order Test is required
- Rally ignoring Pin penalties
- Order Test target calculation and 2-to-11 clamping
- 2d6 pass/fail calculation
- the described one-Pin removal after an ordinary passed test
- the described all-Pin removal after a successful Rally
- the described Down state after a failed test
- deciding whether newly received Pins reach the unit's Morale and cause routing

The engine still owns:

- deciding when an order becomes committed
- preserving reversible Fire targeting until a legal target is confirmed
- supplying dice
- transaction locking
- combat and morale logs
- Order Test and battle statistics
- mutating Pins, Down, activated, order, and outcome state
- Rally presentation effects and final Pin clearing
- finishing or continuing the activation

## Foundation 4B.1 shooting boundary

The pure shooting module owns:

- legal fire groups and weapon range
- moving and fixed-weapon restrictions
- MMG crew output and firing arcs
- building and terrain LOS
- woods, walls, Down, and occupied-building cover
- per-weapon hit targets
- hit, damage, save, and casualty-count calculation
- requesting incoming-Pin interpretation from morale

The engine still owns:

- target selection and action flow
- dice presentation and combat logs
- battle statistics
- Pin and casualty mutation
- casualty-order weapon removal
- MMG undeployment after crew loss
- unit outcomes and building reconciliation
- effects, rendering, and activation completion


## Foundation 4B.2 assault boundary

The pure assault module owns:

- legal charge distance and path analysis
- building assaults targeting the authored doorway
- normal and Ambush reaction-fire eligibility
- woods, walls, Down, and building Defensive Position analysis
- defender-first versus simultaneous combat sequencing
- attacker and defender dice counts and quality-based damage targets
- tied combat rounds and the existing 30-round survivor fallback
- casualty counts, mutual destruction, and winner calculation
- describing loser cleanup without applying it

The engine still owns:

- declaring the assault and consuming Ambush
- resolving reaction fire through the shooting module
- supplying close-combat dice
- transaction locking and combat logs
- applying casualties and casualty-order weapon removal
- destruction records and battle statistics
- moving the winner and finding a safe final position
- clearing and occupying buildings
- announcements, effects, rendering, and activation completion

## Runtime integration status

Foundation 4B.2 has one active runtime calculation path for shooting, morale,
and assault. The ordered integration seams replace coordinator callbacks before
player input can invoke them. The original coordinator declarations remain
physically present as dormant rollback code in this changed-files test stage;
they are not the active runtime path.

After player parity testing, the dormant shooting, morale, and assault
declarations can be removed from `engine.js` in one mechanical cleanup with no
rule or UI changes.

## Current known boundary leaks

- `presentation/battlefield.js` still derives target classes and binds unit input.
- `engine.js` still physically contains dormant pre-extraction shooting, morale,
  and assault declarations during the rollback-safe test stage.
- `engine.js` still owns assault commitment, scenarios, reports, and mobile UI.
- `styles/main.css` remains a cascade-preserving stylesheet monolith.
- Medium and close unit views currently duplicate formation markup.
- Visual edge containment is not yet implemented.

## Next likely foundation work

1. Player-test Foundation 4B.2 across open-ground, terrain, building, Ambush, and
   reaction-fire assaults.
2. Remove dormant shooting, morale, and assault declarations from `engine.js` in
   one mechanical combat-foundation lock.
3. Build Mokra M1 using the stabilized infantry core.
4. Add only the support weapon that Mokra playtesting proves is needed first.
5. Extract runtime state and app coordination only when player-facing work proves
   the need.
