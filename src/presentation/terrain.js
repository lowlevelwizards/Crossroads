"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  const MATS = window.CROSSROADS_TERRAIN_MATS ?? {};

  function percent(value, total) {
    return `${(Number(value) / Number(total)) * 100}%`;
  }

  function applyRect(element, instance, table) {
    element.style.left = percent(instance.x, table.width);
    element.style.top = percent(instance.y, table.height);
    element.style.width = percent(instance.width, table.width);
    element.style.height = percent(instance.height, table.height);
    element.style.setProperty("--terrain-rotation", `${Number(instance.rotation) || 0}deg`);
    element.style.setProperty("--terrain-variant", String(Number(instance.variant) || 0));
    element.style.transform = "rotate(var(--terrain-rotation))";
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

  function createArtFrame(element) {
    const art = document.createElement("span");
    art.className = "terrain-art";
    art.setAttribute("aria-hidden", "true");
    element.appendChild(art);
    return art;
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

    const art = createArtFrame(element);
    addPrimitive(art, "building-shadow");
    addPrimitive(art, "building-side-wall");
    addPrimitive(art, "terrain-roof");
    addPrimitive(art, "terrain-roof-ridge");
    addPrimitive(art, "building-front-wall");
    addPrimitive(art, "building-door");
    addPrimitive(art, "building-window", definition.id === "shed" ? 0 : 2);
    if (["farmhouse", "building", "cottage"].includes(instance.terrainId)) {
      addPrimitive(art, "building-chimney");
    }

    const approach = document.createElement("span");
    approach.className = "building-approach-marker";
    approach.hidden = true;
    element.appendChild(approach);
  }

  function decorate(art, definition, instance) {
    const renderer = definition.renderer;
    if (renderer === "woods") {
      const count = instance.terrainId === "woods_dense" ? 8 : 7;
      addPrimitive(art, "tree-shadow", count);
      addPrimitive(art, "tree-canopy", count);
      addPrimitive(art, "tree-highlight", count);
    } else if (renderer === "orchard") {
      addPrimitive(art, "orchard-shadow", 9);
      addPrimitive(art, "orchard-tree", 9);
      addPrimitive(art, "orchard-highlight", 9);
    } else if (renderer === "wall") addPrimitive(art, "wall-stone", 7);
    else if (renderer === "hedge") addPrimitive(art, "hedge-clump", 7);
    else if (renderer === "fence") {
      addPrimitive(art, "fence-rail", 2);
      addPrimitive(art, "fence-post", 5);
    } else if (renderer === "rail" || renderer === "rail_crossing") {
      addPrimitive(art, "rail-ballast");
      addPrimitive(art, "rail-sleeper", 11);
      addPrimitive(art, "rail-line", 2);
      if (renderer === "rail_crossing") addPrimitive(art, "crossing-plank", 5);
    } else if (renderer === "road") {
      addPrimitive(art, "road-surface");
      addPrimitive(art, "road-track", 2);
      addPrimitive(art, "road-pebble", 5);
    } else if (renderer === "road_curve") {
      addPrimitive(art, "road-curve-surface");
      addPrimitive(art, "road-curve-cutout");
      addPrimitive(art, "road-pebble", 4);
    } else if (renderer === "road_crossroads") {
      addPrimitive(art, "crossroads-surface");
      addPrimitive(art, "crossroads-track", 4);
      addPrimitive(art, "road-pebble", 5);
    } else if (renderer === "ditch") {
      addPrimitive(art, "ditch-channel");
      addPrimitive(art, "ditch-rim", 2);
      addPrimitive(art, "ditch-stone", 3);
    } else if (renderer === "stream") {
      addPrimitive(art, "stream-bank", 2);
      addPrimitive(art, "stream-water");
      addPrimitive(art, "stream-ripple", 3);
      addPrimitive(art, "stream-stone", 3);
    } else if (renderer === "foxholes") addPrimitive(art, "foxhole-pit");
    else if (renderer === "sandbags") addPrimitive(art, "sandbag", 8);
    else if (renderer === "haystack") addPrimitive(art, "hay-burst", 3);
    else if (renderer === "well") {
      addPrimitive(art, "well-ring");
      addPrimitive(art, "well-water");
      addPrimitive(art, "well-post", 2);
      addPrimitive(art, "well-roof");
    } else if (renderer === "crates") addPrimitive(art, "crate", 4);
    else if (renderer === "woodpile") {
      addPrimitive(art, "log", 6);
      addPrimitive(art, "log-support", 2);
    }
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
      const art = createArtFrame(element);
      decorate(art, definition, instance);
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
