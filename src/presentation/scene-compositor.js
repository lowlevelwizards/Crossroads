"use strict";

(() => {
  const LAYERS = window.CrossroadsLayerPolicy;
  const TYPES = window.CROSSROADS_TERRAIN_TYPES ?? {};

  function terrainInstanceFor(piece, scenario) {
    return (scenario?.terrain ?? []).find(item => String(item.id) === String(piece.dataset.terrainInstanceId)) ?? null;
  }

  function shouldPromote(instance, definition) {
    return LAYERS?.terrainRole(definition) === "tall" || instance?.inheritLayer === false;
  }

  function clearPromoted(battlefield) {
    battlefield.querySelectorAll(":scope > .scene-promoted-terrain, :scope > .scene-promoted-object").forEach(node => node.remove());
  }

  function promoteManualObjects(battlefield, terrainLayer, scenario) {
    const patches = new Map((scenario?.terrainPatches ?? []).map(item => [String(item.id), item]));
    for (const svg of [...terrainLayer.querySelectorAll(":scope > .terrain-patch-svg")]) {
      const item = patches.get(String(svg.dataset.patchId));
      const style = window.CROSSROADS_TERRAIN_PATCH_STYLES?.[item?.styleId];
      svg.style.zIndex = String(LAYERS?.patchLayer(item, style) ?? 110);
      if (item?.inheritLayer === false) {
        svg.classList.add("scene-promoted-object");
        battlefield.appendChild(svg);
      }
    }

    const paths = new Map((scenario?.linearTerrain ?? []).map(item => [String(item.id), item]));
    for (const svg of [...terrainLayer.querySelectorAll(":scope > .linear-terrain-svg[data-linear-id]")]) {
      const item = paths.get(String(svg.dataset.linearId));
      const style = window.CROSSROADS_LINEAR_TERRAIN_STYLES?.[item?.styleId];
      svg.style.zIndex = String(LAYERS?.linearLayer(item, style) ?? 220);
      if (item?.inheritLayer === false) {
        svg.classList.add("scene-promoted-object");
        battlefield.appendChild(svg);
      }
    }
  }

  function composeTerrain({ battlefield, terrainLayer, scenario }) {
    if (!battlefield || !terrainLayer) return;
    clearPromoted(battlefield);
    for (const piece of [...terrainLayer.querySelectorAll(":scope > .terrain-piece")]) {
      const instance = terrainInstanceFor(piece, scenario);
      const definition = TYPES[instance?.terrainId];
      const z = LAYERS?.terrainLayer(instance, definition, scenario?.table?.height) ?? 360;
      piece.dataset.sceneRole = LAYERS?.terrainRole(definition) ?? "low";
      piece.style.zIndex = String(z);
      if (shouldPromote(instance, definition)) {
        piece.classList.add("scene-promoted-terrain", "scene-depth-object");
        battlefield.appendChild(piece);
      }
    }
    promoteManualObjects(battlefield, terrainLayer, scenario);
  }

  function unitDepth(unit, tableHeight = 48) {
    return LAYERS?.unitLayer(unit, tableHeight) ?? 5500;
  }

  function syncUnits(battlefield, units = [], tableHeight = 48) {
    const byId = new Map((units ?? []).filter(unit => window.CrossroadsScenarioVisibility ? window.CrossroadsScenarioVisibility.isVisible(unit) : unit?.visible !== false && unit?.hidden !== true).map(unit => [String(unit.id), unit]));
    for (const element of battlefield.querySelectorAll(".unit")) {
      const unit = byId.get(String(element.dataset.unitId)) ?? { y:parseFloat(element.style.top) / 100 * tableHeight };
      element.classList.add("scene-depth-object");
      element.style.zIndex = String(unitDepth(unit, tableHeight));
    }
  }

  function create({ battlefield, terrainLayer }) {
    if (!battlefield || !terrainLayer) throw new Error("Scene compositor requires battlefield and terrain layer.");
    let scenario = null;
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && node.matches?.(".unit")))) {
        const units = [...(scenario?.forces?.blue ?? []), ...(scenario?.forces?.red ?? [])];
        syncUnits(battlefield, units, scenario?.table?.height);
      }
    });
    observer.observe(battlefield, { childList:true });

    return Object.freeze({
      composeTerrain(nextScenario = scenario) {
        scenario = nextScenario ?? scenario;
        composeTerrain({ battlefield, terrainLayer, scenario });
        const units = [...(scenario?.forces?.blue ?? []), ...(scenario?.forces?.red ?? [])];
        syncUnits(battlefield, units, scenario?.table?.height);
      },
      syncUnits:units => syncUnits(battlefield, units ?? [...(scenario?.forces?.blue ?? []), ...(scenario?.forces?.red ?? [])], scenario?.table?.height),
      destroy:() => observer.disconnect()
    });
  }

  window.CrossroadsSceneCompositor = Object.freeze({ create, composeTerrain, syncUnits, unitDepth, promoteManualObjects });
})();
