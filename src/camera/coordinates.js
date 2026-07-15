"use strict";

(() => {
  function create({
    battlefield,
    tableWidth,
    tableHeight,
    clamp,
    cameraIsRotated
  }) {
    function pixelsPerInch() {
      return Math.max(1, battlefield.offsetWidth) / tableWidth;
    }

    function inchesToPixels(inches) {
      return inches * pixelsPerInch();
    }

    function tablePointToPixels(point) {
      const ppi = pixelsPerInch();
      return { x: point.x * ppi, y: point.y * ppi };
    }

    function tableVectorToScreenVector(dx, dy) {
      if (!cameraIsRotated()) return { x: dx, y: dy };

      // The portrait board uses a clockwise 90-degree visual transform.
      // Convert table-space motion into the direction the player sees.
      return { x: -dy, y: dx };
    }

    function eventToTablePoint(event) {
      const rect = battlefield.getBoundingClientRect();
      const ppi = pixelsPerInch();
      let localX;
      let localY;

      if (cameraIsRotated()) {
        const visualX = event.clientX - rect.left;
        const visualY = event.clientY - rect.top;
        localX = visualY;
        localY = battlefield.offsetHeight - visualX;
      } else {
        localX = event.clientX - rect.left;
        localY = event.clientY - rect.top;
      }

      return {
        x: clamp(localX / ppi, 0, tableWidth),
        y: clamp(localY / ppi, 0, tableHeight)
      };
    }

    return Object.freeze({
      pixelsPerInch,
      inchesToPixels,
      tablePointToPixels,
      tableVectorToScreenVector,
      eventToTablePoint
    });
  }

  window.CrossroadsCoordinates = Object.freeze({ create });
})();
