# Crossroads 3D v0.9.62 · National Soldier Sculpt Refinement

Art-only 1939 Polish/German infantry pass; gameplay and combat mechanics remain unchanged.

## Character meshes
- Separate cached continuous SDF helmet silhouettes: high forehead openings, shallow Polish wz.31 rim vs deeper German M35 nape and ear coverage.
- Normalized editable heads retaining existing saved Workbench head contour scale, two eyes and ears, faction-specific tunic lofts.
- Surface-conforming leather webbing, chest pouches and belts that respond to torso width.
- Faction-specific canvas packs and bedrolls, more compact and distinct from front/side/rear.
- Single material-banded shin meshes for Polish lower-leg wraps and German marching boot shafts instead of floating accessories.
- Slimmer SDF elbow seams and natural weaponless relaxed wrists.

## Standalone lab
- Switch canon geometry, saved local overrides, or side-by-side canon vs local; local edits remain untouched.
- Polish vs Germany comparison remains available, synchronized in pose and camera.
- Studio-only marching, combat, reference loadouts; battlefield default remains the full kit.
- Optional battle-distance inset drawn with the same WebGL context, off by default.

## QA gates (visual inspection still necessary)
1. Eyeline visible from frontal and quarter views in both helmets.
2. Straps conform at narrow/wide torso width; no detached belt/pouch ends.
3. Pack silhouettes and boot/puttee silhouettes distinguish both nations.
4. Aim, walk, crouch, Down and casualty joints stay connected.
5. Weapon trigger/support grip contacts and muzzle flashes remain aligned.
6. iPhone WebGL memory, 30–40 soldiers, draw call and frame-time comparisons.
7. Previous saved approved shape geometry remains exportable and safe.

Node suite covers geometry, material grouping, SDF finiteness, torso fitting,
seven-role sculpt factory, source-comparison UI, and release cache integrity.
