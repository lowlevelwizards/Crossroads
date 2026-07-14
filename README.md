# CROSSROADS — Foundation 2C.1

## DOM consolidation

This pass centralizes 71 existing DOM references into one frozen
`DOM` object while preserving every old variable name as a compatibility alias.

Example:

```js
const DOM = Object.freeze({
  battlefield: document.getElementById("battlefield")
});

const battlefield = DOM.battlefield;
```

## Diagnostics

Startup diagnostics now include DOM health:

- `DOM OK` — every required cached element was found
- `DOM MISS` — one or more cached elements were missing

The exact missing keys are also available in:

```js
window.CROSSROADS_STARTUP_DIAGNOSTIC.domMissing
```

No event bindings, gameplay rules, camera logic, rendering, deployment, or
startup order were intentionally changed.

Upload every file to the repository root and wait until the badge says
`Foundation 2C.1`.
