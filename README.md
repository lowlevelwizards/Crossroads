# CROSSROADS — S1.1.1 / Living Infantry 3D v0.8.1

Standalone World War II miniature tabletop wargame with an authoritative
2D battle coordinator, a mobile-first 3D battlefield presentation, scenario
authoring tools, and preserved archived prototypes.

## Play
- **Play** on the homepage opens `battle3d.html` (3D v0.8.1), using the
  original `InfantryCore.session` for all movement legality, dice, combat,
  morale, objectives, and scoring.
- `scenarios3d.html` lists available authored 3D scenario entries.
- `classic.html` keeps the fully functional original 2D client.
- `editor.html` provides the scenario editor.
- `diorama.html` preserves the standalone 3D movement study.

## 3D v0.8.1 changes
Per-squad movement tracks, cosmetic individual stride variation, correct
weapon-role shot presentation, pinned-unit responses, anchored tactical fire
previews, normal/fast/skip combat presentations, assault contact gestures,
selected building garrison cutaways, scenario-relative board fit and initial
deterministic solo AI improvements.

This is a **foundation milestone**, not the full twelve-stage 3D v1.0 roadmap.
Advanced building and individual close-assault choreography, tactical AI,
3D physical dice, extensive scenario coverage, on-device benchmarks, and
full-match mobile acceptance remain ongoing work. See
`docs/3D-DIORAMA.md` for implementation boundaries and rollback paths.

## Validation
Run `node tests/run-all-node.js` for the original rules, editor, release
integrity and 3D presentation regression tests. Pull requests also run these
checks in GitHub Actions. Real iPhone/WebGL playtesting remains required.

## Historical note
The former README described the older Gameplay 2.5.3 orientation and scale
hotfix. Those 2D fixes remain part of the preserved original game client;
the top-level release identifier is now aligned with the S1.1.1 manifest.
