"use strict";

(() => {
  const MIGRATIONS = window.CrossroadsScenarioMigrations;
  if (!MIGRATIONS) throw new Error("Scenario migrations must load before scenario-schema.js.");

  const WOODLAND_DEFAULTS = Object.freeze({
    woods:Object.freeze({ type:"woodland", seed:1842, density:.68, spacing:2.4, edgePadding:.8, scaleVariation:.12, rotationVariation:10 }),
    woods_dense:Object.freeze({ type:"woodland", seed:2842, density:.88, spacing:1.85, edgePadding:.65, scaleVariation:.10, rotationVariation:8 }),
    orchard:Object.freeze({ type:"orchard", seed:3842, density:.72, spacing:2.8, edgePadding:.9, scaleVariation:.05, rotationVariation:0, rowAngle:0, rowSpacing:3.1 })
  });

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizePlaceable(item, collection) {
    if (!item || typeof item !== "object") return item;
    item.visible = item.visible !== false;
    item.locked = item.locked === true;
    delete item.hidden;
    if (["terrain", "linearTerrain", "terrainPatches", "unit"].includes(collection)) {
      item.inheritLayer = item.inheritLayer !== false;
      if (item.inheritLayer) delete item.layerOrder;
    }
    return item;
  }

  function normalizeWoodlandGenerator(patch) {
    const defaults = WOODLAND_DEFAULTS[patch?.styleId];
    if (!defaults) return patch;
    const source = patch.generator && typeof patch.generator === "object" ? patch.generator : {};
    patch.generator = {
      type:source.type || defaults.type,
      seed:Math.trunc(number(source.seed, defaults.seed)),
      density:Math.max(.05, Math.min(1.5, number(source.density, defaults.density))),
      spacing:Math.max(.4, number(source.spacing, defaults.spacing)),
      edgePadding:Math.max(0, number(source.edgePadding, defaults.edgePadding)),
      scaleVariation:Math.max(0, Math.min(.5, number(source.scaleVariation, defaults.scaleVariation))),
      rotationVariation:Math.max(0, Math.min(180, number(source.rotationVariation, defaults.rotationVariation)))
    };
    if (defaults.type === "orchard") {
      patch.generator.rowAngle = number(source.rowAngle, defaults.rowAngle);
      patch.generator.rowSpacing = Math.max(.5, number(source.rowSpacing, defaults.rowSpacing));
    }
    return patch;
  }

  function normalize(source) {
    const scenario = MIGRATIONS.migrate(source);
    scenario.schemaVersion = MIGRATIONS.CURRENT_VERSION;
    scenario.id = String(scenario.id || "untitled-scenario");
    scenario.title = String(scenario.title || "Untitled Scenario");
    scenario.rounds = Math.max(1, number(scenario.rounds, 6));
    scenario.table = scenario.table && typeof scenario.table === "object" ? scenario.table : { width:72, height:48, mat:"grass_temperate" };
    scenario.table.width = Math.max(1, number(scenario.table.width, 72));
    scenario.table.height = Math.max(1, number(scenario.table.height, 48));
    for (const key of ["terrain", "linearTerrain", "terrainPatches", "junctions", "crossings", "objectives"]) {
      scenario[key] = Array.isArray(scenario[key]) ? scenario[key] : [];
      scenario[key].forEach(item => normalizePlaceable(item, key));
    }
    scenario.terrainPatches.forEach(normalizeWoodlandGenerator);
    scenario.forces = scenario.forces && typeof scenario.forces === "object" ? scenario.forces : {};
    scenario.deployment = scenario.deployment && typeof scenario.deployment === "object" ? scenario.deployment : { mode:"player", order:["blue", "red"], zones:{} };
    scenario.deployment.zones = scenario.deployment.zones && typeof scenario.deployment.zones === "object" ? scenario.deployment.zones : {};
    for (const faction of ["blue", "red"]) {
      scenario.forces[faction] = Array.isArray(scenario.forces[faction]) ? scenario.forces[faction] : [];
      scenario.forces[faction].forEach(item => normalizePlaceable(item, "unit"));
      const zone = scenario.deployment.zones[faction];
      if (zone) {
        normalizePlaceable(zone, "zone");
        for (const subzone of zone.subzones ?? []) normalizePlaceable(subzone, "zone");
      }
    }
    return scenario;
  }

  window.CrossroadsScenarioSchema = Object.freeze({ CURRENT_VERSION:MIGRATIONS.CURRENT_VERSION, WOODLAND_DEFAULTS, normalize, normalizeWoodlandGenerator });
})();
