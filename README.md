# CROSSROADS — Gameplay 2.4C.1

Corrective hotfix for the first 2.4C build.

## Critical fix

The persistent eligibility renderer referenced two names that do not exist in
the current engine:

- `currentDie`
- `unit.used`

The actual engine uses:

- `currentFaction`
- `unit.activated`

During deployment the bad expression was short-circuited. After drawing a die,
the renderer evaluated `currentDie`, threw a ReferenceError, and stopped after
clearing the old unit elements. That is why every unit disappeared.

## Presentation corrections

- Far counters now retain quality stripes.
- Packed MMGs return to the proven triangular crew formation.
- The carried MMG silhouette is smaller and less visually disruptive.
- The extra packed tripod mark is removed.

Upload every file and wait until the badge says:

`Gameplay 2.4C.1`

Test deployment, draw a die, select a unit, and confirm eligible units remain
visible and pulse.
