"use strict";

(() => {
  const base = window.CrossroadsTerrainPresentation;
  if (!base?.renderScenarioTerrain) {
    throw new Error("Terrain presentation must load before terrain-polish.js.");
  }

  function addFieldRows(piece) {
    const art = piece.querySelector(".terrain-art");
    if (!art || art.childElementCount > 0) return;
    const count = piece.classList.contains("terrain-id-field_cabbage") ? 20 : 12;
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement("span");
      row.className = "field-row";
      art.appendChild(row);
    }
  }

  function namespacePrimitives(piece) {
    if (!piece.classList.contains("terrain-id-woodpile")) return;
    piece.querySelectorAll(".log").forEach(node => {
      for (const className of [...node.classList]) {
        const match = /^log-(\d+)$/.exec(className);
        if (match) {
          node.classList.remove(className);
          node.classList.add(`woodpile-log-${match[1]}`);
        }
      }
      node.classList.remove("log");
      node.classList.add("woodpile-log");
    });
  }

  function applyDepthMetadata(piece, scenario) {
    const tableHeight = Number(scenario?.table?.height) || 48;
    const top = Number.parseFloat(piece.style.top) || 0;
    const height = Number.parseFloat(piece.style.height) || 0;
    const depth = Math.round((top + height) / 100 * tableHeight * 10);
    piece.style.setProperty("--scene-depth", String(depth));
    const family = piece.dataset.terrainFamily;
    if (["ground", "transport", "water"].includes(family)) {
      piece.classList.add("terrain-ground-plane");
      piece.style.zIndex = "10";
    } else if (family === "building") {
      piece.style.zIndex = String(1000 + depth);
    } else {
      piece.style.zIndex = "120";
    }
  }

  function postProcess(layer, scenario) {
    const byId = new Map((scenario?.terrain ?? []).map(instance => [instance.id, instance]));
    for (const piece of layer.querySelectorAll(".terrain-piece")) {
      namespacePrimitives(piece);
      applyDepthMetadata(piece, scenario);
      const instance = byId.get(piece.dataset.terrainInstanceId);
      if (instance?.visualScale) piece.style.setProperty("--building-visual-scale", String(instance.visualScale));
      if (piece.dataset.renderer === "field") addFieldRows(piece);
    }
  }

  function refreshUnitDepth() {
    const battlefield = document.getElementById("battlefield");
    if (!battlefield) return;
    const candidates = battlefield.querySelectorAll(":scope > .unit, :scope > .unit-token, :scope > [data-unit-id]");
    for (const unit of candidates) {
      const topPercent = Number.parseFloat(unit.style.top);
      if (!Number.isFinite(topPercent)) continue;
      unit.style.zIndex = String(1000 + Math.round(topPercent * 4.8));
    }
  }

  function installDepthObserver() {
    const battlefield = document.getElementById("battlefield");
    if (!battlefield || battlefield.dataset.depthObserverInstalled) return;
    battlefield.dataset.depthObserverInstalled = "true";
    const observer = new MutationObserver(refreshUnitDepth);
    observer.observe(battlefield, { childList:true, subtree:false });
    refreshUnitDepth();
  }

  function renderScenarioTerrain(args) {
    base.renderScenarioTerrain(args);
    window.CrossroadsLinearTerrainPresentation?.renderScenarioLinearTerrain(args);
    postProcess(args.layer, args.scenario);
    installDepthObserver();
    refreshUnitDepth();
  }

  window.CrossroadsTerrainPresentation = Object.freeze({ ...base, renderScenarioTerrain });
})();
