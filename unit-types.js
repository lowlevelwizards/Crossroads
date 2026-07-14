"use strict";

// Foundation 2B.2: reusable unit templates peeled out of index.html.
window.CROSSROADS_UNIT_TYPES = Object.freeze({
  officer: Object.freeze({ quality: "regular", role: "officer", name: "Officer", soldiers: 2, morale: 9, weapons: Object.freeze({ pistol: 2 }), casualtyOrder: Object.freeze(["pistol"]) }),
  rifleSquad: Object.freeze({ quality: "regular", role: "line", name: "Rifle Squad", soldiers: 6, morale: 9, weapons: Object.freeze({ rifle: 5, lmg: 1 }), casualtyOrder: Object.freeze(["rifle", "lmg"]) }),
  assaultSquad: Object.freeze({ quality: "regular", role: "assault", name: "Assault Squad", soldiers: 6, morale: 9, weapons: Object.freeze({ rifle: 3, smg: 3 }), casualtyOrder: Object.freeze(["rifle", "smg"]) }),
  mmgTeam: Object.freeze({ quality: "regular", role: "support", name: "MMG Team", soldiers: 3, morale: 9, weapons: Object.freeze({ mmg: 1 }), casualtyOrder: Object.freeze([]) })
});
