"use strict";

(() => {
  function freezeRecord(record) {
    return Object.freeze({ ...record });
  }

  function freezeLoadProfiles(profiles = {}) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(profiles).map(([id, profile]) => [
          id,
          Object.freeze({
            primary: profile.primary,
            secondary: profile.secondary ?? "none"
          })
        ])
      )
    );
  }

  function defineKit(definition) {
    return Object.freeze({
      ...definition,
      defaults: freezeRecord(definition.defaults),
      roleLoads: freezeRecord(definition.roleLoads ?? {}),
      loadPattern: Object.freeze([...(definition.loadPattern ?? [])]),
      loadProfiles: freezeLoadProfiles(definition.loadProfiles),
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
        webbing: "none",
        load: "generic-fighting"
      },
      roleLoads: {
        officer: "generic-command",
        lmg: "generic-gunner",
        loader: "generic-fighting",
        mmg: "generic-support",
        crew: "generic-support"
      },
      loadPattern: ["generic-full", "generic-fighting", "generic-fighting"],
      loadProfiles: {
        "generic-full": { primary: "generic-pack", secondary: "generic-roll" },
        "generic-fighting": { primary: "generic-pack-small" },
        "generic-command": { primary: "generic-light-pack" },
        "generic-gunner": { primary: "generic-pack-small" },
        "generic-support": { primary: "generic-pack-small" }
      },
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
        webbing: "none",
        load: "polish-fighting"
      },
      roleLoads: {
        officer: "polish-command",
        lmg: "polish-gunner",
        loader: "polish-fighting",
        mmg: "polish-support",
        crew: "polish-support"
      },
      loadPattern: ["polish-full", "polish-fighting", "polish-fighting"],
      loadProfiles: {
        "polish-full": { primary: "polish-pack", secondary: "polish-roll" },
        "polish-fighting": { primary: "polish-pack" },
        "polish-command": { primary: "polish-light-pack" },
        "polish-gunner": { primary: "polish-pack-small" },
        "polish-support": { primary: "polish-pack-small" }
      },
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
        webbing: "none",
        load: "german-fighting"
      },
      roleLoads: {
        officer: "german-command",
        lmg: "german-gunner",
        loader: "german-fighting",
        mmg: "german-support",
        crew: "german-support"
      },
      loadPattern: ["german-full", "german-fighting", "german-fighting"],
      loadProfiles: {
        "german-full": { primary: "german-pack", secondary: "german-canister" },
        "german-fighting": { primary: "german-canister" },
        "german-command": { primary: "german-light-pack" },
        "german-gunner": { primary: "german-pack-small" },
        "german-support": { primary: "german-pack-small" }
      },
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
  // Explicit unit.kitId or unit-template kitId continues to take priority.
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
