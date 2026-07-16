"use strict";

(() => {
  const KIT_REGISTRY = window.CROSSROADS_FACTION_KITS;
  const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES;

  if (!KIT_REGISTRY) {
    throw new Error("data/faction-kits.js did not load before miniatures.js.");
  }
  if (!UNIT_TYPES) {
    throw new Error("data/unit-types.js did not load before miniatures.js.");
  }

  const VALID_FACINGS = new Set(["left", "right", "up", "down"]);
  const SAFE_TOKEN = /^[a-z0-9_-]+$/;

  function safeToken(value, fallback) {
    const token = String(value ?? "").trim().toLowerCase();
    return SAFE_TOKEN.test(token) ? token : fallback;
  }

  function unitFacing(unit) {
    if (VALID_FACINGS.has(unit?.facing)) return unit.facing;
    return unit?.faction === "red" ? "left" : "right";
  }

  function soldierRole(unit, index) {
    if (unit.role === "officer") return index === 0 ? "officer" : "rifle";
    if (unit.role === "support") return index === 0 ? "mmg" : "crew";

    if (unit.role === "assault") {
      const smgCount = unit.weapons?.smg ?? unit.soldiers;
      return index < smgCount ? "smg" : "rifle";
    }

    const lmgCount = unit.weapons?.lmg ?? 0;
    if (lmgCount > 0 && index === 0) return "lmg";
    if (lmgCount > 0 && index === 1) return "loader";
    return "rifle";
  }

  function weaponKeyForRole(role) {
    if (role === "smg") return "smg";
    if (role === "lmg") return "lmg";
    if (role === "mmg") return "mmg";
    if (role === "officer") return "pistol";
    if (role === "crew") return null;
    return "rifle";
  }

  function kitForUnit(unit) {
    const templateKitId = UNIT_TYPES[unit?.type]?.kitId;
    const requestedKitId =
      unit?.kitId ??
      templateKitId ??
      KIT_REGISTRY.sideDefaults[unit?.faction] ??
      KIT_REGISTRY.fallbackKitId;

    return (
      KIT_REGISTRY.kits[requestedKitId] ??
      KIT_REGISTRY.kits[KIT_REGISTRY.fallbackKitId]
    );
  }

  function loadProfileIdForModel(kit, role, index) {
    const roleLoad = kit.roleLoads[role];
    if (roleLoad) return roleLoad;

    const pattern = kit.loadPattern;
    if (pattern.length > 0) return pattern[index % pattern.length];
    return kit.defaults.load;
  }

  function loadProfileForModel(kit, role, index) {
    const id = loadProfileIdForModel(kit, role, index);
    const fallbackId = kit.defaults.load;
    const profile = kit.loadProfiles[id] ?? kit.loadProfiles[fallbackId];

    if (!profile) {
      return Object.freeze({
        id: "none",
        primary: "none",
        secondary: "none"
      });
    }

    return Object.freeze({
      id,
      primary: profile.primary,
      secondary: profile.secondary ?? "none"
    });
  }

  function resolveModelRecipe(unit, index, options = {}) {
    const role = options.role ?? soldierRole(unit, index);
    const weaponKey = options.weaponKey ?? weaponKeyForRole(role);
    const kit = kitForUnit(unit);
    const load = loadProfileForModel(kit, role, index);
    const weaponProfile = weaponKey
      ? kit.weapons[weaponKey] ?? `generic-${weaponKey}`
      : "unarmed";

    return Object.freeze({
      kit,
      role,
      facing: options.facing ?? unitFacing(unit),
      weaponKey,
      helmet: safeToken(options.helmet ?? kit.defaults.helmet, "generic-steel"),
      legwear: safeToken(options.legwear ?? kit.defaults.legwear, "generic-boots"),
      webbing: safeToken(options.webbing ?? kit.defaults.webbing, "none"),
      loadProfile: safeToken(load.id, "none"),
      loadPrimary: safeToken(load.primary, "none"),
      loadSecondary: safeToken(load.secondary, "none"),
      weaponProfile: safeToken(weaponProfile, "unarmed")
    });
  }

  function modelClasses(recipe) {
    return [
      "brick-soldier",
      `role-${safeToken(recipe.role, "rifle")}`,
      `facing-${safeToken(recipe.facing, "right")}`,
      safeToken(recipe.kit.cssClass, "kit-generic-ww2"),
      `faction-${safeToken(recipe.kit.factionId, "generic")}`,
      `helmet-${recipe.helmet}`,
      `legwear-${recipe.legwear}`,
      `webbing-${recipe.webbing}`,
      `load-profile-${recipe.loadProfile}`,
      `load-primary-${recipe.loadPrimary}`,
      `load-secondary-${recipe.loadSecondary}`,
      `weapon-${recipe.weaponProfile}`
    ].join(" ");
  }

  function weaponHtml() {
    return `
      <span class="brick-weapon">
        <span class="weapon-stock"></span>
        <span class="weapon-receiver"></span>
        <span class="weapon-barrel"></span>
        <span class="weapon-detail"></span>
        <span class="weapon-muzzle" aria-hidden="true"></span>
      </span>
    `;
  }

  function brickSoldierHtml(unit, index, options = {}) {
    const recipe = resolveModelRecipe(unit, index, options);
    const slot = options.slot ?? [50, 50];
    const extraClass = options.extraClass ? ` ${options.extraClass}` : "";

    return `
      <span class="model-wrap formation-slot slot-${index + 1}${extraClass}"
            style="--slot-x:${slot[0]}%;--slot-y:${slot[1]}%"
            aria-hidden="true">
        <span class="model-hit-pad" aria-hidden="true"></span>
        <span class="model-base-ring" aria-hidden="true"></span>
        <span class="model-shadow"></span>
        <span class="model-hop">
          <span class="${modelClasses(recipe)}"
                data-model-index="${index}"
                data-kit-id="${recipe.kit.id}"
                ${recipe.weaponKey ? `data-weapon-key="${recipe.weaponKey}"` : ""}>
            <span class="brick-legs"></span>
            <span class="brick-load">
              <span class="load-primary"></span>
              <span class="load-secondary"></span>
            </span>
            <span class="brick-torso"></span>
            <span class="brick-webbing"></span>
            <span class="brick-head"></span>
            <span class="brick-helmet"></span>
            <span class="brick-arm"></span>
            ${weaponHtml()}
          </span>
        </span>
      </span>
    `;
  }

  function packedMMGFormationHtml(unit, slots = []) {
    return Array.from(
      { length: Math.max(1, unit.soldiers) },
      (_, index) =>
        brickSoldierHtml(unit, index, {
          slot: slots[index] ?? [50, 50]
        })
    ).join("");
  }

  function deployedMMGFormationHtml(unit, slots = []) {
    const kit = kitForUnit(unit);
    const crewCount = Math.max(1, unit.soldiers);
    const crew = Array.from(
      { length: crewCount },
      (_, index) => `
        <span class="mmg-deployed-crew crew-${index + 1}">
          ${brickSoldierHtml(unit, index, {
            role: "crew",
            slot: slots[index] ?? [50, 50],
            extraClass: "deployed-crew-model"
          })}
        </span>
      `
    ).join("");

    const weaponClass = safeToken(
      kit.weapons.mmg ?? "generic-mmg",
      "generic-mmg"
    );

    return `
      <span class="mmg-deployed-formation ${safeToken(kit.cssClass, "kit-generic-ww2")} weapon-${weaponClass}"
            data-kit-id="${kit.id}"
            style="--mmg-facing:${unit.mmgFacing}deg">
        <span class="mmg-tripod"><i></i><i></i><i></i></span>
        <span class="mmg-receiver"></span>
        <span class="mmg-barrel"><span class="weapon-muzzle" aria-hidden="true"></span></span>
        ${crew}
      </span>
    `;
  }

  window.CrossroadsMiniaturePresentation = Object.freeze({
    unitFacing,
    soldierRole,
    weaponKeyForRole,
    kitForUnit,
    loadProfileForModel,
    resolveModelRecipe,
    brickSoldierHtml,
    packedMMGFormationHtml,
    deployedMMGFormationHtml
  });
})();
