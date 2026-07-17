"use strict";

(() => {
  const OBJECTIVE_TYPES = new Set(["control_zone", "control_group", "crossing", "exit_unit", "destroy_target", "protect_target", "unit_objective", "custom"]);
  const SCENARIO_TYPES = new Set(["control", "breakthrough", "delay", "elimination", "survival", "escort", "custom"]);

  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function pointInside(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  function expanded(rect, amount) {
    return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
  }

  function visualRect(instance) {
    return { x:number(instance.x), y:number(instance.y), width:number(instance.width), height:number(instance.height) };
  }

  function rulesRect(instance, terrainTypes) {
    const definition = terrainTypes?.[instance.terrainId];
    const visual = visualRect(instance);
    const footprint = definition?.presentation?.footprint;
    if (!footprint) return visual;
    const scale = Math.max(0.25, number(instance.visualScale, 1));
    const baseWidth = visual.width * number(footprint.width, 1);
    const baseHeight = visual.height * number(footprint.height, 1);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    const centerX = visual.x + visual.width * (number(footprint.x) + number(footprint.width, 1) / 2);
    const centerY = visual.y + visual.height * (number(footprint.y) + number(footprint.height, 1) / 2);
    return { x:centerX - width / 2, y:centerY - height / 2, width, height };
  }

  function zoneById(zone, id) {
    if (!zone) return null;
    if (!id) return zone;
    if (String(zone.id || "") === String(id)) return zone;
    return (zone.subzones ?? []).find(candidate => String(candidate.id || "") === String(id)) ?? zone;
  }

  function pointInZone(point, zone) {
    return Boolean(zone && point.x >= number(zone.xMin) && point.x <= number(zone.xMax) && point.y >= number(zone.yMin) && point.y <= number(zone.yMax));
  }

  function issue(level, code, message, selection = null) {
    return Object.freeze({ level, code, message, selection });
  }

  function validateScenario(scenario, dependencies = {}) {
    const terrainTypes = dependencies.terrainTypes ?? window.CROSSROADS_TERRAIN_TYPES ?? {};
    const linearStyles = dependencies.linearStyles ?? window.CROSSROADS_LINEAR_TERRAIN_STYLES ?? {};
    const unitTypes = dependencies.unitTypes ?? window.CROSSROADS_UNIT_TYPES ?? {};
    const pathGeometry = dependencies.pathGeometry ?? window.CrossroadsPathGeometry;
    const table = scenario?.table ?? {};
    const width = number(table.width);
    const height = number(table.height);
    const issues = [];
    const scenarioType = String(scenario?.victory?.type || scenario?.scoring?.type || "control");
    if (scenarioType && !SCENARIO_TYPES.has(scenarioType) && scenarioType !== "control_group") {
      issues.push(issue("warning", "scenario-type", `Unknown scenario type: ${scenarioType}.`));
    }

    if (width <= 0 || height <= 0) {
      issues.push(issue("error", "table-size", "Table width and height must be greater than zero."));
      return issues;
    }

    const ids = new Set();
    function registerId(id, selection) {
      const key = String(id || "").trim();
      if (!key) {
        issues.push(issue("error", "missing-id", "An object is missing an ID.", selection));
        return;
      }
      if (ids.has(key)) issues.push(issue("error", "duplicate-id", `Duplicate object ID: ${key}.`, selection));
      ids.add(key);
    }

    const hardTerrain = [];
    for (const terrain of scenario.terrain ?? []) {
      const selection = { kind:"terrain", id:terrain.id };
      registerId(terrain.id, selection);
      const definition = terrainTypes[terrain.terrainId];
      if (!definition) {
        issues.push(issue("error", "unknown-terrain", `Unknown terrain type: ${terrain.terrainId}.`, selection));
        continue;
      }
      const rect = visualRect(terrain);
      if (rect.width <= 0 || rect.height <= 0) issues.push(issue("error", "terrain-size", `${terrain.id} has a zero or negative size.`, selection));
      if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > width || rect.y + rect.height > height) {
        issues.push(issue("warning", "terrain-bounds", `${terrain.id} extends beyond the table.`, selection));
      }
      if (definition.rules?.movement === "impassable") hardTerrain.push({ terrain, rect:rulesRect(terrain, terrainTypes) });
    }

    const junctions = scenario.junctions ?? [];
    for (const path of scenario.linearTerrain ?? []) {
      const selection = { kind:"linear", id:path.id };
      registerId(path.id, selection);
      if (!linearStyles[path.styleId]) issues.push(issue("error", "unknown-linear-style", `Unknown path style: ${path.styleId}.`, selection));
      if (!Array.isArray(path.points) || path.points.length < 2) {
        issues.push(issue("error", "path-points", `${path.id} needs at least two waypoints.`, selection));
        continue;
      }
      path.points.forEach((point, index) => {
        const isStart = index === 0;
        const isEnd = index === path.points.length - 1;
        const intentionallyOffTable = (isStart && path.start?.cap === "off_table") || (isEnd && path.end?.cap === "off_table");
        if (!intentionallyOffTable && (number(point.x, -1) < 0 || number(point.y, -1) < 0 || number(point.x) > width || number(point.y) > height)) {
          issues.push(issue("warning", "waypoint-bounds", `${path.id} waypoint ${index + 1} is outside the table.`, { ...selection, pointIndex:index }));
        }
      });
      for (const [endpointName, point] of [["start", path.points[0]], ["end", path.points[path.points.length - 1]]]) {
        if (path[endpointName]?.cap !== "junction") continue;
        const attachedToJunction = junctions.some(junction => Math.hypot(number(junction.x) - number(point.x), number(junction.y) - number(point.y)) <= Math.max(1, number(junction.radius, 2)));
        const attachedToCrossing = (scenario.terrain ?? []).some(terrain => {
          if (!String(terrain.terrainId || "").includes("crossing")) return false;
          return pointInside(point, expanded(visualRect(terrain), 1.25));
        });
        const attachedToPath = (scenario.linearTerrain ?? []).some(other => {
          if (other === path || !Array.isArray(other.points) || !other.points.length) return false;
          const endpoints = [other.points[0], other.points[other.points.length - 1]];
          return endpoints.some(candidate => Math.hypot(number(candidate.x) - number(point.x), number(candidate.y) - number(point.y)) <= 1.25);
        });
        if (!attachedToJunction && !attachedToCrossing && !attachedToPath) {
          issues.push(issue("warning", "orphan-junction-cap", `${path.id} has a junction cap without a nearby junction or crossing.`, selection));
        }
      }
      if (pathGeometry) {
        try { pathGeometry.createPath(path); }
        catch (error) { issues.push(issue("error", "path-geometry", `${path.id}: ${error.message}`, selection)); }
      }
    }

    for (const junction of junctions) registerId(junction.id, { kind:"junction", id:junction.id });
    for (const crossing of scenario.crossings ?? []) registerId(crossing.id, { kind:"crossing", id:crossing.id });

    const units = [];
    for (const faction of ["blue", "red"]) {
      const factionZone = scenario.deployment?.zones?.[faction];
      for (const unit of scenario.forces?.[faction] ?? []) {
        const selection = { kind:"unit", id:unit.id, faction };
        registerId(unit.id, selection);
        units.push({ unit, faction, selection });
        if (!unitTypes[unit.unitType]) issues.push(issue("error", "unknown-unit", `${unit.id} uses unknown unit type ${unit.unitType}.`, selection));
        const point = { x:number(unit.x), y:number(unit.y) };
        if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) issues.push(issue("error", "unit-bounds", `${unit.id} is outside the table.`, selection));
        const intendedZone = zoneById(factionZone, unit.deploymentZone);
        if (intendedZone && !pointInZone(point, intendedZone)) issues.push(issue("warning", "unit-zone", `${unit.id} is outside its deployment zone.`, selection));
        for (const hard of hardTerrain) {
          if (pointInside(point, expanded(hard.rect, 0.55))) {
            issues.push(issue("error", "unit-hard-terrain", `${unit.id} overlaps ${hard.terrain.id}.`, selection));
            break;
          }
        }
      }
    }

    for (let left = 0; left < units.length; left += 1) {
      for (let right = left + 1; right < units.length; right += 1) {
        const a = units[left];
        const b = units[right];
        if (Math.hypot(number(a.unit.x) - number(b.unit.x), number(a.unit.y) - number(b.unit.y)) < 1.5) {
          issues.push(issue("warning", "unit-overlap", `${a.unit.id} and ${b.unit.id} are too close together.`, a.selection));
        }
      }
    }

    for (const objective of scenario.objectives ?? []) {
      const selection = { kind:"objective", id:objective.id };
      registerId(objective.id, selection);
      const objectiveType = objective.type || "control_zone";
      if (!OBJECTIVE_TYPES.has(objectiveType)) issues.push(issue("error", "objective-type", `${objective.id} uses unknown objective type ${objectiveType}.`, selection));
      if (objectiveType === "control_group" && (!Array.isArray(objective.points) || !objective.points.length)) {
        issues.push(issue("error", "objective-points", `${objective.id} needs at least one control point.`, selection));
      }
      if (objectiveType === "exit_unit") {
        if (!["blue", "red", "top", "bottom"].includes(objective.edge)) issues.push(issue("error", "objective-edge", `${objective.id} needs a valid exit edge.`, selection));
        if (!["blue", "red"].includes(objective.faction)) issues.push(issue("error", "objective-faction", `${objective.id} needs a valid faction.`, selection));
      }
      if ((objectiveType === "destroy_target" || objectiveType === "protect_target") && !String(objective.targetId || "").trim()) {
        issues.push(issue("warning", "objective-target", `${objective.id} has no target object ID.`, selection));
      }
      if (objectiveType === "unit_objective" && !String(objective.unitId || "").trim()) {
        issues.push(issue("warning", "objective-unit", `${objective.id} has no target unit ID.`, selection));
      }
      const points = objectiveType === "control_group" ? objective.points ?? [] : [objective];
      for (const point of points) {
        const location = { x:number(point.x), y:number(point.y) };
        if (location.x < 0 || location.y < 0 || location.x > width || location.y > height) {
          issues.push(issue("error", "objective-bounds", `${point.label || objective.id} is outside the table.`, selection));
        }
        const blocker = hardTerrain.find(hard => pointInside(location, hard.rect));
        if (blocker) issues.push(issue("warning", "objective-hard-terrain", `${point.label || objective.id} overlaps ${blocker.terrain.id}.`, selection));
      }
    }

    return issues;
  }

  window.CrossroadsEditorValidation = Object.freeze({ validateScenario, rulesRect, pointInside, pointInZone });
})();
