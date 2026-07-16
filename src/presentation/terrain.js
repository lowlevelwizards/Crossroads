"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  const MATS = window.CROSSROADS_TERRAIN_MATS ?? {};

  function percent(value, total) { return `${(Number(value) / Number(total)) * 100}%`; }

  function applyRect(element, instance, table) {
    element.style.left = percent(instance.x, table.width);
    element.style.top = percent(instance.y, table.height);
    element.style.width = percent(instance.width, table.width);
    element.style.height = percent(instance.height, table.height);
    element.style.setProperty("--terrain-rotation", `${Number(instance.rotation) || 0}deg`);
    element.style.setProperty("--terrain-variant", String(Number(instance.variant) || 0));
    element.style.transform = `rotate(var(--terrain-rotation))`;
  }

  function terrainLabel(text, detail) {
    const label = document.createElement("span");
    label.className = "terrain-label";
    label.textContent = String(text).toUpperCase();
    label.dataset.full = detail ?? text;
    return label;
  }

  function addPrimitive(parent, className, count = 1) {
    for (let index = 0; index < count; index += 1) {
      const node = document.createElement("span");
      node.className = `${className} ${className}-${index + 1}`;
      node.setAttribute("aria-hidden", "true");
      parent.appendChild(node);
    }
  }

  function createBuildingChildren(element, definition, instance) {
    const name = definition.label ?? "building";
    const plaque = terrainLabel(name, "Occupiable · hard cover");
    plaque.classList.add("building-title-plaque");
    element.appendChild(plaque);

    const badge = document.createElement("button");
    badge.className = "building-occupancy-nameplate";
    badge.type = "button";
    badge.hidden = true;
    element.appendChild(badge);

    // Slightly cheated top-down construction: roof planes sit above a visible
    // front wall and narrow side wall. All parts remain simple CSS shapes.
    addPrimitive(element, "building-ground");
    addPrimitive(element, "building-front-wall");
    addPrimitive(element, "building-side-wall");
    addPrimitive(element, "terrain-roof-plane", 2);
    addPrimitive(element, "terrain-roof-ridge");
    addPrimitive(element, "building-door");
    addPrimitive(element, "building-window", definition.id === "shed" ? 1 : 2);
    if (["farmhouse", "building", "cottage"].includes(instance.terrainId)) {
      addPrimitive(element, "building-chimney");
    }

    const approach = document.createElement("span");
    approach.className = "building-approach-marker";
    approach.hidden = true;
    element.appendChild(approach);
  }

  function decorate(element, definition, instance) {
    const renderer = definition.renderer;
    if (renderer === "woods") {
      const count = instance.terrainId === "woods_dense" ? 8 : 7;
      addPrimitive(element, "tree-shadow", count);
      addPrimitive(element, "tree-canopy", count);
      addPrimitive(element, "tree-highlight", count);
    } else if (renderer === "orchard") {
      addPrimitive(element, "orchard-shadow", 9);
      addPrimitive(element, "orchard-tree", 9);
      addPrimitive(element, "orchard-highlight", 9);
    } else if (renderer === "wall") addPrimitive(element, "wall-stone", 7);
    else if (renderer === "hedge") addPrimitive(element, "hedge-clump", 7);
    else if (renderer === "fence") { addPrimitive(element, "fence-rail", 2); addPrimitive(element, "fence-post", 5); }
    else if (renderer === "rail" || renderer === "rail_crossing") {
      addPrimitive(element, "rail-ballast");
      addPrimitive(element, "rail-sleeper", 11);
      addPrimitive(element, "rail-line", 2);
      if (renderer === "rail_crossing") addPrimitive(element, "crossing-plank", 5);
    }
    else if (renderer === "road") { addPrimitive(element, "road-edge", 2); addPrimitive(element, "road-pebble", 7); addPrimitive(element, "road-tuft", 5); }
    else if (renderer === "road_curve") { addPrimitive(element, "road-curve-inner"); addPrimitive(element, "road-pebble", 5); addPrimitive(element, "road-tuft", 4); }
    else if (renderer === "road_crossroads") { addPrimitive(element, "road-arm", 2); addPrimitive(element, "road-pebble", 8); addPrimitive(element, "road-tuft", 6); }
    else if (renderer === "ditch") { addPrimitive(element, "ditch-channel"); addPrimitive(element, "ditch-rim", 2); addPrimitive(element, "ditch-stone", 4); }
    else if (renderer === "stream") { addPrimitive(element, "stream-bank", 2); addPrimitive(element, "stream-water"); addPrimitive(element, "stream-ripple", 3); addPrimitive(element, "stream-stone", 4); }
    else if (renderer === "foxholes") addPrimitive(element, "foxhole-pit", 3);
    else if (renderer === "sandbags") addPrimitive(element, "sandbag", 8);
    else if (renderer === "haystack") { addPrimitive(element, "hay-layer", 3); addPrimitive(element, "hay-cross"); }
    else if (renderer === "well") { addPrimitive(element, "well-ring"); addPrimitive(element, "well-water"); addPrimitive(element, "well-post", 2); addPrimitive(element, "well-roof"); }
    else if (renderer === "crates") addPrimitive(element, "crate", 4);
    else if (renderer === "woodpile") { addPrimitive(element, "log", 6); addPrimitive(element, "woodpile-cover"); }
  }

  function createElement(instance) {
    const definition = TYPE_DEFINITIONS[instance.terrainId];
    if (!definition) throw new Error(`Unknown terrain type: ${instance.terrainId}`);

    const element = document.createElement("div");
    element.dataset.terrainInstanceId = instance.id;
    element.dataset.terrainId = instance.terrainId;
    element.dataset.terrainFamily = definition.family;
    element.dataset.renderer = definition.renderer;
    element.className = `terrain-piece terrain-${definition.family} terrain-${definition.renderer} terrain-id-${instance.terrainId}`;
    if (Number(instance.height) > Number(instance.width) * 1.5) element.classList.add("is-vertical");

    if (definition.renderer === "building") {
      element.classList.add("terrain", "building");
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      createBuildingChildren(element, definition, instance);
    } else {
      if (["woods", "orchard", "wall", "hedge", "fence", "ditch", "stream", "foxholes", "sandbags"].includes(definition.renderer)) {
        element.appendChild(terrainLabel(definition.label, definition.label));
      }
      decorate(element, definition, instance);
    }
    element.title = definition.label;
    return element;
  }

  function applyMat(layer, scenario) {
    const battlefield = layer?.closest(".battlefield");
    if (!battlefield) return;
    for (const mat of Object.values(MATS)) battlefield.classList.remove(mat.cssClass);
    const matId = scenario.table?.mat ?? "grass_temperate";
    battlefield.classList.add(MATS[matId]?.cssClass ?? "mat-grass-temperate");
    battlefield.dataset.terrainMat = matId;
  }

  function renderScenarioTerrain({ layer, scenario }) {
    if (!layer || !scenario) return;
    applyMat(layer, scenario);
    const instances = Array.isArray(scenario.terrain) ? scenario.terrain : [];
    layer.replaceChildren();
    for (const instance of instances) {
      const element = createElement(instance);
      applyRect(element, instance, scenario.table);
      layer.appendChild(element);
    }
  }

  function elementForInstance(layer, id) {
    return layer?.querySelector(`[data-terrain-instance-id="${CSS.escape(id)}"]`) ?? null;
  }

  window.CrossroadsTerrainPresentation = Object.freeze({ renderScenarioTerrain, elementForInstance });

  const layer = document.getElementById("terrainLayer");
  const select = document.getElementById("scenarioSelect");
  const scenario = window.CROSSROADS_SCENARIOS?.[select?.value ?? "take_the_crossroads"];
  if (layer && scenario) renderScenarioTerrain({ layer, scenario });
})();
