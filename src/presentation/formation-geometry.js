"use strict";

(() => {
  const FACING_CLASSES = Object.freeze([
    "facing-up",
    "facing-down",
    "facing-left",
    "facing-right"
  ]);

  function screenDeltaBetweenRects(startRect, endRect) {
    return {
      x: startRect.left - endRect.left,
      y: startRect.top - endRect.top
    };
  }

  function applyFacing(root, facing) {
    if (!root || !FACING_CLASSES.includes(`facing-${facing}`)) return;

    root.querySelectorAll(".brick-soldier").forEach(soldier => {
      soldier.classList.remove(...FACING_CLASSES);
      soldier.classList.add(`facing-${facing}`);
    });
  }

  window.CrossroadsFormationGeometry = Object.freeze({
    screenDeltaBetweenRects,
    applyFacing
  });
})();
