"use strict";

(() => {
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
    const document = clone(source);
    document.terrain = Array.isArray(document.terrain) ? document.terrain : [];
    document.linearTerrain = Array.isArray(document.linearTerrain) ? document.linearTerrain : [];
    document.junctions = Array.isArray(document.junctions) ? document.junctions : [];
    document.crossings = Array.isArray(document.crossings) ? document.crossings : [];
    document.objectives = Array.isArray(document.objectives) ? document.objectives : [];
    document.forces = document.forces && typeof document.forces === "object"
      ? document.forces
      : { blue: [], red: [] };
    document.forces.blue = Array.isArray(document.forces.blue) ? document.forces.blue : [];
    document.forces.red = Array.isArray(document.forces.red) ? document.forces.red : [];
    return document;
  }

  function allIds(document) {
    const result = new Set();
    for (const collection of [document.terrain, document.linearTerrain, document.junctions, document.crossings, document.objectives]) {
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
    if (Array.isArray(copy.points)) {
      copy.points = copy.points.map(point => ({ x: Number(point.x) + 1, y: Number(point.y) + 1 }));
    }
    collection.push(copy);
    return copy;
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
    scenario.id = "editor_playtest";
    scenario.title = `${scenario.title || "Untitled Scenario"} — Editor Playtest`;
    scenario.description = `${scenario.description || ""} Current positions were launched from Terrain Editor E1.`.trim();
    scenario.deployment = scenario.deployment ?? { zones: {} };
    scenario.deployment.mode = "fixed";
    scenario.deployment.order = [];
    return clean(scenario);
  }

  window.CrossroadsEditorDocument = Object.freeze({
    clone,
    create,
    allIds,
    nextId,
    collectionFor,
    find,
    remove,
    duplicate,
    clean,
    serialize,
    playtestScenario
  });
})();
