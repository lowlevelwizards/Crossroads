"use strict";

(() => {
  const requirements = Object.freeze([
    ["CROSSROADS_BUILD_INFO", "data/build-info.js"],
    ["CROSSROADS_STAGE", "data/stage.js"],
    ["CROSSROADS_WEAPON_PROFILES", "data/weapons.js"],
    ["CROSSROADS_TERRAIN", "data/terrain.js"],
    ["CROSSROADS_UNIT_QUALITY", "data/unit-quality.js"],
    ["CROSSROADS_UNIT_TYPES", "data/unit-types.js"],
    ["CROSSROADS_SCENARIOS", "data/scenarios.js"],
    ["CROSSROADS_CORE_SCENARIO_12A", "data/scenarios.js"],
    ["CrossroadsCommands", "src/infrastructure/commands.js"],
    ["CrossroadsUnitPresentation", "src/presentation/units.js"],
    ["CrossroadsBattlefieldPresentation", "src/presentation/battlefield.js"],
    ["CrossroadsCamera", "src/camera/camera.js"],
    ["CrossroadsCoordinates", "src/camera/coordinates.js"],
    ["CrossroadsCameraInput", "src/input/camera-input.js"],
    ["CrossroadsBattlefieldInput", "src/input/battlefield-input.js"],
    ["CrossroadsMovementRules", "src/rules/movement.js"]
  ]);

  function inspect() {
    const missing = requirements
      .filter(([globalName]) => !window[globalName])
      .map(([globalName, source]) => Object.freeze({
        globalName,
        source
      }));

    return Object.freeze({
      ok: missing.length === 0,
      checked: requirements.length,
      missing: Object.freeze(missing),
      timestamp: new Date().toISOString()
    });
  }

  function assertReady() {
    const report = inspect();
    window.CROSSROADS_STARTUP_VALIDATION = report;

    if (!report.ok) {
      const details = report.missing
        .map(item => `${item.globalName} (${item.source})`)
        .join(", ");

      throw new Error(
        `Crossroads startup validation failed. Missing: ${details}`
      );
    }

    return report;
  }

  window.CrossroadsStartupValidation = Object.freeze({
    inspect,
    assertReady
  });

  assertReady();
})();
