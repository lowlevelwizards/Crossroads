"use strict";

(() => {
  const DEPTH_BASE = 5000;
  const DEPTH_RANGE = 1000;

  function percent(value) {
    const match = /^(-?\d+(?:\.\d+)?)%$/.exec(String(value || ""));
    return match ? Number(match[1]) : 0;
  }

  function depthFromPercent(value) {
    return DEPTH_BASE + Math.round((value / 100) * DEPTH_RANGE);
  }

  function terrainDepth(piece) {
    const top = percent(piece.style.top);
    const height = percent(piece.style.height);
    const anchor = Number(piece.dataset.depthAnchor || 0.82);
    return depthFromPercent(top + height * anchor);
  }

  function unitDepth(unit) {
    return depthFromPercent(percent(unit.style.top));
  }

  function promoteTallTerrain({ battlefield, terrainLayer }) {
    battlefield.querySelectorAll(".scene-promoted-terrain").forEach(node => node.remove());
    const tall = terrainLayer.querySelectorAll(".terrain-building");
    for (const piece of tall) {
      piece.classList.add("scene-promoted-terrain", "scene-depth-object");
      piece.style.zIndex = String(terrainDepth(piece));
      battlefield.appendChild(piece);
    }
  }

  function syncUnits(battlefield) {
    for (const unit of battlefield.querySelectorAll(".unit")) {
      unit.classList.add("scene-depth-object");
      unit.style.zIndex = String(unitDepth(unit));
    }
  }

  function create({ battlefield, terrainLayer }) {
    if (!battlefield || !terrainLayer) throw new Error("Scene compositor requires battlefield and terrain layer.");

    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && node.matches?.(".unit")))) {
        syncUnits(battlefield);
      }
    });
    observer.observe(battlefield, { childList: true });

    return Object.freeze({
      composeTerrain() {
        promoteTallTerrain({ battlefield, terrainLayer });
        syncUnits(battlefield);
      },
      syncUnits: () => syncUnits(battlefield),
      destroy: () => observer.disconnect()
    });
  }

  window.CrossroadsSceneCompositor = Object.freeze({ create });
})();
