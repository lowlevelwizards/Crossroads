"use strict";

(() => {
  const CURRENT_VERSION = 1;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function visitPlaceables(scenario, callback) {
    for (const key of ["terrain", "linearTerrain", "terrainPatches", "junctions", "crossings", "objectives"]) {
      for (const item of scenario?.[key] ?? []) callback(item, key);
    }
    for (const faction of ["blue", "red"]) {
      for (const unit of scenario?.forces?.[faction] ?? []) callback(unit, "unit", faction);
      const zone = scenario?.deployment?.zones?.[faction];
      if (zone) {
        callback(zone, "zone", faction);
        for (const subzone of zone.subzones ?? []) callback(subzone, "zone", faction);
      }
    }
  }

  function migrate(source) {
    const scenario = clone(source) || {};
    let version = Math.max(0, Number(scenario?.schemaVersion) || 0);
    if (version < 1) {
      // Keep this explicit so later migrations can be appended without rewriting old logic.
      visitPlaceables(scenario, (item, collection) => {
        if (!item || typeof item !== "object") return;
        if (item.visible === undefined) item.visible = item.hidden !== true;
        delete item.hidden;
        if (item.locked === undefined) item.locked = false;
        if (["terrain", "linearTerrain", "terrainPatches", "unit"].includes(collection) && item.inheritLayer === undefined) item.inheritLayer = true;
      });
      scenario.schemaVersion = 1;
      version = 1;
    }
    if (version > CURRENT_VERSION) throw new Error(`Scenario schema ${version} is newer than supported schema ${CURRENT_VERSION}.`);
    return scenario;
  }

  window.CrossroadsScenarioMigrations = Object.freeze({ CURRENT_VERSION, clone, migrate, visitPlaceables });
})();
