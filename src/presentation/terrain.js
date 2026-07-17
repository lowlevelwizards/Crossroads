"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;
  const MATS = window.CROSSROADS_TERRAIN_MATS ?? {};
  const BUILDINGS = window.CrossroadsBuildingPresentation;

  function percent(value, total) {
    return `${(Number(value) / Number(total)) * 100}%`;
  }

  function applyRect(element, instance, table) {
    const width = Number(instance.width) || 0;
    const height = Number(instance.height) || 0;

    element.style.left = percent(instance.x, table.width);
    element.style.top = percent(instance.y, table.height);
    element.style.width = percent(width, table.width);
    element.style.height = percent(height, table.height);
    element.style.setProperty("--terrain-inch-width", String(width));
    element.style.setProperty("--terrain-inch-height", String(height));
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

  function createGroup(parent, className) {
    const group = document.createElement("span");
    group.className = className;
    group.setAttribute("aria-hidden", "true");
    parent.appendChild(group);
    return group;
  }

  const WOODS_LAYOUTS = Object.freeze({
    woods: Object.freeze([
      { x: 3,  y: 6,  size: 36, scale: 1.05, rotation: -8, preset: "broad" },
      { x: 31, y: 1,  size: 35, scale: .96, rotation: 7,  preset: "tall" },
      { x: 60, y: 7,  size: 36, scale: 1.03, rotation: -4, preset: "right" },
      { x: 8,  y: 37, size: 36, scale: 1.02, rotation: 10, preset: "left" },
      { x: 37, y: 32, size: 37, scale: 1.08, rotation: -2, preset: "balanced" },
      { x: 62, y: 43, size: 35, scale: .96, rotation: 8,  preset: "broad" },
      { x: 27, y: 63, size: 37, scale: 1.04, rotation: -10, preset: "balanced" }
    ]),
    woods_dense: Object.freeze([
      { x: 1,  y: 4,  size: 34, scale: 1.05, rotation: -8, preset: "broad" },
      { x: 27, y: 0,  size: 34, scale: .98, rotation: 6,  preset: "tall" },
      { x: 55, y: 4,  size: 35, scale: 1.03, rotation: -5, preset: "right" },
      { x: 6,  y: 31, size: 35, scale: 1.02, rotation: 9,  preset: "left" },
      { x: 33, y: 27, size: 36, scale: 1.08, rotation: -2, preset: "balanced" },
      { x: 61, y: 33, size: 34, scale: .99, rotation: 8,  preset: "broad" },
      { x: 19, y: 58, size: 36, scale: 1.04, rotation: -9, preset: "balanced" },
      { x: 50, y: 60, size: 36, scale: 1.02, rotation: 5,  preset: "right" }
    ])
  });

  function addCircleLayer(tree, className, count) {
    const layer = createGroup(tree, `woods-tree-layer ${className}`);
    addPrimitive(layer, "woods-tree-circle", count);
  }

  function createWoodsTree(art, placement, index) {
    const tree = createGroup(art, `woods-tree woods-tree-${index + 1} tree-preset-${placement.preset}`);
    tree.style.setProperty("--tree-x", `${placement.x}%`);
    tree.style.setProperty("--tree-y", `${placement.y}%`);
    tree.style.setProperty("--tree-size", `${placement.size}%`);
    tree.style.setProperty("--tree-scale", String(placement.scale));
    tree.style.setProperty("--tree-rotation", `${placement.rotation}deg`);

    createGroup(tree, "woods-tree-shadow");
    createGroup(tree, "woods-tree-trunk");
    addCircleLayer(tree, "woods-tree-layer-dark", 5);
    addCircleLayer(tree, "woods-tree-layer-mid", 5);
    addCircleLayer(tree, "woods-tree-layer-light", 4);
  }

  function createWoodsPatch(art, instance) {
    const layout = WOODS_LAYOUTS[instance.terrainId] ?? WOODS_LAYOUTS.woods;
    layout.forEach((placement, index) => createWoodsTree(art, placement, index));
  }

  function createBuildingChildren(element, definition, instance) {
    if (!BUILDINGS?.createArt) {
      throw new Error("Crossroads building presentation module is unavailable.");
    }

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
    art.appendChild(BUILDINGS.createArt({ definition, instance }));

    const approach = document.createElement("span");
    approach.className = "building-approach-marker";
    approach.hidden = true;
    element.appendChild(approach);
  }

  function decorate(art, definition, instance) {
    const renderer = definition.renderer;
    if (renderer === "woods") {
      createWoodsPatch(art, instance);
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
    if (instance.appearance) element.dataset.appearance = instance.appearance;
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

    if (element.querySelector('.terrain-label')) {
      element.classList.add('terrain-has-label');
      element.dataset.labelText = definition.label;
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
    const battlefield = layer.closest('.battlefield');
    const instances = Array.isArray(scenario.terrain) ? scenario.terrain : [];
    layer.dataset.scenarioId = scenario.id ?? '';
    if (battlefield) battlefield.dataset.scenarioId = scenario.id ?? '';
    layer.replaceChildren();
    for (const instance of instances) {
      const element = createElement(instance);
      applyRect(element, instance, scenario.table);
      layer.appendChild(element);
    }

    if (!layer.dataset.labelTapBound) {
      layer.dataset.labelTapBound = 'true';
      layer.addEventListener('click', event => {
        const piece = event.target instanceof Element ? event.target.closest('.terrain-piece.terrain-has-label') : null;
        if (!piece) return;
        const inLibrary = layer.dataset.scenarioId === 'terrain_library';
        const touchPreferred = window.matchMedia?.('(hover: none)').matches;
        if (!inLibrary && !piece.classList.contains('terrain-building')) return;
        if (!inLibrary && !touchPreferred) return;
        if (piece.classList.contains('terrain-building') && piece.querySelector('.building-occupancy-nameplate:not([hidden])')) return;
        event.stopPropagation();
        const opening = !piece.classList.contains('terrain-label-visible');
        layer.querySelectorAll('.terrain-label-visible').forEach(node => node.classList.remove('terrain-label-visible'));
        if (opening) piece.classList.add('terrain-label-visible');
      });

      document.addEventListener('click', event => {
        if (layer.contains(event.target)) return;
        layer.querySelectorAll('.terrain-label-visible').forEach(node => node.classList.remove('terrain-label-visible'));
      });
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
