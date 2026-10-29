# Crossroads 3D v0.9.5–0.9.9 — review preview

This branch implements a **playable first slice** of the five-version roadmap,
not every feature of the original acceptance plan. The existing InfantryCore
coordinator still owns movement legality, terrain costs, all attacks, morale,
dice, building occupancy and objective scoring. New visuals cannot invent legal
shots or resolve rules.

## Implemented in this branch

- **0.9.5 — Physical movement:** slower distance-driven step cadence,
  alternating stance/swing and boot lift, larger run animation, faster Run
  presentation, stable no-idle-bob stop, and a forward Down lean.
- **0.9.6 — Rules visibility:** target preview now reports the *actual*
  coordinator's distance, weapon groups, hit thresholds and cover save
  where available. No new rules table is guessed.
- **0.9.7 — Support weapons:** a subtle selected 90° machine-gun/team
  facing guide aligned to the gunner. Guide is presentation only;
  the coordinator's own shot legality remains decisive. Existing
  building/roof cutaways and garrison muzzle positioning are retained.
- **0.9.8 — Tactical AI:** support teams favor Ambush while holding an
  objective, reduce long unsupported moves, and avoid pressing into
  close threats when already pinned. All orders still require legal
  coordinator previews and commands.
- **0.9.9 — Miniature Lab:** an in-battle per-unit/per-soldier workshop:
  touch-friendly selection, close-up camera focus, uniform palettes,
  optional headwear/pack, reset and browser-local cosmetic persistence.
  The lab cannot change weapons, unit characteristics or game logic.

## Not yet implemented from the complete plan

Per-foot IK and obstacle step-over, complete casualty/prone model rigs,
full 2026 rules/errata re-audit, every hard/soft cover and LOS behavior,
individual interior window sockets, engine-authoritative fixed firing arcs,
officer coordination and fully cover-aware AI, and a separate dedicated
miniature lab scene. This preview should not be labeled a finished 0.9.9
rules/gameplay release until those are complete.

## Test and review

Run \`node tests/run-all-node.js\`, then play a live 3D battle with a
machine gun, building, Run and Down orders, target preview and Miniature Lab.
Real iPhone/WebGL interaction and performance require manual testing.
