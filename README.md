# CROSSROADS — Gameplay 2.5.1

Selection Alignment Hotfix.

## Corrected

The older UI had several simultaneous selection movements:

- the entire unit root moved upward
- the formation moved and scaled
- every soldier moved again
- the selection glow remained attached to the original unit origin

With dedicated zoom representations, those stacked transforms caused the
soldiers and selection plate to separate.

This build keeps all unit geometry fixed when selected.

- soldiers do not move
- formations do not shift or scale
- nameplates stay in place
- the selection halo is attached directly to the active formation canvas
- far counters remain centered and gain only an outline
- hover no longer nudges the formation

Upload both files and wait for `Gameplay 2.5.1`.
