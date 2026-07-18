"use strict";

(() => {
  const SCHEMA = window.CrossroadsScenarioSchema;
  const VISIBILITY = window.CrossroadsScenarioVisibility;
  if (!SCHEMA || !VISIBILITY) throw new Error("Scenario schema and visibility modules must load before editor-document.js.");

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function assertScenario(source) {
    if (!source || typeof source !== "object") throw new Error("A scenario object is required.");
    if (!source.table || Number(source.table.width) <= 0 || Number(source.table.height) <= 0) {
      throw new Error("Scenario table dimensions are invalid.");
    }
  }

  function create(source) {
    assertScenario(source);
    const document = SCHEMA.normalize(source);
    document.id = String(document.id || "untitled-scenario");
    document.title = String(document.title || "Untitled Scenario");
    document.rounds = Math.max(1, Number(document.rounds) || 6);
    document.terrain = Array.isArray(document.terrain) ? document.terrain : [];
    document.linearTerrain = Array.isArray(document.linearTerrain) ? document.linearTerrain : [];
    document.terrainPatches = Array.isArray(document.terrainPatches) ? document.terrainPatches : [];
    document.junctions = Array.isArray(document.junctions) ? document.junctions : [];
    document.crossings = Array.isArray(document.crossings) ? document.crossings : [];
    document.objectives = Array.isArray(document.objectives) ? document.objectives : [];
    document.forces = document.forces && typeof document.forces === "object" ? document.forces : { blue: [], red: [] };
    document.forces.blue = Array.isArray(document.forces.blue) ? document.forces.blue : [];
    document.forces.red = Array.isArray(document.forces.red) ? document.forces.red : [];
    document.factions = document.factions && typeof document.factions === "object" ? document.factions : {};
    document.factions.blue = document.factions.blue ?? { name:"Blue Force", shortName:"Blue" };
    document.factions.red = document.factions.red ?? { name:"Red Force", shortName:"Red" };
    document.deployment = document.deployment && typeof document.deployment === "object" ? document.deployment : { mode:"player", order:["blue", "red"], zones:{} };
    document.deployment.zones = document.deployment.zones && typeof document.deployment.zones === "object" ? document.deployment.zones : {};
    document.structure = document.structure && typeof document.structure === "object" ? document.structure : { templateId:"custom", roles:{} };
    document.victory = document.victory && typeof document.victory === "object" ? document.victory : { policy:"points", elimination:true, tiebreaker:"survivingUnits" };
    return document;
  }

  function createBlankScenario(options = {}) {
    const width = Math.max(12, Number(options.width) || 72);
    const height = Math.max(12, Number(options.height) || 48);
    const zoneDepth = Math.min(12, width / 4);
    const type = String(options.type || "control");
    return create({
      id:String(options.id || "untitled-scenario"),
      title:String(options.title || "Untitled Scenario"),
      schemaVersion:SCHEMA.CURRENT_VERSION,
      description:"Created in Scenario Composer S1.0.",
      rounds:Math.max(1, Number(options.rounds) || 6),
      table:{ width, height, mat:"grass_temperate" },
      factions:{
        blue:{ name:"Blue Force", shortName:"Blue" },
        red:{ name:"Red Force", shortName:"Red" }
      },
      terrain:[], linearTerrain:[], terrainPatches:[], junctions:[], crossings:[], objectives:[],
      deployment:{
        mode:"player",
        order:[String(options.startingFaction || "blue"), String(options.startingFaction || "blue") === "blue" ? "red" : "blue"],
        zones:{
          blue:{ id:"blue-deployment", label:"Blue Deployment", xMin:0, xMax:zoneDepth, yMin:0, yMax:height },
          red:{ id:"red-deployment", label:"Red Deployment", xMin:width - zoneDepth, xMax:width, yMin:0, yMax:height }
        }
      },
      forces:{ blue:[], red:[] },
      structure:{ templateId:type, roles:type === "breakthrough" || type === "delay" ? { attacker:"red", defender:"blue" } : {} },
      victory:{ policy:"points", elimination:type === "elimination" || type === "control", tiebreaker:"survivingUnits" }
    });
  }

  function allIds(document) {
    const result = new Set();
    for (const collection of [document.terrain, document.linearTerrain, document.terrainPatches, document.junctions, document.crossings, document.objectives]) {
      for (const item of collection ?? []) if (item?.id) result.add(String(item.id));
    }
    for (const faction of ["blue", "red"]) {
      for (const unit of document.forces?.[faction] ?? []) if (unit?.id) result.add(String(unit.id));
    }
    return result;
  }

  function nextId(document, prefix) {
    const safePrefix = String(prefix || "item").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
    const ids = allIds(document);
    if (!ids.has(safePrefix)) return safePrefix;
    let suffix = 2;
    while (ids.has(`${safePrefix}-${suffix}`)) suffix += 1;
    return `${safePrefix}-${suffix}`;
  }

  function collectionFor(document, kind, faction = null) {
    if (kind === "terrain") return document.terrain;
    if (kind === "linear") return document.linearTerrain;
    if (kind === "patch") return document.terrainPatches;
    if (kind === "junction") return document.junctions;
    if (kind === "crossing") return document.crossings;
    if (kind === "objective") return document.objectives;
    if (kind === "unit") return document.forces?.[faction] ?? [];
    return null;
  }

  function find(document, selection) {
    if (!selection?.kind || !selection?.id) return null;
    const collection = collectionFor(document, selection.kind, selection.faction);
    return collection?.find(item => String(item.id) === String(selection.id)) ?? null;
  }

  function remove(document, selection) {
    const collection = collectionFor(document, selection?.kind, selection?.faction);
    if (!collection) return false;
    const index = collection.findIndex(item => String(item.id) === String(selection.id));
    if (index < 0) return false;
    collection.splice(index, 1);
    return true;
  }

  function duplicate(document, selection) {
    const source = find(document, selection);
    const collection = collectionFor(document, selection?.kind, selection?.faction);
    if (!source || !collection) return null;
    const copy = clone(source);
    copy.id = nextId(document, `${source.id}-copy`);
    if (Number.isFinite(Number(copy.x))) copy.x = Number(copy.x) + 1;
    if (Number.isFinite(Number(copy.y))) copy.y = Number(copy.y) + 1;
    if (Array.isArray(copy.points)) copy.points = copy.points.map(point => ({ ...point, x:Number(point.x) + 1, y:Number(point.y) + 1 }));
    collection.push(copy);
    return copy;
  }


  function copySelections(document, selections = []) {
    const seen = new Set();
    const items = [];
    for (const selection of selections) {
      if (!selection || selection.kind === "zone") continue;
      const key = `${selection.kind}:${selection.faction || ""}:${selection.id || ""}`;
      if (seen.has(key)) continue;
      const item = find(document, selection);
      if (!item) continue;
      seen.add(key);
      items.push({ selection:{ kind:selection.kind, id:selection.id, faction:selection.faction }, item:clone(item) });
    }
    return Object.freeze({ schemaVersion:1, items:Object.freeze(items) });
  }

  function pasteSelections(document, payload, offset = { x:1, y:1 }) {
    const sourceItems = Array.isArray(payload?.items) ? payload.items : [];
    const idMap = new Map();
    const prepared = [];
    for (const entry of sourceItems) {
      const selection = entry?.selection;
      if (!selection?.kind || selection.kind === "zone" || !entry.item) continue;
      const item = clone(entry.item);
      const oldId = String(item.id || selection.id || selection.kind);
      item.id = nextId(document, `${oldId}-copy`);
      idMap.set(oldId, item.id);
      prepared.push({ selection, item });
    }
    const result = [];
    for (const entry of prepared) {
      const selection = entry.selection;
      const item = entry.item;
      if (Number.isFinite(Number(item.x))) item.x = Number(item.x) + Number(offset.x || 0);
      if (Number.isFinite(Number(item.y))) item.y = Number(item.y) + Number(offset.y || 0);
      if (Number.isFinite(Number(item.xMin))) { item.xMin = Number(item.xMin) + Number(offset.x || 0); item.xMax = Number(item.xMax) + Number(offset.x || 0); }
      if (Number.isFinite(Number(item.yMin))) { item.yMin = Number(item.yMin) + Number(offset.y || 0); item.yMax = Number(item.yMax) + Number(offset.y || 0); }
      if (Array.isArray(item.points)) item.points = item.points.map(point => ({ ...point, x:Number(point.x)+Number(offset.x || 0), y:Number(point.y)+Number(offset.y || 0) }));
      for (const field of ["targetId", "unitId", "pathId"]) if (item[field] && idMap.has(String(item[field]))) item[field] = idMap.get(String(item[field]));
      const collection = collectionFor(document, selection.kind, selection.faction);
      if (!collection) continue;
      collection.push(item);
      result.push({ kind:selection.kind, id:item.id, faction:selection.faction });
    }
    return result;
  }

  function insertLinearWaypoint(document, pathId, segmentIndex, point = null) {
    const path = find(document, { kind:"linear", id:pathId });
    const index = Number(segmentIndex);
    if (!path || !Array.isArray(path.points) || index < 0 || index >= path.points.length - 1) return null;
    const a = path.points[index];
    const b = path.points[index + 1];
    const inserted = point ? { x:Number(point.x), y:Number(point.y) } : { x:(Number(a.x) + Number(b.x)) / 2, y:(Number(a.y) + Number(b.y)) / 2 };
    path.points.splice(index + 1, 0, inserted);
    return inserted;
  }

  function deleteLinearSegment(document, pathId, segmentIndex) {
    const collection = document.linearTerrain ?? [];
    const pathIndex = collection.findIndex(item => String(item.id) === String(pathId));
    const path = collection[pathIndex];
    const index = Number(segmentIndex);
    if (!path || !Array.isArray(path.points) || index < 0 || index >= path.points.length - 1) return null;
    if (path.points.length === 2) {
      collection.splice(pathIndex, 1);
      return { deleted:true, selection:null };
    }
    if (index === 0) {
      path.points.shift();
      return { deleted:false, selection:{ kind:"linear", id:path.id, segmentIndex:0 } };
    }
    if (index === path.points.length - 2) {
      path.points.pop();
      return { deleted:false, selection:{ kind:"linear", id:path.id, segmentIndex:path.points.length - 2 } };
    }
    const original = clone(path);
    const right = clone(original);
    path.points = original.points.slice(0, index + 1);
    path.end = { ...(path.end ?? {}), cap:"taper" };
    right.id = nextId(document, `${original.id}-split`);
    right.points = original.points.slice(index + 1);
    right.start = { ...(right.start ?? {}), cap:"taper" };
    collection.splice(pathIndex + 1, 0, right);
    return { deleted:false, split:true, leftId:path.id, rightId:right.id, selection:{ kind:"linear", id:right.id, segmentIndex:0 } };
  }

  function cleanNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value;
    return Math.round(number * 1000) / 1000;
  }

  function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return typeof value === "number" ? cleanNumber(value) : value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = clean(item);
    }
    return result;
  }

  function serialize(document, spacing = 2) {
    assertScenario(document);
    return JSON.stringify(clean(document), null, spacing);
  }

  function playtestScenario(document) {
    const scenario = create(document);
    const visible = VISIBILITY.isVisible;
    scenario.terrain = scenario.terrain.filter(visible);
    scenario.linearTerrain = scenario.linearTerrain.filter(visible);
    scenario.terrainPatches = scenario.terrainPatches.filter(visible);
    scenario.junctions = scenario.junctions.filter(visible);
    scenario.crossings = scenario.crossings.filter(visible);
    scenario.objectives = scenario.objectives.filter(visible);
    scenario.forces.blue = scenario.forces.blue.filter(visible);
    scenario.forces.red = scenario.forces.red.filter(visible);
    scenario.id = "editor_playtest";
    scenario.title = `${scenario.title || "Untitled Scenario"} — Editor Playtest`;
    scenario.description = `${scenario.description || ""} Current positions were launched from Terrain Editor S1.0.`.trim();
    scenario.deployment = scenario.deployment ?? { zones:{} };
    scenario.deployment.mode = "fixed";
    scenario.deployment.order = [];
    if (!scenario.objectives.length) {
      scenario.objectives.push({ id:"editor-center", type:"control_zone", label:"Table Center", x:scenario.table.width / 2, y:scenario.table.height / 2, radius:3 });
    }
    return clean(scenario);
  }

  window.CrossroadsEditorDocument = Object.freeze({
    clone,
    create,
    createBlankScenario,
    allIds,
    nextId,
    collectionFor,
    find,
    remove,
    duplicate,
    copySelections,
    pasteSelections,
    insertLinearWaypoint,
    deleteLinearSegment,
    clean,
    serialize,
    playtestScenario
  });
})();
