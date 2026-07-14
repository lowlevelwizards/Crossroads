# CROSSROADS — Foundation 2B.3R

This correction makes versioning trustworthy.

The previous 2B.3 package had the correct version in `build-info.js`, but the
static HTML fallback still said `Foundation 2A`. The battle engine normally
replaced that at the end of startup. If startup failed or an external file was
stale, the obsolete 2A fallback remained visible.

2B.3R now:

- uses `Foundation 2B.3R` in the static HTML
- applies `build-info.js` immediately, before the battle engine
- shows `data 4/4` when weapons, terrain, unit types, and scenarios loaded
- keeps the scenario-data extraction unchanged

Upload every file to the repository root. Do not test until the visible badge
reads `Foundation 2B.3R`.
