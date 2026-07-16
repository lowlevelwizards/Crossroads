"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  let activeInstances = Object.freeze([]);

  function normalize(instance) {
    const definition = TYPE_DEFINITIONS?.[instance?.terrainId];
    if (!definition) throw new Error(`Unknown terrain type: ${instance?.terrainId}`);
    return Object.freeze({
      ...instance,
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
    return {
      x: instance.x + instance.width / 2,
      y: instance.y + instance.height / 2
    };
  }

  window.CrossroadsTerrainGeometry = Object.freeze({
    setActiveScenario,
    all,
    get,
    matching,
    byFamily,
    byRenderer,
    buildings,
    blocking,
    rough,
    walls,
    pointInside,
    expand,
    containingPoint,
    buildingContainingPoint,
    center
  });
})();
