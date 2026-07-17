"use strict";

(() => {
  const requirements = Object.freeze([
    ["CROSSROADS_BUILD_INFO", "data/build-info.js"],
    ["CROSSROADS_STAGE", "data/stage.js"],
    ["CROSSROADS_WEAPON_PROFILES", "data/weapons.js"],
    ["CROSSROADS_TERRAIN", "data/terrain.js"],
    ["CROSSROADS_TERRAIN_TYPES", "data/terrain.js"],
    ["CROSSROADS_UNIT_QUALITY", "data/unit-quality.js"],
    ["CROSSROADS_UNIT_TYPES", "data/unit-types.js"],
    ["CROSSROADS_FACTION_KITS", "data/faction-kits.js"],
    ["CROSSROADS_FORMATIONS", "data/formations.js"],
    ["CROSSROADS_SCENARIOS", "data/scenarios.js"],
    ["CROSSROADS_CORE_SCENARIO_12A", "data/scenarios.js"],
    ["CrossroadsBuildingPresentation", "src/presentation/buildings.js"],
    ["CrossroadsTerrainPresentation", "src/presentation/terrain.js"],
    ["CrossroadsTerrainGeometry", "src/rules/terrain-geometry.js"],
    ["CrossroadsCommands", "src/infrastructure/commands.js"],
    ["CrossroadsFormationGeometry", "src/presentation/formation-geometry.js"],
    ["CrossroadsTargetingPresentation", "src/presentation/targeting.js"],
    ["CrossroadsScreenOverlays", "src/presentation/overlays.js"],
    ["CrossroadsMiniaturePresentation", "src/presentation/miniatures.js"],
    ["CrossroadsUnitPresentation", "src/presentation/units.js"],
    ["CrossroadsPresentationEffects", "src/presentation/effects.js"],
    ["CrossroadsBattlefieldPresentation", "src/presentation/battlefield.js"],
    ["CrossroadsCamera", "src/camera/camera.js"],
    ["CrossroadsCoordinates", "src/camera/coordinates.js"],
    ["CrossroadsCameraInput", "src/input/camera-input.js"],
    ["CrossroadsBattlefieldInput", "src/input/battlefield-input.js"],
    ["CrossroadsMovementRules", "src/rules/movement.js"],
    ["CrossroadsMoraleRules", "src/rules/morale.js"],
    ["CrossroadsShootingRules", "src/rules/shooting.js"],
    ["CrossroadsCombatIntegration", "src/rules/shooting-integration.js"],
    ["CrossroadsAssaultRules", "src/rules/assault.js"],
    ["CrossroadsAssaultIntegration", "src/rules/assault-integration.js"]
  ]);

  const SAFE_TOKEN = /^[a-z0-9_-]+$/;
  const REQUIRED_WEAPONS = Object.freeze(["rifle", "smg", "lmg", "pistol", "mmg"]);

  function validToken(value) {
    return SAFE_TOKEN.test(String(value ?? ""));
  }

  function validateFactionKits() {
    const registry = window.CROSSROADS_FACTION_KITS;
    if (!registry?.kits) return ["Faction-kit registry is unavailable."];

    const issues = [];
    const fallback = registry.kits[registry.fallbackKitId];
    if (!fallback) {
      issues.push(`Unknown fallback faction kit: ${registry.fallbackKitId}`);
    }

    for (const [kitId, kit] of Object.entries(registry.kits)) {
      if (kit.id !== kitId) issues.push(`Faction kit ${kitId} has mismatched id ${kit.id}.`);
      if (!validToken(kit.cssClass)) {
        issues.push(`Faction kit ${kitId} has unsafe cssClass ${kit.cssClass}.`);
      }

      for (const field of ["helmet", "legwear", "webbing", "load"]) {
        if (!validToken(kit.defaults?.[field])) {
          issues.push(`Faction kit ${kitId} has invalid default ${field}.`);
        }
      }

      const profiles = kit.loadProfiles ?? {};
      if (!profiles[kit.defaults?.load]) {
        issues.push(`Faction kit ${kitId} is missing default load profile ${kit.defaults?.load}.`);
      }

      for (const [profileId, profile] of Object.entries(profiles)) {
        if (!validToken(profileId)) {
          issues.push(`Faction kit ${kitId} has invalid load profile id ${profileId}.`);
        }
        if (!validToken(profile?.primary)) {
          issues.push(`Faction kit ${kitId}.${profileId} has invalid primary load.`);
        }
        if (!validToken(profile?.secondary ?? "none")) {
          issues.push(`Faction kit ${kitId}.${profileId} has invalid secondary load.`);
        }
      }

      for (const [role, profileId] of Object.entries(kit.roleLoads ?? {})) {
        if (!profiles[profileId]) {
          issues.push(`Faction kit ${kitId} role ${role} references unknown load ${profileId}.`);
        }
      }

      for (const profileId of kit.loadPattern ?? []) {
        if (!profiles[profileId]) {
          issues.push(`Faction kit ${kitId} load pattern references unknown load ${profileId}.`);
        }
      }

      for (const weapon of REQUIRED_WEAPONS) {
        if (!validToken(kit.weapons?.[weapon])) {
          issues.push(`Faction kit ${kitId} is missing a valid ${weapon} visual.`);
        }
      }
    }

    return issues;
  }

  function validateScenarioKits() {
    const scenarios = window.CROSSROADS_SCENARIOS;
    const kits = window.CROSSROADS_FACTION_KITS?.kits;
    if (!scenarios || !kits) return [];

    const issues = [];
    for (const scenario of Object.values(scenarios)) {
      for (const side of ["blue", "red"]) {
        const faction = scenario.factions?.[side];
        if (!faction?.id) issues.push(`${scenario.id}.${side} is missing faction id.`);
        if (!faction?.name) issues.push(`${scenario.id}.${side} is missing faction name.`);
        if (!kits[faction?.kitId]) {
          issues.push(`${scenario.id}.${side} references unknown kit ${faction?.kitId}.`);
        }
      }
    }
    return issues;
  }

  function validateBuildingPresentation() {
    const types = window.CROSSROADS_TERRAIN_TYPES;
    const scenarios = window.CROSSROADS_SCENARIOS;
    const presentation = window.CrossroadsBuildingPresentation;
    if (!types || !scenarios || !presentation) return [];

    const issues = [];
    const buildingTypes = Object.values(types).filter(type => type.family === "building");

    for (const type of buildingTypes) {
      const visual = type.presentation ?? {};
      if (!presentation.hasShape(visual.shape)) {
        issues.push(`Building type ${type.id} references unknown shape ${visual.shape}.`);
      }
      if (!presentation.hasAppearance(visual.defaultAppearance)) {
        issues.push(`Building type ${type.id} references unknown default appearance ${visual.defaultAppearance}.`);
      }

      for (const [field, point] of [
        ["entryAnchor", visual.entryAnchor],
        ["entryNormal", visual.entryNormal]
      ]) {
        if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) {
          issues.push(`Building type ${type.id} has invalid ${field}.`);
        }
      }
    }

    for (const scenario of Object.values(scenarios)) {
      for (const instance of scenario.terrain ?? []) {
        const type = types[instance.terrainId];
        if (type?.family !== "building") continue;
        const appearance = instance.appearance ?? type.presentation?.defaultAppearance;
        if (!validToken(appearance)) {
          issues.push(`${scenario.id}.${instance.id} has unsafe appearance ${appearance}.`);
        } else if (!presentation.hasAppearance(appearance)) {
          issues.push(`${scenario.id}.${instance.id} references unknown appearance ${appearance}.`);
        }
      }
    }

    return issues;
  }

  function validateTerrainLibrary() {
    const types = window.CROSSROADS_TERRAIN_TYPES;
    const scenarios = window.CROSSROADS_SCENARIOS;
    if (!types || !scenarios) return [];

    const issues = [];
    for (const scenario of Object.values(scenarios)) {
      if (!Array.isArray(scenario.terrain)) {
        issues.push(`${scenario.id}.terrain must be an instance array.`);
        continue;
      }

      const ids = new Set();
      for (const instance of scenario.terrain) {
        if (!instance?.id) issues.push(`${scenario.id} has terrain without an instance id.`);
        if (ids.has(instance?.id)) issues.push(`${scenario.id} duplicates terrain id ${instance.id}.`);
        ids.add(instance?.id);
        if (!types[instance?.terrainId]) {
          issues.push(`${scenario.id}.${instance?.id} references unknown terrain ${instance?.terrainId}.`);
        }
        for (const field of ["x", "y", "width", "height"]) {
          if (!Number.isFinite(Number(instance?.[field]))) {
            issues.push(`${scenario.id}.${instance?.id} has invalid ${field}.`);
          }
        }
        if (Number(instance?.width) <= 0 || Number(instance?.height) <= 0) {
          issues.push(`${scenario.id}.${instance?.id} must have a positive footprint.`);
        }
        if (instance?.rotation !== undefined && !Number.isFinite(Number(instance.rotation))) {
          issues.push(`${scenario.id}.${instance?.id} has invalid rotation.`);
        }
      }

      const occupiableIds = scenario.terrain
        .filter(instance => types[instance.terrainId]?.rules?.occupiable)
        .map(instance => instance.id);
      if (new Set(occupiableIds).size !== occupiableIds.length) {
        issues.push(`${scenario.id} has duplicate occupiable-building ids.`);
      }
    }
    return issues;
  }

  function validateUnitTypes() {
    const types = window.CROSSROADS_UNIT_TYPES;
    if (!types) return [];
    const issues = [];
    for (const [typeId, type] of Object.entries(types)) {
      if (!type.short) issues.push(`Unit type ${typeId} is missing short label.`);
      if (!Number.isInteger(type.soldiers) || type.soldiers < 1) {
        issues.push(`Unit type ${typeId} has invalid soldier count.`);
      }
      const weaponModels = Object.values(type.weapons ?? {}).reduce(
        (sum, count) => sum + Math.max(0, Number(count) || 0),
        0
      );
      if (weaponModels > type.soldiers && type.role !== "support") {
        issues.push(`Unit type ${typeId} assigns more weapons than soldiers.`);
      }
    }
    return issues;
  }

  function validateCombatModules() {
    const issues = [];
    if (typeof window.CrossroadsMoraleRules?.create !== "function") {
      issues.push("Morale rules module is missing its create() factory.");
    }
    if (typeof window.CrossroadsShootingRules?.create !== "function") {
      issues.push("Shooting rules module is missing its create() factory.");
    }
    if (typeof window.CrossroadsCombatIntegration?.isInstalled !== "function") {
      issues.push("Combat integration module is missing its installation diagnostic.");
    }
    if (typeof window.CrossroadsCombatIntegration?.getMoraleRules !== "function") {
      issues.push("Combat integration cannot expose the active morale rules.");
    }
    if (typeof window.CrossroadsCombatIntegration?.getShootingRules !== "function") {
      issues.push("Combat integration cannot expose the active shooting rules.");
    }
    return issues;
  }

  function inspect() {
    const missing = requirements
      .filter(([globalName]) => !window[globalName])
      .map(([globalName, source]) => Object.freeze({ globalName, source }));

    const invalid = missing.length
      ? []
      : [
          ...validateFactionKits(),
          ...validateScenarioKits(),
          ...validateBuildingPresentation(),
          ...validateTerrainLibrary(),
          ...validateUnitTypes(),
          ...validateCombatModules()
        ];

    return Object.freeze({
      ok: missing.length === 0 && invalid.length === 0,
      checked: requirements.length,
      missing: Object.freeze(missing),
      invalid: Object.freeze(invalid),
      timestamp: new Date().toISOString()
    });
  }

  function assertReady() {
    const report = inspect();
    window.CROSSROADS_STARTUP_VALIDATION = report;

    if (!report.ok) {
      const missing = report.missing
        .map(item => `${item.globalName} (${item.source})`)
        .join(", ");
      const invalid = report.invalid.join("; ");
      const details = [missing, invalid].filter(Boolean).join("; ");
      throw new Error(`Crossroads startup validation failed. ${details}`);
    }

    return report;
  }

  window.CrossroadsStartupValidation = Object.freeze({ inspect, assertReady });
  assertReady();
})();
