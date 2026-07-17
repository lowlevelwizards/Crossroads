"use strict";

(() => {
  const base = window.CrossroadsTerrainPresentation;
  if (!base?.renderScenarioTerrain) throw new Error("Terrain presentation must load before terrain-runtime.js.");

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

  function configurePiece(piece, instance) {
    namespaceWoodpile(piece);
    if (instance?.visualScale) piece.style.setProperty("--building-visual-scale", String(instance.visualScale));
    if (piece.dataset.renderer === "field") addFieldRows(piece);
  }

  function renderScenarioTerrain(args) {
    base.renderScenarioTerrain(args);
    const byId = new Map((args.scenario?.terrain ?? []).map(instance => [instance.id, instance]));
    for (const piece of args.layer.querySelectorAll(".terrain-piece")) {
      configurePiece(piece, byId.get(piece.dataset.terrainInstanceId));
    }
    window.CrossroadsLinearTerrainPresentation?.renderScenarioLinearTerrain(args);
  }

  window.CrossroadsTerrainPresentation = Object.freeze({ ...base, renderScenarioTerrain });
})();
