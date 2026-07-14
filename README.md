# CROSSROADS — Gameplay 2.4C.2

Visual stability and MMG cleanup.

## MMG corrections

- Packed MMGs now use only the gun already held by the gunner.
- No second carried weapon is layered across the formation.
- Deployed MMGs use only the ground-mounted weapon.
- Deployed receiver, barrel, tripod, and crew layout are substantially smaller.
- The gun remains aligned with `mmgFacing`.

## Layout consistency

- Medium and close zoom always show the unit nameplate and quality stripes.
- Formation containers explicitly allow heads and weapons to overflow safely.
- Weapon role tabs are smaller and consistently anchored.
- Legacy central order and pin-scatter visuals are forcibly hidden.
- Far counters use a stable quality / role / men / Pins layout.

## Building occupancy

- Occupied buildings gain a persistent exterior faction/unit tab.
- The tab can select the occupant.
- It pulses when that occupant is eligible for the current die.

Upload every file and wait until the badge says:

`Gameplay 2.4C.2`

A healthy diagnostic includes:

`READ OK/STABLE`
