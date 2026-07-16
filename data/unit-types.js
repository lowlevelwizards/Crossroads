"use strict";

(() => {
  function defineUnitType(definition) {
    return Object.freeze({
      ...definition,
      weapons: Object.freeze({ ...definition.weapons }),
      casualtyOrder: Object.freeze([...definition.casualtyOrder])
    });
  }

  window.CROSSROADS_UNIT_TYPES = Object.freeze({
    officer: defineUnitType({
      quality: "regular",
      role: "officer",
      name: "Officer",
      short: "HQ",
      soldiers: 2,
      morale: 9,
      weapons: { pistol: 2 },
      casualtyOrder: ["pistol"]
    }),

    rifleSquad: defineUnitType({
      quality: "regular",
      role: "line",
      name: "Rifle Squad",
      short: "RIF",
      soldiers: 6,
      morale: 9,
      weapons: { rifle: 5, lmg: 1 },
      casualtyOrder: ["rifle", "lmg"]
    }),

    assaultSquad: defineUnitType({
      quality: "regular",
      role: "assault",
      name: "Assault Squad",
      short: "SMG",
      soldiers: 6,
      morale: 9,
      weapons: { rifle: 3, smg: 3 },
      casualtyOrder: ["rifle", "smg"]
    }),

    mmgTeam: defineUnitType({
      quality: "regular",
      role: "support",
      name: "MMG Team",
      short: "MMG",
      soldiers: 3,
      morale: 9,
      weapons: { mmg: 1 },
      casualtyOrder: []
    })
  });
})();
