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

src/rules/assault.js
  Pure charge legality, reaction-fire eligibility, Defensive Position analysis,
  assault dice order, combat rounds, casualties, and winner calculation. It does
  not mutate units, move winners, occupy buildings, render, log, or update stats.

src/rules/combat-runtime.js
  Permanent Foundation 4C installation boundary. It binds morale, shooting, and
  assault calculations to thin engine-owned commit adapters exactly once before
  battlefield callbacks are captured.

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



## Foundation 4C combat foundation lock

Foundation 4C makes the tested combat extraction the permanent active runtime
boundary.

The ordered combat bootstrap is now:

1. `src/rules/morale.js`
2. `src/rules/shooting.js`
3. `src/rules/assault.js`
4. `src/rules/combat-runtime.js`
5. startup validation
6. `src/engine.js`

`combat-runtime.js` installs the three rule factories once, immediately before
the battlefield renderer captures combat callbacks. This replaces the former
two-wrapper staging chain and removes wrapper-order dependence.

### Pure rule ownership

`morale.js` owns:

- officer support and command bonus analysis
- whether an Order Test is required
- Order Test target and dice result
- ordinary passed-test Pin removal
- Rally outcome description
- incoming-Pin routing analysis

`shooting.js` owns:

- legal fire groups and weapon range
- moving and fixed-weapon restrictions
- MMG crew output and firing arcs
- LOS and cover analysis
- per-weapon hit targets
- hit, damage, save, and casualty-count calculation
- requesting incoming-Pin interpretation from morale

`assault.js` owns:

- legal charge distance and path analysis
- doorway-based building assaults
- normal and Ambush reaction-fire eligibility
- woods, walls, Down, and building Defensive Position analysis
- defender-first and simultaneous combat sequencing
- quality-based damage targets and dice counts
- tied rounds, mutual destruction, and winner calculation

### Engine commitment ownership

The permanent runtime adapters keep these responsibilities engine-owned:

- transaction locking and dice presentation
- combat and morale logs
- battle statistics
- Pin, casualty, weapon-count, and outcome mutation
- reaction-fire coordination and Ambush consumption
- safe post-assault movement
- building clearing and occupancy
- announcements, effects, rendering, and activation completion

### Retired staging files

The runtime no longer loads:

- `src/rules/shooting-integration.js`
- `src/rules/assault-integration.js`

They may be deleted from the repository after applying this overlay. Their old
global diagnostic names remain compatibility aliases to
`CrossroadsCombatRuntime`, so existing console checks and saved test bookmarks
do not fail.

### Source-cleanup boundary

The tested T3.5 coordinator still physically contains the pre-extraction combat
function declarations. They are replaced before any renderer callback or player
action can use them, so there is one active combat authority. A future full-tree
engine cleanup may mechanically remove those unreachable declarations, but it
must not be mixed into Mokra scenario work or any rules change.

This distinction is intentional: Foundation 4C locks runtime ownership now,
without risking unrelated behavior in the 5,000-line coordinator during a
changed-files overlay release.

## Permanent combat regression suite

Run:

```text
node tests/run-combat-rules-node.js
```

Expected coverage:

- 28 shooting tests
- 20 morale tests
- 22 assault tests
- shooting/morale state-commit integration
- assault and building-capture state-commit integration
- permanent runtime ownership and load-order audit

The browser dashboard remains:

```text
tests/combat-rules.html
```

## Next highest-impact work

1. Build Mokra M1 with existing infantry, officers, MMGs, railway, woods,
   buildings, walls, Ambush, and Assault.
2. Use playtesting to tune deployment, pressure, objectives, and terrain.
3. Add only the support weapon Mokra proves is missing first.
4. Keep combat rule changes separate from scenario-content commits.

## Mokra M1 scenario extension

Mokra introduces two reusable scenario capabilities without adding scenario-id branches to combat:

- `src/rules/objectives.js` calculates ownership and scoring for grouped control points.
- `src/rules/scenario-runtime.js` adapts grouped objectives and named deployment sub-zones to the existing coordinator while preserving legacy single-objective scenarios.
- `rail_embankment` uses the existing crossing/hard-cover contract. Mokra places separate embankment segments between open railway-crossing pieces, so crossing exceptions emerge from terrain composition rather than bespoke movement code.

Scenario definitions remain pure data. New grouped-control scenarios should use `type: "control_group"`; new split deployments should put `subzones` on the normal faction zone and assign `deploymentZone` on force entries.

## Mokra M1.1 terrain contracts

Terrain now separates its visual rectangle from its authoritative rules footprint. Scenario data continues to describe the artwork size; `terrain-geometry.js` normalizes inset building footprints once, and all existing movement, deployment, LOS, occupancy, and assault consumers receive that same rules rectangle.

`terrain-polish.js` is a presentation-only decorator loaded immediately after the base terrain renderer. It owns primitive namespacing, field-row generation, and scene-depth metadata. It does not change terrain rules or scenario state.

Road, stream, and field variants remain registry data using shared renderers. New scenarios should compose those reusable pieces rather than add scenario-specific CSS or combat branches.
