"use strict";

(() => {
  function freezeRecord(record) {
    return Object.freeze({ ...record });
  }

  function defineKit(definition) {
    return Object.freeze({
      ...definition,
      defaults: freezeRecord(definition.defaults),
      roleLoads: freezeRecord(definition.roleLoads ?? {}),
      loadPattern: Object.freeze([...(definition.loadPattern ?? [])]),
      weapons: freezeRecord(definition.weapons)
    });
  }

  const kits = Object.freeze({
    generic_ww2: defineKit({
      id: "generic_ww2",
      factionId: "generic",
      label: "Generic WWII",
      cssClass: "kit-generic-ww2",
      defaults: {
        helmet: "generic-steel",
        legwear: "generic-boots",
        webbing: "generic-webbing",
        load: "generic-pack"
      },
      roleLoads: {
        officer: "light-command",
        lmg: "light-gunner",
        loader: "ammo-bearer",
        mmg: "support-load",
        crew: "support-load"
      },
      loadPattern: ["generic-pack", "generic-fighting", "generic-fighting"],
      weapons: {
        rifle: "generic-rifle",
        smg: "generic-smg",
        lmg: "generic-lmg",
        pistol: "generic-pistol",
        mmg: "generic-mmg"
      }
    }),

    poland_1939: defineKit({
      id: "poland_1939",
      factionId: "poland",
      label: "Poland 1939",
      cssClass: "kit-poland-1939",
      defaults: {
        helmet: "wz31",
        legwear: "puttees",
        webbing: "polish-leather",
        load: "polish-fighting"
      },
      roleLoads: {
        officer: "polish-command",
        lmg: "polish-gunner",
        loader: "polish-ammo",
        mmg: "polish-support",
        crew: "polish-support"
      },
      loadPattern: ["polish-full-pack", "polish-fighting", "polish-fighting"],
      weapons: {
        rifle: "polish-rifle",
        smg: "generic-smg",
        lmg: "generic-lmg",
        pistol: "generic-pistol",
        mmg: "generic-mmg"
      }
    }),

    germany_1939: defineKit({
      id: "germany_1939",
      factionId: "germany",
      label: "Germany 1939",
      cssClass: "kit-germany-1939",
      defaults: {
        helmet: "m35",
        legwear: "jackboots",
        webbing: "german-black",
        load: "german-fighting"
      },
      roleLoads: {
        officer: "german-command",
        lmg: "german-gunner",
        loader: "german-ammo",
        mmg: "german-support",
        crew: "german-support"
      },
      loadPattern: ["german-compact-pack", "german-fighting", "german-fighting"],
      weapons: {
        rifle: "german-rifle",
        smg: "generic-smg",
        lmg: "generic-lmg",
        pistol: "generic-pistol",
        mmg: "generic-mmg"
      }
    })
  });

  // Compatibility bridge for the current Poland-versus-Germany scenario set.
  // A future engine propagation pass can supply unit.kitId directly; the
  // miniature resolver already gives that value priority over these defaults.
  const sideDefaults = Object.freeze({
    blue: "poland_1939",
    red: "germany_1939"
  });

  window.CROSSROADS_FACTION_KITS = Object.freeze({
    fallbackKitId: "generic_ww2",
    kits,
    sideDefaults
  });
})();
