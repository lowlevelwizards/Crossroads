"use strict";

(() => {
  const base = window.CrossroadsTerrainPresentation;
  const TYPES = window.CROSSROADS_TERRAIN_TYPES ?? {};
  const LAYERS = window.CrossroadsLayerPolicy;
  if (!base?.renderScenarioTerrain) throw new Error("Terrain presentation must load before terrain-runtime.js.");

  let compositor = null;

  function addFieldRows(piece) {
    const art = piece.querySelector(".terrain-art");
    if (!art || art.childElementCount) return;
    const count = piece.classList.contains("terrain-id-field_cabbage") ? 20 : 12;
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement("span");
      row.className = "field-row";
      art.appendChild(row);
    }
  }

  function namespaceWoodpile(piece) {
    if (!piece.classList.contains("terrain-id-woodpile")) return;
    piece.querySelectorAll(".log").forEach(node => {
      for (const className of [...node.classList]) {
        const match = /^log-(\d+)$/.exec(className);
        if (match) node.classList.replace(className, `woodpile-log-${match[1]}`);
      }
      node.classList.replace("log", "woodpile-log");
    });
  }

  function configurePiece(piece, instance, scenario) {
    namespaceWoodpile(piece);
    if (instance?.visualScale) piece.style.setProperty("--building-visual-scale", String(instance.visualScale));
    if (instance?.depthAnchor) piece.dataset.depthAnchor = String(instance.depthAnchor);
    if (piece.dataset.renderer === "field") addFieldRows(piece);
    const definition = TYPES[instance?.terrainId];
    piece.dataset.inheritLayer = String(instance?.inheritLayer !== false);
    piece.dataset.sceneRole = LAYERS?.terrainRole(definition) ?? "low";
    piece.style.zIndex = String(LAYERS?.terrainLayer(instance, definition, scenario?.table?.height) ?? 360);
  }

  function renderScenarioTerrain(args) {
    const battlefield = args.battlefield ?? args.layer.closest(".battlefield");
    battlefield?.querySelectorAll?.(":scope > .scene-promoted-terrain, :scope > .scene-promoted-object").forEach(node => node.remove());
    base.renderScenarioTerrain(args);
    const byId = new Map((args.scenario?.terrain ?? []).map(instance => [instance.id, instance]));
    for (const piece of args.layer.querySelectorAll(":scope > .terrain-piece")) {
      const instance = byId.get(piece.dataset.terrainInstanceId);
      if (window.CrossroadsScenarioVisibility ? !window.CrossroadsScenarioVisibility.isVisible(instance) : instance?.visible === false || instance?.hidden === true) {
        piece.remove();
        continue;
      }
      configurePiece(piece, instance, args.scenario);
    }
    window.CrossroadsTerrainPatchPresentation?.renderScenarioTerrainPatches({ ...args, battlefield });
    window.CrossroadsLinearTerrainPresentation?.renderScenarioLinearTerrain(args);

    const editorMode = document.body?.classList?.contains("editor-app");
    if (editorMode) {
      window.CrossroadsSceneCompositor?.composeTerrain?.({ battlefield, terrainLayer:args.layer, scenario:args.scenario });
    } else {
      if (!compositor && battlefield && window.CrossroadsSceneCompositor) compositor = window.CrossroadsSceneCompositor.create({ battlefield, terrainLayer:args.layer });
      compositor?.composeTerrain(args.scenario);
    }
  }

  window.CrossroadsTerrainPresentation = Object.freeze({ ...base, renderScenarioTerrain });
})();
