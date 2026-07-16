"use strict";

(() => {
  const requirements = Object.freeze([
    ["CROSSROADS_BUILD_INFO", "data/build-info.js"],
    ["CROSSROADS_STAGE", "data/stage.js"],
    ["CROSSROADS_WEAPON_PROFILES", "data/weapons.js"],
    ["CROSSROADS_TERRAIN", "data/terrain.js"],
    ["CROSSROADS_UNIT_QUALITY", "data/unit-quality.js"],
    ["CROSSROADS_UNIT_TYPES", "data/unit-types.js"],
    ["CROSSROADS_FACTION_KITS", "data/faction-kits.js"],
    ["CROSSROADS_FORMATIONS", "data/formations.js"],
    ["CROSSROADS_SCENARIOS", "data/scenarios.js"],
    ["CROSSROADS_CORE_SCENARIO_12A", "data/scenarios.js"],
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
    ["CrossroadsMovementRules", "src/rules/movement.js"]
  ]);

  const SAFE_TOKEN = /^[a-z0-9_-]+$/;
  const REQUIRED_WEAPONS = Object.freeze(["rifle", "smg", "lmg", "pistol", "mmg"]);

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
      if (!SAFE_TOKEN.test(kit.cssClass ?? "")) {
        issues.push(`Faction kit ${kitId} has unsafe cssClass ${kit.cssClass}.`);
      }
      for (const field of ["helmet", "legwear", "webbing", "load"]) {
        if (!SAFE_TOKEN.test(kit.defaults?.[field] ?? "")) {
          issues.push(`Faction kit ${kitId} has invalid default ${field}.`);
        }
      }
      for (const weapon of REQUIRED_WEAPONS) {
        if (!SAFE_TOKEN.test(kit.weapons?.[weapon] ?? "")) {
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

  function inspect() {
    const missing = requirements
      .filter(([globalName]) => !window[globalName])
      .map(([globalName, source]) => Object.freeze({ globalName, source }));

    const invalid = missing.length
      ? []
      : [
          ...validateFactionKits(),
          ...validateScenarioKits(),
          ...validateUnitTypes()
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
