# CROSSROADS — Foundation 2B.3T

## Remaining scenario extraction bug fixed

2B.3S removed the duplicate global declarations correctly, but one expression
inside `scenarios.js` still referred to the old local identifier:

```js
CORE_SCENARIO_12A.forces
```

After changing the export to `window.CROSSROADS_CORE_SCENARIO_12A`, that local
identifier no longer existed. `scenarios.js` therefore threw a ReferenceError
while creating the Crossroads scenario, and `window.CROSSROADS_SCENARIOS` was
never assigned.

This explains why:

- camera controls began working in 2B.3S
- units and deployment still did not initialize
- the page remained at `Loading board…`

The reference now correctly reads:

```js
window.CROSSROADS_CORE_SCENARIO_12A.forces
```

Upload every file to the repository root and wait for the badge to say
`Foundation 2B.3T`.
