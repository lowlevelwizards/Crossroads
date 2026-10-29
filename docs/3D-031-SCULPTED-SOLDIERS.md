# Crossroads 3D — Soldier Reconstruction v0.9.22–0.9.31

## Visual target
Compact, deliberately sculpted miniature infantry rather than mechanically joined
boxes. Preserve the smooth helmet, muted 1939 kit colors, large head/short leg
proportions and tabletop bases. Model and animation variants are cosmetic;
battle rules remain authoritative.

## Art and engineering changes
1. Custom loft and boot geometries, shaped clothes, curved straps and geometry
   caching with reliable ownership/disposal.
2. Shaped tunic, asymmetric collar, garment pockets, separate articulated
   thigh/shin meshes, soles/toes, shaped mitten hands, face and headgear.
3. IK-driven elbow/wrist grip placement, hip-to-foot constraint solving,
   stance differences and deterministic individual variation.
4. Faction-dependent Polish/German helmet and tunic details and role kits.
5. Polish rifle, Browning wz.28 bottom-feed LMG, German Kar98k and MG34,
   early German SMG, pistol and specialist weapon-grip sockets.
6. MMG tripod/mounted gun is a sibling of the falling body, with grounded
   muzzle and support-grip anchors.
7. Load-bearing pouches, body-hugging straps, bedroll, bags and canteen.
8. Standing, aim, shooting, cover, kneeling, gait, Down and casualty actions.
9. Shared classic / V2 / heroic factory contracts for the current roster.
10. Miniature Lab silhouette/body/uniform/equipped inspection, rig markers,
    closeup camera presets, directional lighting and geometry regression tests.

## Visual review still required
Automated source/pose tests do not constitute rendered-art approval. On iPhone:
- Inspect front/right/back/left/three-quarter views against the concept.
- Verify hands grip the weapon in idle, aim, recoil and crouch.
- Confirm soles ground, and knees/hips do not intersect through the base.
- Confirm Polish/German gun identity, magazines and historical equipment.
- Inspect tripod mount, support crew, casualty and Down in actual battles.
- Measure draw calls and frame times with 30–40 visible soldiers.
- Verify old appearance profiles and classic fallback after cache refresh.

## Design constraints
- The heroic factory is preferred; older builders remain available as fallbacks.
- A shared factory feeds both the Miniature Lab and live battle.
- Geometry must be cached, and unshared buffers released on lab rebuild.
- No movement, cover, morale, hit chance, AI, scoring or battle-rule changes.
- Screenshot diff and mobile profiling remain an explicit follow-up quality gate.
