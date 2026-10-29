# Crossroads 3D — Soldier Foundation / v0.9.12

Development implementation pass for the ten-direction roadmap after the
standalone Miniature Lab launch. This is an incremental upgrade, **not** a claim
that every direction is fully realized.

## User-visible work

1. Miniature Lab has adjustable head, body, boot, and pack proportions;
   existing paint presets are shared with battle miniatures, keyed by
   kit / unit type / soldier index. All data is cosmetic and stored locally.
   Individual pigment materials no longer recolor other soldiers.
2. Shared studio/battle action library: walk, run, Down, aim, cover, pinned,
   rally, shooting, gun deploy/pack, casualty. Studio adds timeline scrubbing,
   slow motion, six hip/knee/ankle markers, and wireframe inspections.
3. Distance-driven planted stance foot compensation for movement. Swing toes
   lift and reach; feet do not jog in place after the movement stops.
4. Rough terrain modifies the visual gait; existing physical walls/hedges
   trigger crossing-specific step-up. Rule distances and terrain cost remain
   solely in InfantryCore.
5. Fire previews expose per-shot dice probability and estimated hits before
   damage and cover saves; original coordinator rolls and outcomes unchanged.
6. Garrison placements use actual farmhouse and cottage window mesh positions,
   with corresponding shooter muzzle outlets and roof transparency. Barn and
   custom facade sockets still use their existing fallbacks.
7. Machine gun mount/tripod visibly differ from carried gear, with a
   physical deploy/pack transition from authoritative unit state.
8. Down poses lean forward and low; officers visibly gesture during Snap to
   Action, while suppression continues to affect posture.
9. Optional solo AI decision inspector: append \`&ai-debug=1\` to the
   battle URL. Shows legal-choice rationale and movement score components.
10. Optional full-match QA audit: append \`&benchmark=1\` to a game URL.
    It tracks deployment, movement, fire, pins, casualties, objectives,
    rounds and victory without changing battle state.

## Focused playtest

Open \`battle3d.html?scenario=hold_the_farm&solo=1&benchmark=1&ai-debug=1\`.
Inspect a rifle squad crossing a wall/woods, MMG establishment, occupied
windows, cover saves, down posture, objective scoring and AI command choices.
Use \`miniature-studio.html\` to vary a Polish/German rifleman's proportions
and confirm the same model appears in a new battle.

## Boundaries / next iteration

- Physical foot stance is deterministic in model space and still needs visual
  device QA for leg reach, long strides and uneven geometry.
- Exact window sockets are implemented for farmhouse/cottage assets; not all
  authored barns or future buildings.
- The pose library is shared, but event-specific aiming, muzzle, reload and
  assault timing still needs further synchronizing with authoritative events.
- Miniature Lab exposes proportion/palette controls and joint guides,
  **not** a fully editable arbitrary-mesh point/vertex modeling workbench.
- The solo AI remains heuristic; inspector scores explain its decisions,
  but strategic multi-turn coordination is not complete.
- A complete Third Edition weapon/rules and scenario audit is separate work.
- Browser / iPhone WebGL visual QA is outstanding; node regressions alone
  cannot establish image quality, tactile controls, or a fun full match.

## Validation

Run \`node tests/run-all-node.js\`. Every 3D app page uses the
\`0.9.12\` asset token; the original 2D rules stay authoritative.
