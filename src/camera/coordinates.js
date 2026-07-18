"use strict";

(() => {
  function create({
    battlefield,
    tableWidth,
    tableHeight,
    getTableSize = null,
    clamp,
    cameraIsRotated
  }) {
    function size() {
      const dynamic = typeof getTableSize === "function" ? getTableSize() : null;
      return {
        width:Math.max(1, Number(dynamic?.width ?? tableWidth ?? 72)),
        height:Math.max(1, Number(dynamic?.height ?? tableHeight ?? 48))
      };
    }

    function pixelsPerInch() {
      return Math.max(1, battlefield.offsetWidth) / size().width;
    }

    function inchesToPixels(inches) {
      return inches * pixelsPerInch();
    }

    function tablePointToPixels(point) {
      const ppi = pixelsPerInch();
      return { x:point.x * ppi, y:point.y * ppi };
    }

    function tableVectorToScreenVector(dx, dy) {
      if (!cameraIsRotated()) return { x:dx, y:dy };
      return { x:-dy, y:dx };
    }

    function eventToTablePoint(event) {
      const rect = battlefield.getBoundingClientRect();
      const table = size();
      const visualX = clamp(event.clientX - rect.left, 0, Math.max(1, rect.width));
      const visualY = clamp(event.clientY - rect.top, 0, Math.max(1, rect.height));

      if (cameraIsRotated()) {
        return {
          x:clamp(visualY / Math.max(1, rect.height) * table.width, 0, table.width),
          y:clamp((1 - visualX / Math.max(1, rect.width)) * table.height, 0, table.height)
        };
      }

      return {
        x:clamp(visualX / Math.max(1, rect.width) * table.width, 0, table.width),
        y:clamp(visualY / Math.max(1, rect.height) * table.height, 0, table.height)
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
