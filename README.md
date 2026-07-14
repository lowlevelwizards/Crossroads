# CROSSROADS — Foundation 2B.2S

Flat-root data peelaway with the terrain mutability regression fixed.

## What failed in 2B.2 / 2B.2R

`terrain.js` froze the terrain records. The existing scenario loader intentionally
updates those records with `Object.assign(...)` when Crossroads or Breakthrough
loads. That threw during `restartBattle()` before units were instantiated and
before deployment was initialized.

## This build

- Keeps `weapons.js` external and immutable.
- Keeps `unit-types.js` external and immutable.
- Keeps `terrain.js` external but mutable.
- Keeps the inline terrain fallback mutable too.
- Changes no gameplay rules.

Upload every file in this folder to the repository root.
