# Crossroads 3D — Sculpted Infantry Overhaul / v0.9.20

## Intent
Move the shared Crossroads miniatures toward the compact, chunky 1939 Polish
rifleman reference. Keep the tabletop miniature character while correcting
block-only anatomy, floating grips, faceted helmets and entire-base falls.
The reference images are art-direction targets, not textures or imported assets.

## Source of truth
- \`src/diorama/miniature-v2.js\`: smooth low-resolution geometry, individual
  soldier silhouettes, helmet profiles, rig hierarchy, articulated two-handed
  rifle placement, historically legible field equipment, weapon muzzle anchors,
  specialist and crew variants, inspection layers, and material-safe paint.
- \`src/diorama/miniature-model.js\`: shared factory facade. Default = sculpted;
  \`window.Crossroads3DForceClassicMiniature=true\` selects legacy block model.
- \`src/diorama/miniature-studio.js\`: independent studio uses the shared
  factory, body/uniform/equipped comparison, wireframe and 12 joint guides.
- \`src/diorama/scenario-scene.js\`: feeds existing authoritative walk, run,
  Down, pin and recoil state into the new rig. On casualty, body rotation is
  independent from the tabletop base.
- \`src/diorama/miniature-studio-poses.js\`: Down posture is a physical crouch;
  casualty fall has a deterministic non-looping terminal frame.
- \`src/diorama/miniature-profiles.js\`: prior appearance records are still read
  unchanged; the V2 model interprets head/width/pack/boot scales and colors.

## Physical hierarchy
\`\`\`
figure (world translation and aim direction)
  base (flat, including selection ring)
  body (fall/casualty; never rotates the base)
    pelvis and independently positioned foot/leg segments
    breathing / torso
      head / smooth headgear
      shoulders, upper/lower arms and hand grip targets
      wearable uniform / equipment group
      weapon / muzzle, support and trigger grips
\`\`\`

## Visual standards
- Smooth vertex normals on faces, helmet shells, clothing volumes, boots and
  mittens. Intentionally crisp geometry on weapons, pouches and buckles.
- Grounded 1939 Polish rifleman first; other faction/role recipes keep
  distinctive gear and weapons without adding mechanics.
- Shared primitive geometry buffers across model instances to control mobile
  GPU memory. Color materials remain actor-owned for individual paint.
- The studio provides an actual geometry-backed body study, not a painted
  screenshot. It uses the same figure as the battlefield.
- Existing battle movement, pinning, casualty decisions, targeting, unit
  positions, squad formations, fire rates, and morale remain authoritative.

## Test and QA
Run \`node tests/run-all-node.js\`. The new
\`tests/3d-v121-sculpted-miniatures.test.js\` checks the V2 constructor for
every current role, posture separation, inspection layers, loading order, and
shared model contract.

In \`miniature-studio.html\`, select Poland 1939 -> Rifle Squad -> Rifle.
Compare new and classic bodies, then inspect Body / Uniform / Equipped at
matched camera angles. Look at the helmet, elbow articulation, grip contact,
pouches and pack from front, right, back, left, and 3/4 view. Inspect walk,
run, Down, fire, reload, deployment, casualty and held casualty endpoint.

In \`battle3d.html?scenario=hold_the_farm&solo=1&benchmark=1\`, visually
verify a 30–40 soldier battle on the oldest supported iPhone. Compare
frame-time and draw calls with the classic fallback, test soldier gait in
rough terrain, garrison windows, MMG deployment and casualty collisions.

## Known review gates
- The node suite checks structural contracts, *not* rendered appearance.
  iPhone WebGL QA must approve actual smoothness, proportions, any clipping,
  pose timing and full-match frame rate before merge.
- Some specialist silhouettes use deliberately simplified equipment; they
  require a historical-reference audit before final WWII content signoff.
- This is a procedural primitive/rig overhaul, not a freeform mesh editor
  or a cloth-simulation system.
