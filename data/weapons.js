"use strict";

// Foundation 2B.2: static weapon profiles peeled out of index.html.
window.CROSSROADS_WEAPON_PROFILES = Object.freeze({
  rifle: Object.freeze({ key: "rifle", label: "Rifle", short: "R", range: 24, shots: 1, assault: false, fixed: false }),
  smg: Object.freeze({ key: "smg", label: "SMG", short: "S", range: 12, shots: 2, assault: true, fixed: false }),
  lmg: Object.freeze({ key: "lmg", label: "LMG", short: "L", range: 36, shots: 4, assault: false, fixed: false }),
  pistol: Object.freeze({ key: "pistol", label: "Pistol", short: "P", range: 6, shots: 1, assault: true, fixed: false }),
  mmg: Object.freeze({ key: "mmg", label: "MMG", short: "MMG", range: 36, shots: 5, reducedShots: 2, crewRequired: 2, crewWeapon: true, assault: false, fixed: true })
});
