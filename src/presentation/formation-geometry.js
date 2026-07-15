"use strict";

(() => {
  function screenDeltaBetweenRects(startRect, endRect) {
    return { x: startRect.left - endRect.left, y: startRect.top - endRect.top };
  }
  window.CrossroadsFormationGeometry = Object.freeze({ screenDeltaBetweenRects });
})();
