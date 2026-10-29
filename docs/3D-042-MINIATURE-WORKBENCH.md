# Crossroads Miniature Workbench · v0.9.33–0.9.42

## What works

The independent Miniature Lab now exposes **EDIT SHAPE**. It forces a clean
T-pose, hides the rifle and uniform details, and lets users select an actual
mesh by tapping it or choosing one of eight part slots. Editable parts:
torso, head, helmet dome, upper arms, forearms, thighs, shins, and boots.

The editor manipulates a **versioned contour document**, not one-off source
constants. Tap a green/orange handle to drag width, depth or contour height.
Use front and right orthographic cameras for stable edits. The object tools
Move, Scale and Rotate alter the baked mesh's transform, not joint pivots.
Mirror is enabled by default. Selected parts can be isolated or ghosted.
Contours can be inserted, deleted and smoothed; radial resolution is limited
to 6–24 sides to encourage efficient geometry.

Undo and redo operate per gesture. Auto-save creates a local **draft** in
browser storage. SAVE DRAFT and EXPORT JSON provide explicit backup.
IMPORT JSON validates the document before replacing the draft.
USE ON THIS DEVICE copies that part to a separate **approved** store; the
shared live character factory resolves only that approved copy. This changes
only the current browser/origin, not GitHub or other players. Reload the
battle or lab after approving to see it outside the edit preview.

## Shape blending

Each contour shape can include a secondary ellipsoidal SDF volume.
A smooth-min union with adjustable blending softness merges overlapping
surfaces before being polygonized via CPU marching tetrahedra. This is
**baked mesh geometry**, never a shader effect or per-frame raymarch.
The original contour/primitive definition is preserved for further editing.
When blending the torso, the standalone pelvis mesh is hidden to prevent
duplicate overlapping mass. A bounded, adaptive voxel resolution and
content-addressed cache prevent live scene rebaking on each frame.

This first SDF implementation supports **one secondary primitive per part**.
It is deliberately a controlled experiment, not arbitrary multi-mesh
Boolean/voxel surgery. Smooth connected forms for shoulder/torso, complex
helmet brims, and arbitrary union editing remain future extensions.
A blended mesh usually has more triangles than a basic 10-sided loft; the
blend toggle must be justified visually before approving it.

## Runtime / safety

- The editor itself loads only on miniature-studio.html.
- battle3d.html and editor3d.html load the small approved asset reader and
  mesh generator, not editing handles, touch logic or history.
- The rig, soldier recipe, combat orders, weapon stats, morale and hit
  calculations are not changed.
- Previous V2 and classic models remain fallbacks.
- Publishing a shape affects only this browser's localStorage. To ship an
  asset to all players, export its JSON and commit the approved document
  to a dedicated, reviewed source catalogue in the repository.

## Test instructions

1. Open the Miniature Lab, choose Poland 1939 / Rifle / 03.
2. Open Edit Shape; verify an upright unarmed T-pose with no pockets or pack.
3. Select Torso; set Front view, drag chest and waist handles, then view Right.
4. Try inserting a contour, smoothing it and undoing the change.
5. In the SDF section, enable blending and move the secondary volume. Toggle
   off to compare with the simpler original loft.
6. Save draft, reload, reopen editor: the modified source contour must persist.
7. Export JSON and re-import it; test rejecting invalid files.
8. Choose USE ON THIS DEVICE and reload the lab, then battle.
9. Check every exposed part, symmetry, portrait/landscape orientation, and
   camera gestures on actual iOS Safari.
10. Run node tests/run-all-node.js and profile at least 30 soldiers with
    a published blended torso to measure triangle/draw-call cost.

## Known review gates

The Node suite validates geometry, storage, hierarchy and source contracts.
It does **not** replace touch-device or visual QA. In particular, evaluate
camera-versus-handle gesture priority, glove/arm transitions, helmet silhouette,
published geometry attachment to articulated parts and performance on iPhone.
