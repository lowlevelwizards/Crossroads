# Crossroads 3D — Roadmap continuation (0.9.10 preview)

Build on v0.9.9 and maintain the original InfantryCore game as sole rules authority.

Implemented in this review branch:
- **Rules/terrain:** +2 point-blank To Hit at 6" or closer; Down's cover
  bonus ignored at point-blank (real terrain still protects); crossing
  hedges use their soft-cover label; fixed-team shooting now displays the
  coordinator's hit target and modifier list in 3D target previews.
- **Garrisons:** deterministic facade/window-side miniature slots and shot
  outlet placement, selected occupant sector overlays and translucent roofs.
  Building entry legality and line of sight remain governed by InfantryCore.
- **MMGs:** visual sector follows actual engine mmgFacing/deployed flag;
  legal 45° traverse exposed to solo AI via the same authoritative command
  path; AI can establish fire, traverse, and choose buildings.
- **Tactical AI:** smarter officer activation near pinned allies, command
  radius coverage, public authored hard/soft cover used for endpoint choice,
  exposure avoidance, support weapon holding and establishment.
- **Physical miniature motion:** two-bone planar leg IK, stable stance/boot
  placement and crossing-specific visual step-up without cumulative lift.
- **Miniature Lab:** new inspection poses, per-model isolation and more paint
  options (helmet and leather finishes).

Validation: \`node tests/run-all-node.js\`; Browser WebGL/iPhone visual QA is
still needed, especially roof/window alignment and procedural leg geometry.
The battle client and classic-session host now use fresh cache keys.

Boundaries: a complete Third Edition errata-by-errata revalidation of every
weapon, ability and special rule has **not** been completed. Interior models
and arcs are visual, not a new shooting/LOS authority. Building windows are
facade approximations rather than precisely registered with every custom
building mesh. This remains an incremental review PR, not a finished 3D 1.0.
