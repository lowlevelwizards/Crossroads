# Crossroads v0.9.69 — Corrective Miniature Sculpt

A low-complexity repair of the existing Polish and German soldiers, not a new character system.

## Repair list
- **Webbing:** mutate the actual Three.js BufferAttribute, flag GPU updates and recompute normals/bounds. The previous refresh mutated the original input Float32Array, which Float32BufferAttribute copies.
- **Attachment fit:** project shoulder webbing onto the real country-specific six-ring tunic, using tunic vertical scale and body-width changes; move belts and pouches outward and remove hanging rear strap tips.
- **Debug:** the Miniature Lab can reveal lazily created strap anchors. Normal battles incur no debug geometry.
- **Head/helmets:** fuller, shorter lower face; less exaggerated smooth Polish wz.31/German M35 brims with preserved eye clearance. Cache keys bumped.
- **Weapons:** lower front sights into supported barrel profiles, remove floating parallel BAR gas tube, attach LMG/MMG bipod root to a visible hinge.
- **Legwear:** contiguous 12-sided material-banded shins: lower German shaft leather, upper trousers; minimal Polish puttee bands; fix naked mannequin for two material groups.
- **Kneel:** a dedicated asymmetric rear-knee-grounded stance and forward planted opposite foot, not just an exaggerated squat; adjust inspection choreography.
- **Pack:** broad flaps and minimal substantial pack hardware instead of adding miniature-scale greebles.
- **Release:** preserved saved Workbench geometry and historical weapon saves. Battle rules, AI and damage mechanics unaffected.

## Verification
GitHub Actions runs the complete Node suite, including `3d-v169-sculpt-corrections.test.js` which creates buffer geometry and checks the real attribute array, fit updates, lower-leg material groups, kneel and attachment indicators.

After deploy, visually check Poland/Germany and the canon/saved comparison at frontal, lateral and rear views. Battle-scale frame pacing and real-device material shading require direct iPhone inspection; automated tests cannot guarantee appearance.
