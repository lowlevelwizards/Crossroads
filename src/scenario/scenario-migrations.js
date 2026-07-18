"use strict";

(() => {
  const CURRENT_VERSION = 2;

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

  function normalizeObjectiveType(objective) {
    if (!objective || typeof objective !== "object") return;
    if (!objective.type) objective.type = "control_zone";
    if (objective.type === "crossing") objective.type = "control_zone";
    if (objective.type === "unit_objective") objective.type = "protect_target";
  }

  function migrateLegacyObjectives(scenario) {
    scenario.objectives = Array.isArray(scenario.objectives) ? scenario.objectives : [];
    scenario.objectives.forEach(normalizeObjectiveType);
    const legacyScoring = scenario.scoring && typeof scenario.scoring === "object" ? scenario.scoring : {};

    for (const objective of scenario.objectives) {
      if (objective.type === "control_zone") {
        objective.roundPoints = Number(objective.roundPoints ?? legacyScoring.roundControl ?? 0);
        objective.finalPoints = Number(objective.finalPoints ?? legacyScoring.finalControl ?? 0);
      }
      if (objective.type === "exit_unit") {
        objective.pointsPerUnit = Number(objective.pointsPerUnit ?? legacyScoring.exitPoints ?? 2);
        objective.containmentPointsPerUnit = Number(objective.containmentPointsPerUnit ?? legacyScoring.containmentPointsPerUnit ?? 0);
      }
      if (objective.type === "control_group" && legacyScoring.type === "control_group") {
        objective.roundScoring = objective.roundScoring ?? [
          {
            faction:"red",
            rule:"per_controlled",
            points:Number(legacyScoring.pointsPerCrossing ?? 1),
            maxPoints:Number(legacyScoring.maxCrossingPoints ?? 0) || null,
            startRound:Number(legacyScoring.startRound ?? 1)
          },
          {
            faction:"blue",
            rule:"opponent_none",
            opponent:"red",
            points:Number(legacyScoring.delayPoints ?? 0),
            startRound:Number(legacyScoring.startRound ?? 1)
          }
        ].filter(rule => rule.points > 0);
      }
    }

    if (legacyScoring.type === "control_group" && Number.isFinite(Number(legacyScoring.breakthroughLineX))) {
      scenario.objectives.push({
        id:"legacy-breakthrough-line",
        type:"presence_zone",
        label:"Breakthrough Line",
        shape:"rect",
        x:Number(legacyScoring.breakthroughLineX),
        y:0,
        width:Math.max(0, Number(scenario.table?.width ?? 72) - Number(legacyScoring.breakthroughLineX)),
        height:Number(scenario.table?.height ?? 48),
        showMarker:false,
        finalScoring:[
          { faction:"red", rule:"faction_present", points:Number(legacyScoring.breakthroughPoints ?? 0) },
          { faction:"blue", rule:"opponent_absent", opponent:"red", points:Number(legacyScoring.denialPoints ?? 0) }
        ].filter(rule => rule.points > 0)
      });
    }

    scenario.victory = scenario.victory && typeof scenario.victory === "object" ? scenario.victory : {};
    if (!scenario.victory.policy) scenario.victory.policy = "points";
    if (!scenario.victory.tiebreaker) scenario.victory.tiebreaker = "survivingUnits";
    if (scenario.victory.type === "breakthrough") scenario.victory.policy = "points";
    delete scenario.victory.type;
    delete scenario.scoring;
  }

  function migrate(source) {
    const scenario = clone(source) || {};
    let version = Math.max(0, Number(scenario?.schemaVersion) || 0);

    if (version < 1) {
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

    if (version < 2) {
      migrateLegacyObjectives(scenario);
      scenario.schemaVersion = 2;
      version = 2;
    }

    if (version > CURRENT_VERSION) throw new Error(`Scenario schema ${version} is newer than supported schema ${CURRENT_VERSION}.`);
    return scenario;
  }

  window.CrossroadsScenarioMigrations = Object.freeze({
    CURRENT_VERSION,
    clone,
    migrate,
    visitPlaceables,
    migrateLegacyObjectives
  });
})();
