# v0.9.70 — Miniature identity, shoulder carry and 1939 equipment

## Scope and preservation
The canonical miniature still uses the same sculpted soldier factory in the Miniature Lab, battlefield and editor. The legacy classic-mode fallback, published Workbench parts, weapon saving, combat rules, AI and movement distances remain unchanged.

## Implemented
1. **Helmet reset.** Polish wz.31 and German M35 are sculpted from separate top-to-rim silhouette contours using 36 radial segments and 8 rings. The M35 has a lowered side/nape skirt, and the Polish version has a more restrained round edge. One continuous polygon surface with an inner lip replaces the previous marching-tetrahedra union. At 576 triangles per helmet the geometry is much cheaper and has no disconnected brim.
2. **Face rebalancing.** Eyes are lowered, while the existing clean cheek/head geometry remains stable. Helmet pitch and placement are recalibrated around the forehead and ears.
3. **Shoulder-first weapon carry.** Weapon transforms derive from each historical archetype’s actual stock/butt coordinate, placing the shoulder pocket first and solving hands toward their real grip sockets. Standing/equipped rests the butt near the crook of the right arm instead of centering the gun against the abdomen.
4. **Aiming and firing.** ADS raises the stock to shoulder/cheek height, rotates the weapon toward the sights and lowers the head. Recoil offsets the shouldered weapon a small amount without detaching the stock from the soldier.
5. **Distinct country gait.** German movement carries rifle in the right hand, out to the side with a free left arm. Polish movement carries the rifle with both hands across the torso. Both reuse existing grounded feet and distance-based walk/run animation.
6. **Field gear differentiation.** Rear Polish H and German Y webbing is fitted to back surface; exposed for combat/no pack and hidden when a marching pack occludes it. Existing distinct Polish pack and puttees / German tornister and jackboots are preserved.
7. **Small weapon cleanup.** MP38 wire stock has a broad connecting butt plate. Mors, MP38 and wz.28 magazines now visibly enter their receivers, not float a tiny distance below.
8. **QA and cache.** Versioned browser assets are v0.9.70. The Node regression suite checks faceted-face clearance, silhouette distinction, triangle budget, rear webbing fit and visibility, and shoulder carry contracts.

## Visual inspection priorities
- Polish vs German front, side and back silhouettes on the iPhone
- Eye/helmet clearance and German rear nape fit
- Standing/equipped gun stock position; sightline from the 3/4 and side angle
- German single-hand run vs Polish two-hand run at battle zoom
- No-pack rear webbing and marching pack occlusion
- 5+ soldiers walking in the same frame without clipping
- Workbench saved geometry and classic-mode fallback after reload

This milestone is visually testable, but automated tests cannot replace iPhone visual/animation QA.
