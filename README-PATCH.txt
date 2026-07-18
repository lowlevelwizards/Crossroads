Crossroads unit presentation patch

Changed behavior
- Units now occupy a dedicated render band above every terrain fragment, including building foreground fragments and woodland canopies.
- Objectives and interaction overlays remain above units.
- Movement facing is measured from the unit's actual on-screen displacement for every path segment. This remains correct when the camera/table is rotated or scenario sides are swapped.
- The resolved final screen-facing is committed back to unit state after movement.

Replace the matching files in the project while preserving folder paths.

Validation
- New unit presentation integrity test passes.
- Scene compositor, woodland generation, editor, Mokra, rules, scenario runtime, deployment, and source-audit tests pass.
- The pre-existing release-integrity test still fails because the uploaded archive contains retired top-level main.css; this patch does not alter that unrelated file.
