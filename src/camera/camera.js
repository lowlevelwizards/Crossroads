"use strict";

(() => {
  const WORLD_WIDTH = 1080;
  const WORLD_HEIGHT = 720;
  const MIN_SCALE = 0.18;
  const MAX_SCALE = 4.5;

  function create({
    battlefieldViewport,
    battlefieldSurface,
    zoomReadout,
    clamp,
    onViewChanged = () => {}
  }) {
    let boardZoom = 1;
    let fittedBoardZoom = 1;
    let rotationQuarterTurns = 0;
    let rotationOverridden = false;
    let marginX = 180;
    let marginY = 180;
    let boardOffsetX = 0;
    let boardOffsetY = 0;
    let boardVisualWidth = WORLD_WIDTH;
    let boardVisualHeight = WORLD_HEIGHT;

    function narrowBoardLayout() {
      return window.matchMedia("(max-width: 820px)").matches ||
        (window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 1180);
    }

    function adaptivePortrait() {
      return narrowBoardLayout() && window.innerHeight > window.innerWidth;
    }

    function syncAutomaticCameraRotation() {
      if (!rotationOverridden) rotationQuarterTurns = adaptivePortrait() ? 1 : 0;
    }

    function cameraIsRotated() {
      return Math.abs(rotationQuarterTurns % 2) === 1;
    }

    function syncCameraViewportBox() {
      if (!battlefieldViewport) return;
      if (narrowBoardLayout()) {
        battlefieldViewport.style.removeProperty("--desktop-camera-height");
        battlefieldViewport.style.removeProperty("height");
        return;
      }
      const rect = battlefieldViewport.getBoundingClientRect();
      const availableHeight = Math.max(
        320,
        window.innerHeight - Math.max(rect.top, 0) - 14
      );
      battlefieldViewport.style.setProperty("--desktop-camera-height", `${availableHeight}px`);
      battlefieldViewport.style.height = `${availableHeight}px`;
    }

    function cameraViewportSize() {
      syncCameraViewportBox();
      const rect = battlefieldViewport?.getBoundingClientRect();
      const width = rect
        ? Math.max(1, Math.min(
            battlefieldViewport.clientWidth,
            window.innerWidth - Math.max(rect.left, 0)
          ))
        : window.innerWidth;
      const height = rect
        ? Math.max(1, Math.min(
            battlefieldViewport.clientHeight,
            window.innerHeight - Math.max(rect.top, 0) - 14
          ))
        : window.innerHeight;
      return { width, height };
    }

    function calculateFitZoom() {
      const viewport = cameraViewportSize();
      const baseWidth = cameraIsRotated() ? WORLD_HEIGHT : WORLD_WIDTH;
      const baseHeight = cameraIsRotated() ? WORLD_WIDTH : WORLD_HEIGHT;
      return clamp(
        Math.min(viewport.width / baseWidth, viewport.height / baseHeight),
        MIN_SCALE,
        MAX_SCALE
      );
    }

    function recalculateFitZoom() {
      fittedBoardZoom = calculateFitZoom();
      return fittedBoardZoom;
    }

    function updateCameraDetailLevel() {
      const relativeZoom = fittedBoardZoom > 0 ? boardZoom / fittedBoardZoom : 1;
      const miniatureScale = clamp(
        0.90 + Math.max(0, relativeZoom - 0.82) * 0.48,
        0.90,
        1.82
      );
      document.documentElement.style.setProperty("--camera-relative-zoom", relativeZoom.toFixed(3));
      document.documentElement.style.setProperty("--miniature-scale", miniatureScale.toFixed(3));
      document.body.classList.toggle("camera-far", relativeZoom < 0.82);
      document.body.classList.toggle("camera-normal", relativeZoom >= 0.82 && relativeZoom < 1.65);
      document.body.classList.toggle("camera-close", relativeZoom >= 1.65);
      document.body.classList.toggle("camera-inspection", relativeZoom >= 2.25);
      document.body.classList.toggle("camera-rotated", cameraIsRotated());
    }

    function applyCameraSurfaceSize() {
      if (!battlefieldSurface) return;
      const viewport = cameraViewportSize();
      const boardWidth = WORLD_WIDTH * boardZoom;
      const boardHeight = WORLD_HEIGHT * boardZoom;
      boardVisualWidth = cameraIsRotated() ? boardHeight : boardWidth;
      boardVisualHeight = cameraIsRotated() ? boardWidth : boardHeight;
      marginX = Math.max(150, viewport.width * 0.58);
      marginY = Math.max(150, viewport.height * 0.58);
      boardOffsetX = marginX;
      boardOffsetY = marginY;

      const stageWidth = boardVisualWidth + marginX * 2;
      const stageHeight = boardVisualHeight + marginY * 2;

      battlefieldSurface.style.setProperty("--camera-width", `${stageWidth}px`);
      battlefieldSurface.style.setProperty("--camera-height", `${stageHeight}px`);
      battlefieldSurface.style.setProperty("--board-left", `${boardOffsetX}px`);
      battlefieldSurface.style.setProperty("--board-top", `${boardOffsetY}px`);
      battlefieldSurface.style.setProperty("--board-width", `${boardWidth}px`);
      battlefieldSurface.style.setProperty("--board-height", `${boardHeight}px`);
      battlefieldSurface.style.setProperty(
        "--board-transform",
        cameraIsRotated() ? `translateX(${boardHeight}px) rotate(90deg)` : "none"
      );
      battlefieldSurface.style.width = `${stageWidth}px`;
      battlefieldSurface.style.height = `${stageHeight}px`;
      battlefieldSurface.style.minWidth = `${stageWidth}px`;
      battlefieldSurface.style.minHeight = `${stageHeight}px`;
      battlefieldSurface.style.flex = "0 0 auto";

      fittedBoardZoom = calculateFitZoom();
      const relativeZoom = fittedBoardZoom > 0 ? boardZoom / fittedBoardZoom : 1;
      const isFit = Math.abs(relativeZoom - 1) < 0.015;
      if (zoomReadout) zoomReadout.textContent = isFit ? "FIT" : `${Math.round(relativeZoom * 100)}%`;
      document.body.classList.toggle("fit-table-active", isFit);
      updateCameraDetailLevel();
    }

    function cameraPointFromClient(clientX, clientY) {
      const rect = battlefieldViewport.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function setZoomImmediate(nextZoom) {
      const minZoom = Math.max(MIN_SCALE, (fittedBoardZoom || calculateFitZoom()) * 0.45);
      const maxZoom = Math.min(MAX_SCALE, (fittedBoardZoom || calculateFitZoom()) * 8);
      boardZoom = clamp(nextZoom, minZoom, maxZoom);
      return boardZoom;
    }

    function setBoardZoom(nextZoom, options = {}) {
      if (!battlefieldViewport || !battlefieldSurface) return;
      const viewportPoint = options.viewportPoint ?? {
        x: battlefieldViewport.clientWidth / 2,
        y: battlefieldViewport.clientHeight / 2
      };
      const oldWidth = Math.max(1, battlefieldSurface.offsetWidth);
      const oldHeight = Math.max(1, battlefieldSurface.offsetHeight);
      const focusX = (battlefieldViewport.scrollLeft + viewportPoint.x) / oldWidth;
      const focusY = (battlefieldViewport.scrollTop + viewportPoint.y) / oldHeight;

      fittedBoardZoom = calculateFitZoom();
      setZoomImmediate(nextZoom);
      applyCameraSurfaceSize();

      requestAnimationFrame(() => {
        battlefieldViewport.scrollLeft =
          focusX * battlefieldSurface.offsetWidth - viewportPoint.x;
        battlefieldViewport.scrollTop =
          focusY * battlefieldSurface.offsetHeight - viewportPoint.y;
      });
      onViewChanged();
    }

    function centerTable(options = {}) {
      const centerX = boardOffsetX + boardVisualWidth / 2;
      const centerY = boardOffsetY + boardVisualHeight / 2;
      battlefieldViewport.scrollTo({
        left: centerX - battlefieldViewport.clientWidth / 2,
        top: centerY - battlefieldViewport.clientHeight / 2,
        behavior: options.instant ? "auto" : "smooth"
      });
    }

    function fitTable() {
      syncAutomaticCameraRotation();
      syncCameraViewportBox();
      requestAnimationFrame(() => {
        fittedBoardZoom = calculateFitZoom();
        boardZoom = fittedBoardZoom;
        applyCameraSurfaceSize();
        requestAnimationFrame(() => centerTable({ instant: true }));
        onViewChanged();
      });
    }

    function zoomCameraByFactor(factor, viewportPoint = null) {
      setBoardZoom(boardZoom * factor, {
        viewportPoint: viewportPoint ?? {
          x: battlefieldViewport.clientWidth / 2,
          y: battlefieldViewport.clientHeight / 2
        }
      });
    }

    function rotateBoard() {
      rotationOverridden = true;
      rotationQuarterTurns = rotationQuarterTurns === 0 ? 1 : 0;
      applyCameraSurfaceSize();
      requestAnimationFrame(() => centerTable({ instant: true }));
      onViewChanged();
    }

    function cameraCanPan() { return true; }

    function tablePointToSurfacePixels(point) {
      const localX = point.x * (WORLD_WIDTH * boardZoom / 72);
      const localY = point.y * (WORLD_WIDTH * boardZoom / 72);
      const boardHeight = WORLD_HEIGHT * boardZoom;
      if (cameraIsRotated()) {
        return { x: boardOffsetX + boardHeight - localY, y: boardOffsetY + localX };
      }
      return { x: boardOffsetX + localX, y: boardOffsetY + localY };
    }

    function frameTablePoint(point, options = {}) {
      if (!point || !battlefieldViewport || !battlefieldSurface) return;
      const pixel = tablePointToSurfacePixels(point);
      const margin = options.margin ?? 72;
      const left = battlefieldViewport.scrollLeft;
      const top = battlefieldViewport.scrollTop;
      const right = left + battlefieldViewport.clientWidth;
      const bottom = top + battlefieldViewport.clientHeight;
      let nextLeft = left;
      let nextTop = top;
      if (pixel.x < left + margin) nextLeft = pixel.x - margin;
      else if (pixel.x > right - margin) nextLeft = pixel.x - battlefieldViewport.clientWidth + margin;
      if (pixel.y < top + margin) nextTop = pixel.y - margin;
      else if (pixel.y > bottom - margin) nextTop = pixel.y - battlefieldViewport.clientHeight + margin;
      battlefieldViewport.scrollTo({
        left: Math.max(0, nextLeft),
        top: Math.max(0, nextTop),
        behavior: options.instant ? "auto" : "smooth"
      });
    }

    return Object.freeze({
      narrowBoardLayout,
      adaptivePortrait,
      syncAutomaticCameraRotation,
      cameraIsRotated,
      syncCameraViewportBox,
      cameraViewportSize,
      calculateFitZoom,
      recalculateFitZoom,
      updateCameraDetailLevel,
      applyCameraSurfaceSize,
      cameraPointFromClient,
      setBoardZoom,
      setZoomImmediate,
      centerTable,
      fitTable,
      zoomCameraByFactor,
      rotateBoard,
      cameraCanPan,
      tablePointToSurfacePixels,
      frameTablePoint,
      getBoardZoom: () => boardZoom,
      getFittedZoom: () => fittedBoardZoom
    });
  }

  window.CrossroadsCamera = Object.freeze({ create });
})();
