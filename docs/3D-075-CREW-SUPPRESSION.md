# Crossroads 3D v0.9.75 — Crew-Served Weapons & Tactical Suppression

The sequence is implemented in five separately committed stages on PR #48.
The authoritative source remains embedded InfantryCore; no extra attacks,
morale modifiers, auxiliary movement or targeting rules are added.

## A. Shared team anatomy
- New `crew-presentation.js` describes the real three/surviving-two/
  disabled-one-soldier support team, with pure pose sampling and reach checks.
- Deployed MMG visual geometry is attached to the **squad root**, not the
  moving gunner skeleton. A reusable socket interface exposes weapon grips
  and muzzle in world space. This never changes model base coordinates.
- Crew sockets are conservative; inaccessible/overextended poses must not
  move the bases or imply that individual assistants can be shot separately.

## B. Firing position
- Fire-to-deploy and packing snapshots trigger authored per-role postures.
- Deployed mounted gun traverses within 45 degrees of the legal 90-degree
  facing. The firing wedge remains tied to `unit.mmgFacing` from InfantryCore.
- Gunner, loader and observer get different pose channels; weapon-discharges
  continue to use adjudicated v0.9.74 fire events.
- Deployment remains an activation-consuming rules transaction. The animation
  is independent and can be skipped; it does not change the available shots.

## C. Persistent morale
- New `suppression-posture.js` converts authoritative Pins/Down/recent hits
  into bounded, persistent defensive crouches and helmet/shoulder ducking.
- Casualty and Down states win priority; walking and active firing remain
  permitted and visually legible.
- The officer uses an existing gesture rig during Rally recovery, and failed
  order tests register a short non-persistent shock.
- This does NOT introduce a separate suppression penalty.

## D. Support AI
- The AI evaluates cover, objectives, suitable engagement ranges, and
  infantry support in candidate legal movement previews.
- Existing command routing still validates every order.
- MMG rotation evaluates the total value of targets inside adjacent sectors,
  permits 45-degree turns only and uses hysteresis to prevent oscillation.

## E. Independent Lab and diagnostics
- In Miniature Lab, select the MMG unit and enable **CREW MODE**.
- Inspect all three soldiers, select 2-person or 1-person crew, and scrub
  new deploy, mounted, traverse, fire, pack, pinned and Rally sequences.
- `?debugCrew=1` in battle and the Lab crew socket checkbox display
  attachment targets without modifying gameplay.
- Run `node tests/run-all-node.js`; CI is still not a substitute for real
  Safari / iPhone WebGL visual QA.

## Manual acceptance checklist
- Confirm separate soldiers never share an overlapping base, and mounted
  gun does not float during crew posing, facing changes or replay.
- Check gunner-to-mount hand reach and loader feed interaction at normal
  and close camera distances; improve any unnatural poses rather than
  extending arms through receivers.
- Test packed→Fire(deploy)→45-degree rotation→legal/illegal target→Fire;
  3/2/1 surviving models, movement packing, Down, failed order, Rally, Skip.
- Switch between battle/miniature Lab/weapon Lab and test memory on iPhone.
- Reload with a clean cache after each minor build.
