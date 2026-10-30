# Crossroads v0.9.46 — 1939 National Silhouettes and Weapon Lab

## Scope
The **same shared sculpted soldier factory** now resolves nation-specific cosmetic
gear for both the Miniature Lab and the live battlefield. Gameplay rules,
damage, orders, ranges, morale, movement and AI remain authoritative/unmodified.

### Poland, 1939
- Rounded Polish wz.31 helmet; shallow, simple brow instead of M35 skirt
- Wz.33-inspired canvas field pack, wide flap and blanket roll
- Broad leather shoulder straps and raised ammunition pouches
- Ankle boots and three simple wool wrap/puttee sections over lower legs
- Canvas breadbag and support-crew ammunition bag where appropriate

### Germany, 1939
- Deep M35 Stahlhelm side/rear skirt with protruding front visor, SDF-baked
- More structured Tornister-style pack and rolled shelter/blanket
- Darker Y-style pack straps and larger raised leather pouches
- Taller dark marching boots instead of puttees
- Rear cylindrical gas-mask carrier and extra crew ammunition bag

The shapes follow historically plausible 1939 equipment **silhouettes**, not
a literal reconstruction of every manufacturer's design. Availability and
wearing of particular accessories varied across soldiers and formations.

## Weapon Lab
Open `weapon-lab.html` from the main menu or Miniature Lab. There are 7
selectable historical archetypes:
Polish wz.29/98a-style rifle, Browning wz.28 LMG, Mors prototype SMG;
German Kar98k, MG34, MP38; and an officer pistol.
The Mors is a rare experimental/limited-issue example, **not** a claim that
regular Polish 1939 rifle squads used Mors SMGs.

Every model is made from a small set of major silhouettes: stock, receiver,
barrel/jacket and magazine/feed. Adjust length, stock thickness, receiver
mass, barrel thickness and magazine size, inspect from side/front/rear/top
and compare with the archetype. Machine guns can be viewed on a stand.
Approving saves **only to this browser origin**. Draft slider changes are not
published until approval. Use JSON export to preserve edits and review them
before any repository-wide release.

The live soldier weapon builder loads the same approved presets and updates
grip/muzzle attachment points through the scaled geometry groups; it does
not change ballistics or rules.

## Miniature Lab comparison
Enable **Side-by-side Poland / Germany 1939** to see the same unit position
and animation for each country with matching camera, scale and lighting.
The comparison remains independent of battle and does not save profiles.

## Mobile acceptance gates
- Check Polish/German front, right, back, top and quarter silhouettes.
- Ensure no straps pass through the tunic, no pouches hover, and packs are
  affixed at shoulders. Validate in idle, aim, cover, walk, down/casualty.
- Check ankle-wrap/boot geometry follows the lower-leg articulation.
- Weapon Lab: change every slider, compare, save, reload, reset, export,
  and import; check one- and two-finger touch movement.
- Live battle: confirm approved local weapon profiles affect only visuals.
- Benchmark 30–40 soldiers, SDF helmet caching, shared buffer reuse,
  triangle count and iPhone memory, particularly with comparison enabled.

## Implementation files
- `src/diorama/miniature-faction-gear.js` — faction/role gear layers.
- `src/diorama/miniature-sdf-transitions.js` — differentiated SDF helmets.
- `src/diorama/miniature-weapon-library.js` — weapon archetype/preset API.
- `src/diorama/miniature-historical-weapons.js` — shared adjustable parts.
- `weapon-lab.html`, `weapon-lab.js`, `weapon-lab.css` — independent lab.
- `miniature-studio.js` — synchronized two-nation comparison.

## Historical guidance
Polish wz.31 helmet, wz.36 tunic, wz.33 pack, ammunition pouches, 
short boots and ankle wraps: Warlord Games 'WWII Polish Uniform Guide';
historical Polish equipment breakdown at army1914-1945.org.pl;
Poland Ministry of Education Bzura 1939 soldier illustration.
German M35 helmet, Y-style leather support straps, marching boots,
ammo pouches and field equipment: German Army 1939 uniform references.

After automated tests pass, inspect actual on-device rendering before
treating the sculpt as final art.
