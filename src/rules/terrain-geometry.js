"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  let activeInstances = Object.freeze([]);

  function normalizedRect(instance, definition) {
    const visual = {
      x: Number(instance.x) || 0,
      y: Number(instance.y) || 0,
      width: Number(instance.width) || 0,
      height: Number(instance.height) || 0
    };
    const footprint = definition?.presentation?.footprint;
    if (!footprint) return visual;
    return {
      x: visual.x + visual.width * (Number(footprint.x) || 0),
      y: visual.y + visual.height * (Number(footprint.y) || 0),
      width: visual.width * (Number(footprint.width) || 1),
      height: visual.height * (Number(footprint.height) || 1)
    };
  }

  function normalize(instance) {
    const definition = TYPE_DEFINITIONS?.[instance?.terrainId];
    if (!definition) throw new Error(`Unknown terrain type: ${instance?.terrainId}`);
    const visualRect = Object.freeze({
      x: Number(instance.x) || 0,
      y: Number(instance.y) || 0,
      width: Number(instance.width) || 0,
      height: Number(instance.height) || 0
    });
    const rulesRect = normalizedRect(instance, definition);
    return Object.freeze({
      ...instance,
      ...rulesRect,
      visualRect,
      rotation: Number(instance.rotation) || 0,
      definition,
      rules: definition.rules ?? Object.freeze({})
    });
  }

  function setActiveScenario(scenario) {
    activeInstances = Object.freeze((scenario?.terrain ?? []).map(normalize));
    return activeInstances;
  }

  function all() { return activeInstances; }
  function get(id) { return activeInstances.find(instance => instance.id === id) ?? null; }
  function matching(predicate) { return activeInstances.filter(predicate); }
  function byFamily(family) { return matching(instance => instance.definition.family === family); }
  function byRenderer(renderer) { return matching(instance => instance.definition.renderer === renderer); }
  function buildings() { return matching(instance => Boolean(instance.rules.occupiable)); }
  function blocking() { return matching(instance => instance.rules.los === "blocking"); }
  function rough() { return matching(instance => instance.rules.movement === "rough"); }
  function walls() { return matching(instance => instance.rules.movement === "crossing"); }

  function pointInside(point, rect) {
    return Boolean(point && rect &&
      point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height);
  }

  function expand(rect, amount) {
    return {
      ...rect,
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2
    };
  }

  function containingPoint(point, predicate = () => true) {
    return activeInstances.find(instance => predicate(instance) && pointInside(point, instance)) ?? null;
  }

  function buildingContainingPoint(point) {
    return containingPoint(point, instance => Boolean(instance.rules.occupiable));
  }

  function center(instance) {
    return { x: instance.x + instance.width / 2, y: instance.y + instance.height / 2 };
  }

  function resolve(instanceOrId) {
    return typeof instanceOrId === "string" ? get(instanceOrId) : instanceOrId;
  }

  function rotateVector(vector, degrees) {
    const radians = (Number(degrees) || 0) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return {
      x: vector.x * cosine - vector.y * sine,
      y: vector.x * sine + vector.y * cosine
    };
  }

  function entryDefinition(instanceOrId) {
    const instance = resolve(instanceOrId);
    const presentation = instance?.definition?.presentation ?? {};
    return {
      instance,
      anchor: presentation.entryAnchor ?? { x: 0.5, y: 1 },
      normal: presentation.entryNormal ?? { x: 0, y: 1 }
    };
  }

  function entryPoint(instanceOrId, outward = 0.15) {
    const { instance, anchor, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x: 0, y: 0 };
    const localAnchor = {
      x: (Number(anchor.x) - 0.5) * instance.width,
      y: (Number(anchor.y) - 0.5) * instance.height
    };
    const rotatedAnchor = rotateVector(localAnchor, instance.rotation);
    const rotatedNormal = rotateVector(
      { x: Number(normal.x) || 0, y: Number(normal.y) || 0 },
      instance.rotation
    );
    const origin = center(instance);
    return {
      x: origin.x + rotatedAnchor.x + rotatedNormal.x * outward,
      y: origin.y + rotatedAnchor.y + rotatedNormal.y * outward
    };
  }

  function approachPoint(instanceOrId, distance = 1.8) {
    const { instance, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x: 0, y: 0 };
    const door = entryPoint(instance, 0.15);
    const rotatedNormal = rotateVector(
      { x: Number(normal.x) || 0, y: Number(normal.y) || 0 },
      instance.rotation
    );
    return {
      x: door.x + rotatedNormal.x * distance,
      y: door.y + rotatedNormal.y * distance
    };
  }

  function entryMarker(instanceOrId, distance = 1.8) {
    const { instance, anchor, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x: 0.5, y: 1 };
    return {
      x: Number(anchor.x) + (Number(normal.x) || 0) * ((distance + 0.15) / instance.width),
      y: Number(anchor.y) + (Number(normal.y) || 0) * ((distance + 0.15) / instance.height)
    };
  }

  window.CrossroadsTerrainGeometry = Object.freeze({
    setActiveScenario, all, get, matching, byFamily, byRenderer, buildings,
    blocking, rough, walls, pointInside, expand, containingPoint,
    buildingContainingPoint, center, entryPoint, approachPoint, entryMarker
  });
})();
