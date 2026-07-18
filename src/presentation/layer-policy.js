"use strict";

(() => {
  const BANDS = Object.freeze({
    groundPatch:110,
    groundTerrain:130,
    water:180,
    transport:220,
    lowTerrain:360,
    tallDepthBase:5000,
    tallDepthRange:1000,
    objective:7200,
    overlay:7600
  });

  const FRAGMENT_OFFSETS = Object.freeze({
    body:0,
    foreground:42,
    canopy:56
  });

  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function manual(item, fallback) {
    if (item?.inheritLayer === false) return Math.max(0, Math.min(6999, Math.round(number(item.layerOrder, fallback))));
    return fallback;
  }

  function terrainRole(definition) {
    const renderer = definition?.renderer;
    if (["building", "woods", "orchard"].includes(renderer)) return "tall";
    if (renderer === "field") return "ground";
    if (["road", "road_curve", "road_crossroads", "rail", "rail_crossing", "stream", "ditch"].includes(renderer)) return "surface";
    return "low";
  }

  function terrainBase(definition) {
    const role = terrainRole(definition);
    if (role === "ground") return BANDS.groundTerrain;
    if (role === "surface") return ["stream", "ditch"].includes(definition?.renderer) ? BANDS.water : BANDS.transport;
    if (role === "low") return BANDS.lowTerrain;
    return BANDS.tallDepthBase;
  }

  function linearBase(style) {
    const renderer = style?.renderer;
    if (["stream", "ditch"].includes(renderer)) return BANDS.water;
    if (["road", "rail"].includes(renderer)) return BANDS.transport + (renderer === "rail" ? 10 : 0);
    return BANDS.lowTerrain;
  }

  function patchBase(style) {
    if (style?.family === "water") return BANDS.water - 5;
    return BANDS.groundPatch;
  }

  function depthFromTableY(y, tableHeight = 48) {
    const ratio = Math.max(0, Math.min(1, number(y) / Math.max(1, number(tableHeight, 48))));
    return BANDS.tallDepthBase + Math.round(ratio * BANDS.tallDepthRange);
  }

  function terrainLayer(item, definition, tableHeight = 48) {
    const role = terrainRole(definition);
    const fallback = role === "tall"
      ? depthFromTableY(number(item?.y) + number(item?.height) * number(item?.depthAnchor ?? definition?.presentation?.depthAnchor, .82), tableHeight)
      : terrainBase(definition);
    return manual(item, fallback);
  }

  function linearLayer(item, style) {
    return manual(item, linearBase(style));
  }

  function patchLayer(item, style) {
    return manual(item, patchBase(style));
  }

  function unitLayer(unit, tableHeight = 48) {
    return manual(unit, depthFromTableY(unit?.y, tableHeight));
  }

  function fragmentLayer(baseLayer, fragment = "body") {
    const offset = typeof fragment === "number" ? fragment : number(FRAGMENT_OFFSETS[fragment]);
    return Math.max(0, Math.min(7199, Math.round(number(baseLayer) + offset)));
  }

  function woodlandBodyLayer(patch, y, tableHeight = 48) {
    const inherited = depthFromTableY(y, tableHeight);
    return patch?.inheritLayer === false ? fragmentLayer(manual(patch, inherited), 1) : inherited;
  }

  function woodlandCanopyLayer(patch, y, tableHeight = 48) {
    return fragmentLayer(woodlandBodyLayer(patch, y, tableHeight), "canopy");
  }

  function buildingForegroundLayer(item, definition, tableHeight = 48) {
    return fragmentLayer(terrainLayer(item, definition, tableHeight), "foreground");
  }

  window.CrossroadsLayerPolicy = Object.freeze({
    BANDS,
    FRAGMENT_OFFSETS,
    manual,
    terrainRole,
    terrainBase,
    linearBase,
    patchBase,
    depthFromTableY,
    terrainLayer,
    linearLayer,
    patchLayer,
    unitLayer,
    fragmentLayer,
    woodlandBodyLayer,
    woodlandCanopyLayer,
    buildingForegroundLayer
  });
})();
