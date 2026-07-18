"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  const PATCH_STYLES = window.CROSSROADS_TERRAIN_PATCH_STYLES ?? {};
  const SEMANTICS = window.CrossroadsTerrainSemantics;
  const SPATIAL = window.CrossroadsTerrainSpatial;
  const VISIBILITY = window.CrossroadsScenarioVisibility;
  let activeInstances = Object.freeze([]);
  let activeScenario = null;

  function visible(item) {
    return VISIBILITY?.isVisible ? VISIBILITY.isVisible(item) : item?.visible !== false && item?.hidden !== true;
  }

  function normalizedRect(instance, definition) {
    const visual = { x:Number(instance.x) || 0, y:Number(instance.y) || 0, width:Number(instance.width) || 0, height:Number(instance.height) || 0 };
    const footprint = definition?.presentation?.footprint;
    if (!footprint) return visual;
    const scale = Math.max(0.25, Number(instance.visualScale) || 1);
    const baseWidth = visual.width * (Number(footprint.width) || 1);
    const baseHeight = visual.height * (Number(footprint.height) || 1);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    const centerX = visual.x + visual.width * ((Number(footprint.x) || 0) + (Number(footprint.width) || 1) / 2);
    const centerY = visual.y + visual.height * ((Number(footprint.y) || 0) + (Number(footprint.height) || 1) / 2);
    return { x:centerX-width/2, y:centerY-height/2, width, height };
  }

  function normalize(instance) {
    const definition = TYPE_DEFINITIONS?.[instance?.terrainId];
    if (!definition) throw new Error(`Unknown terrain type: ${instance?.terrainId}`);
    const visualRect = Object.freeze({ x:Number(instance.x) || 0, y:Number(instance.y) || 0, width:Number(instance.width) || 0, height:Number(instance.height) || 0 });
    const rulesRect = normalizedRect(instance, definition);
    return Object.freeze({
      ...instance,
      ...rulesRect,
      visualRect,
      rotation:Number(instance.rotation) || 0,
      definition,
      rules:SEMANTICS?.forDefinition(definition) ?? definition.rules ?? Object.freeze({}),
      sourceKind:"terrain",
      shape:"rect"
    });
  }

  function polygonBounds(points = []) {
    const xs = points.map(point => Number(point.x)).filter(Number.isFinite);
    const ys = points.map(point => Number(point.y)).filter(Number.isFinite);
    if (!xs.length || !ys.length) return { x:0, y:0, width:0, height:0 };
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width:Math.max(...xs)-x, height:Math.max(...ys)-y };
  }

  function normalizePatch(patch) {
    const style = PATCH_STYLES[patch?.styleId];
    if (!style || !Array.isArray(patch.points) || patch.points.length < 3) return null;
    const points = Object.freeze(patch.points.map(point => Object.freeze({ x:Number(point.x) || 0, y:Number(point.y) || 0 })));
    const bounds = polygonBounds(points);
    const definition = Object.freeze({ id:style.id, family:style.family, renderer:"patch", label:style.label, rules:style.rules, presentation:Object.freeze({}) });
    return Object.freeze({
      ...patch,
      ...bounds,
      terrainId:`patch:${style.id}`,
      points,
      shape:"polygon",
      sourceKind:"patch",
      definition,
      rules:SEMANTICS?.forDefinition(definition) ?? style.rules ?? Object.freeze({})
    });
  }

  function setActiveScenario(scenario) {
    activeScenario = scenario ?? null;
    const discrete = (scenario?.terrain ?? []).filter(visible).map(normalize);
    const patches = (scenario?.terrainPatches ?? []).filter(visible).map(normalizePatch).filter(Boolean);
    const linear = window.CrossroadsLinearTerrain?.compileScenario(scenario)?.instances ?? [];
    activeInstances = Object.freeze([...discrete, ...patches, ...linear]);
    return activeInstances;
  }

  function all() { return activeInstances; }
  function get(id) { return activeInstances.find(instance => instance.id === id) ?? null; }
  function matching(predicate) { return activeInstances.filter(predicate); }
  function byFamily(family) { return matching(instance => instance.definition.family === family); }
  function byRenderer(renderer) { return matching(instance => instance.definition.renderer === renderer); }
  function buildings() { return matching(instance => Boolean(instance.rules.occupiable)); }
  function blocking() { return matching(instance => instance.rules.blocksLineOfSight || instance.rules.los === "blocking"); }
  function rough() { return matching(instance => instance.rules.movement === "rough"); }
  function walls() { return matching(instance => instance.rules.movement === "crossing"); }

  function pointInside(point, instance, rectPointInside = null) {
    if (SPATIAL?.pointInside) return SPATIAL.pointInside(point, instance, rectPointInside ?? pointInsideRect);
    return pointInsideRect(point, instance);
  }

  function pointInsideRect(point, rect) {
    return Boolean(point && rect && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height);
  }

  function segmentClip(start, end, instance, rectClip) {
    return SPATIAL?.segmentClip ? SPATIAL.segmentClip(start, end, instance, rectClip) : rectClip?.(start, end, instance) ?? null;
  }

  function expand(rect, amount) {
    return { ...rect, x:rect.x-amount, y:rect.y-amount, width:rect.width+amount*2, height:rect.height+amount*2 };
  }

  function containingPoint(point, predicate = () => true) {
    return activeInstances.find(instance => predicate(instance) && pointInside(point, instance)) ?? null;
  }

  function buildingContainingPoint(point) {
    return containingPoint(point, instance => Boolean(instance.rules.occupiable));
  }

  function terrainAtPoint(point, predicate = () => true) {
    return activeInstances.filter(instance => predicate(instance) && pointInside(point, instance));
  }

  function terrainCrossedBySegment(start, end, predicate = () => true, rectClip = null) {
    return activeInstances.map(instance => ({ instance, clip:predicate(instance) ? segmentClip(start, end, instance, rectClip) : null })).filter(entry => entry.clip);
  }

  function distanceInsideTerrain(start, end, instance, rectClip = null) {
    return SPATIAL?.distanceInside ? SPATIAL.distanceInside(start, end, instance, rectClip) : 0;
  }

  function rulesForTerrain(instanceOrId) {
    return resolve(instanceOrId)?.rules ?? null;
  }

  function linearWidthAtPoint(pathId, point) {
    const compiled = window.CrossroadsLinearTerrain?.compileScenario(activeScenario)?.paths?.find(entry => String(entry.definition.id) === String(pathId));
    if (!compiled || !point || !window.CrossroadsPathGeometry?.nearestPoint) return null;
    const nearest = window.CrossroadsPathGeometry.nearestPoint(compiled.path, point);
    return window.CrossroadsLinearTerrain.widthAt(compiled.definition, compiled.style, compiled.path, nearest.distance);
  }

  function center(instance) { return { x:instance.x + instance.width / 2, y:instance.y + instance.height / 2 }; }
  function resolve(instanceOrId) { return typeof instanceOrId === "string" ? get(instanceOrId) : instanceOrId; }

  function rotateVector(vector, degrees) {
    const radians = (Number(degrees) || 0) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return { x:vector.x*cosine-vector.y*sine, y:vector.x*sine+vector.y*cosine };
  }

  function entryDefinition(instanceOrId) {
    const instance = resolve(instanceOrId);
    const presentation = instance?.definition?.presentation ?? {};
    return { instance, anchor:presentation.entryAnchor ?? { x:.5, y:1 }, normal:presentation.entryNormal ?? { x:0, y:1 } };
  }

  function entryPoint(instanceOrId, outward = .15) {
    const { instance, anchor, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x:0, y:0 };
    const rect = instance.visualRect ?? instance;
    const localAnchor = { x:(Number(anchor.x)-.5)*rect.width, y:(Number(anchor.y)-.5)*rect.height };
    const rotatedAnchor = rotateVector(localAnchor, instance.rotation);
    const rotatedNormal = rotateVector({ x:Number(normal.x)||0, y:Number(normal.y)||0 }, instance.rotation);
    const origin = center(rect);
    return { x:origin.x+rotatedAnchor.x+rotatedNormal.x*outward, y:origin.y+rotatedAnchor.y+rotatedNormal.y*outward };
  }

  function approachPoint(instanceOrId, distance = 1.8) {
    const { instance, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x:0, y:0 };
    const door = entryPoint(instance, .15);
    const rotatedNormal = rotateVector({ x:Number(normal.x)||0, y:Number(normal.y)||0 }, instance.rotation);
    return { x:door.x+rotatedNormal.x*distance, y:door.y+rotatedNormal.y*distance };
  }

  function entryMarker(instanceOrId, distance = 1.8) {
    const { instance, anchor, normal } = entryDefinition(instanceOrId);
    if (!instance) return { x:.5, y:1 };
    return {
      x:Number(anchor.x)+(Number(normal.x)||0)*((distance+.15)/(instance.visualRect?.width??instance.width)),
      y:Number(anchor.y)+(Number(normal.y)||0)*((distance+.15)/(instance.visualRect?.height??instance.height))
    };
  }

  window.CrossroadsTerrainGeometry = Object.freeze({
    setActiveScenario, all, get, matching, byFamily, byRenderer, buildings,
    blocking, rough, walls, pointInside, pointInsideRect, segmentClip, expand,
    containingPoint, buildingContainingPoint, terrainAtPoint,
    terrainCrossedBySegment, distanceInsideTerrain, rulesForTerrain,
    linearWidthAtPoint, center, entryPoint, approachPoint, entryMarker
  });
})();
