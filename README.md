# CROSSROADS — Gameplay 2.2A

Building UI polish staged as one pass.

## Included

### 2.2A.1 — Occupancy card
- Occupied squads no longer render their full miniature formation inside.
- One compact occupancy card represents faction, unit, men, pins, and order.
- Card detail adapts across far, medium, and close zoom.

### 2.2A.2 — Label cleanup
- FARMHOUSE is now a horizontal plaque along the top edge.
- Vertical text no longer collides with the occupant.

### 2.2A.3 — Selection and doorway presentation
- Occupied faction outline remains.
- Selected occupant gives the farmhouse a stronger gold highlight.
- A doorway approach marker appears when Enter Farmhouse is available.
- Tapping the farmhouse or occupancy card selects its occupant.

### 2.2A.4 — Mobile command priority
- Enter/Exit Farmhouse remains the first command.
- It spans the full mobile tray width.
- Run, Advance, and Assault remain hidden while occupied because they are illegal.

### 2.2A.5 — Feedback
- FARMHOUSE OCCUPIED announcement retained and strengthened.
- FARMHOUSE CLEARED announcement added on exit.
- Diagnostics now report `/CARD` when occupancy and card rendering agree.

## Test

Wait for the visible badge: `Gameplay 2.2A`.

Then test:
1. Enter with Blue and Red.
2. Inspect at roughly 75%, 150%, and 200% zoom.
3. Tap the card and building to select the occupant.
4. Confirm Exit is first and full-width on mobile.
5. Exit and confirm the card and faction outline clear.
6. Restart and confirm `BLDG OK:none/CARD`.
