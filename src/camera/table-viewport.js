"use strict";

(() => {
  const DEFAULT_TABLE = Object.freeze({ width:72, height:48 });

  function number(value, fallback) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function normalizeTable(table, fallback = DEFAULT_TABLE) {
    return Object.freeze({
      width:Math.max(1, number(table?.width, fallback.width)),
      height:Math.max(1, number(table?.height, fallback.height))
    });
  }

  function boardPixels(table, pixelsPerInch = 15) {
    const size = normalizeTable(table);
    const ppi = Math.max(.1, number(pixelsPerInch, 15));
    return Object.freeze({
      width:size.width * ppi,
      height:size.height * ppi,
      pixelsPerInch:ppi,
      table:size
    });
  }

  function fitZoom(options = {}) {
    const viewportWidth = Math.max(1, number(options.viewportWidth, 1));
    const viewportHeight = Math.max(1, number(options.viewportHeight, 1));
    const boardWidth = Math.max(1, number(options.boardWidth, 1));
    const boardHeight = Math.max(1, number(options.boardHeight, 1));
    const margin = Math.max(0, number(options.margin, 28));
    const min = Math.max(.01, number(options.min, .1));
    const max = Math.max(min, number(options.max, 8));
    const usableWidth = Math.max(1, viewportWidth - margin * 2);
    const usableHeight = Math.max(1, viewportHeight - margin * 2);
    return Math.min(max, Math.max(min, Math.min(usableWidth / boardWidth, usableHeight / boardHeight)));
  }

  function surfaceGeometry(options = {}) {
    const viewportWidth = Math.max(1, number(options.viewportWidth, 1));
    const viewportHeight = Math.max(1, number(options.viewportHeight, 1));
    const boardWidth = Math.max(1, number(options.boardWidth, 1));
    const boardHeight = Math.max(1, number(options.boardHeight, 1));
    const zoom = Math.max(.01, number(options.zoom, 1));
    const minimumMargin = Math.max(0, number(options.minimumMargin, 96));
    const marginRatio = Math.max(0, number(options.marginRatio, .5));
    const visualWidth = boardWidth * zoom;
    const visualHeight = boardHeight * zoom;
    const marginX = Math.max(minimumMargin, viewportWidth * marginRatio);
    const marginY = Math.max(minimumMargin, viewportHeight * marginRatio);
    return Object.freeze({
      visualWidth,
      visualHeight,
      marginX,
      marginY,
      boardLeft:marginX,
      boardTop:marginY,
      surfaceWidth:visualWidth + marginX * 2,
      surfaceHeight:visualHeight + marginY * 2
    });
  }


  function containedSurfaceGeometry(options = {}) {
    const viewportWidth = Math.max(1, number(options.viewportWidth, 1));
    const viewportHeight = Math.max(1, number(options.viewportHeight, 1));
    const boardWidth = Math.max(1, number(options.boardWidth, 1));
    const boardHeight = Math.max(1, number(options.boardHeight, 1));
    const zoom = Math.max(.01, number(options.zoom, 1));
    const padding = Math.max(0, number(options.padding, 28));
    const visualWidth = boardWidth * zoom;
    const visualHeight = boardHeight * zoom;
    const surfaceWidth = Math.max(viewportWidth, visualWidth + padding * 2);
    const surfaceHeight = Math.max(viewportHeight, visualHeight + padding * 2);
    return Object.freeze({
      visualWidth,
      visualHeight,
      marginX:(surfaceWidth - visualWidth) / 2,
      marginY:(surfaceHeight - visualHeight) / 2,
      boardLeft:(surfaceWidth - visualWidth) / 2,
      boardTop:(surfaceHeight - visualHeight) / 2,
      surfaceWidth,
      surfaceHeight
    });
  }

  function centeredScroll(options = {}) {
    const contentWidth = Math.max(1, number(options.contentWidth, 1));
    const contentHeight = Math.max(1, number(options.contentHeight, 1));
    const viewportWidth = Math.max(1, number(options.viewportWidth, 1));
    const viewportHeight = Math.max(1, number(options.viewportHeight, 1));
    return Object.freeze({
      left:Math.max(0, (contentWidth - viewportWidth) / 2),
      top:Math.max(0, (contentHeight - viewportHeight) / 2)
    });
  }

  window.CrossroadsTableViewport = Object.freeze({
    DEFAULT_TABLE,
    normalizeTable,
    boardPixels,
    fitZoom,
    surfaceGeometry,
    containedSurfaceGeometry,
    centeredScroll
  });
})();
