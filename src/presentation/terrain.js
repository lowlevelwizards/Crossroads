"use strict";

(() => {
  const TYPE_DEFINITIONS = window.CROSSROADS_TERRAIN_TYPES;

  function percent(value, total) {
    return `${(Number(value) / Number(total)) * 100}%`;
  }

  function applyRect(element, instance, table) {
    element.style.left = percent(instance.x, table.width);
    element.style.top = percent(instance.y, table.height);
    element.style.width = percent(instance.width, table.width);
    element.style.height = percent(instance.height, table.height);
    element.style.transform = instance.rotation ? `rotate(${instance.rotation}deg)` : "";
  }

  function terrainLabel(text, detail) {
    const label = document.createElement("span");
    label.className = "terrain-label";
    label.textContent = String(text).toUpperCase();
    label.dataset.full = detail ?? text;
    return label;
  }

  function createBuildingChildren(element) {
    const plaque = terrainLabel("Farmhouse", "Occupiable · hard cover");
    plaque.classList.add("building-title-plaque");
    element.appendChild(plaque);

    const badge = document.createElement("button");
    badge.id = "buildingOccupancyBadge";
    badge.className = "building-occupancy-nameplate";
    badge.type = "button";
    badge.hidden = true;
    element.appendChild(badge);

    const door = document.createElement("span");
    door.className = "building-door";
    element.appendChild(door);

    const approach = document.createElement("span");
    approach.id = "buildingApproachMarker";
    approach.className = "building-approach-marker";
    approach.hidden = true;
    element.appendChild(approach);

    for (const position of ["one", "two", "three"]) {
      const windowElement = document.createElement("span");
      windowElement.className = `building-window ${position}`;
      element.appendChild(windowElement);
    }
  }

  function createElement(instance) {
    const definition = TYPE_DEFINITIONS[instance.terrainId];
    if (!definition) throw new Error(`Unknown terrain type: ${instance.terrainId}`);

    const element = document.createElement("div");
    element.dataset.terrainInstanceId = instance.id;
    element.dataset.terrainId = instance.terrainId;

    if (definition.renderer === "road") {
      element.className = `road ${instance.terrainId === "road_vertical" ? "vertical" : "horizontal"}`;
    } else {
      element.className = `terrain ${definition.renderer}`;
    }

    if (definition.renderer === "woods") {
      element.title = "Woods: soft cover and rough ground";
      element.appendChild(terrainLabel("Woods", "Soft cover · rough ground"));
    } else if (definition.renderer === "wall") {
      element.title = "Low wall: hard cover and +2 inch crossing cost";
      element.appendChild(terrainLabel("Wall", "Hard cover · +2″ crossing"));
    } else if (definition.renderer === "building") {
      element.id = "farmhouseTerrain";
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      createBuildingChildren(element);
    }

    return element;
  }

  function renderScenarioTerrain({ layer, scenario }) {
    if (!layer || !scenario) return;
    const instances = Array.isArray(scenario.terrain) ? scenario.terrain : [];
    const liveIds = new Set(instances.map(instance => instance.id));

    layer.querySelectorAll("[data-terrain-instance-id]").forEach(element => {
      if (!liveIds.has(element.dataset.terrainInstanceId)) element.remove();
    });

    for (const instance of instances) {
      let element = layer.querySelector(
        `[data-terrain-instance-id="${CSS.escape(instance.id)}"]`
      );
      if (!element) {
        element = createElement(instance);
        layer.appendChild(element);
      }
      applyRect(element, instance, scenario.table);
    }
  }

  function legacyInstanceMap(scenario) {
    const map = Object.create(null);
    for (const instance of scenario?.terrain ?? []) {
      if (["woods", "wall", "building"].includes(instance.terrainId)) {
        map[instance.terrainId] = instance;
      }
    }
    return map;
  }

  window.CrossroadsTerrainPresentation = Object.freeze({
    renderScenarioTerrain,
    legacyInstanceMap
  });

  // Bootstrap the default scenario before the engine caches DOM references.
  const layer = document.getElementById("terrainLayer");
  const select = document.getElementById("scenarioSelect");
  const scenario = window.CROSSROADS_SCENARIOS?.[select?.value ?? "take_the_crossroads"];
  if (layer && scenario) renderScenarioTerrain({ layer, scenario });
})();
