"use strict";

(() => {
  const VIEWPORT = window.CrossroadsTableViewport;
  const MIN_ZOOM = .18;
  const MAX_ZOOM = 4.5;
  const SETTLE_DELAY = 125;
  const PIXELS_PER_INCH = 15;

  function create({
    battlefieldViewport,
    battlefieldSurface,
    zoomReadout,
    clamp,
    getTableSize = () => ({ width:72, height:48 }),
    onViewChanged = () => {},
    onTransformChanged = () => {},
    onViewSettled = onViewChanged
  }) {
    if (!VIEWPORT) throw new Error("CrossroadsTableViewport must load before CrossroadsCamera.");

    let zoom = 1;
    let fittedZoom = 1;
    let quarterTurns = 0;
    let manualRotation = false;
    let geometry = VIEWPORT.surfaceGeometry({ boardWidth:1080, boardHeight:720, zoom:1, viewportWidth:1080, viewportHeight:720 });
    let settleTimer = 0;

    const narrowBoardLayout = () => matchMedia("(max-width: 820px)").matches || (matchMedia("(pointer: coarse)").matches && innerWidth <= 1180);
    const adaptivePortrait = () => narrowBoardLayout() && innerHeight > innerWidth;
    const cameraIsRotated = () => Math.abs(quarterTurns % 2) === 1;
    const tableSize = () => VIEWPORT.normalizeTable(getTableSize());
    const naturalBoard = () => VIEWPORT.boardPixels(tableSize(), PIXELS_PER_INCH);

    function syncAutomaticCameraRotation() {
      if (!manualRotation) quarterTurns = adaptivePortrait() ? 1 : 0;
    }

    function syncCameraViewportBox() {
      if (!battlefieldViewport) return;
      if (narrowBoardLayout()) {
        battlefieldViewport.style.removeProperty("--desktop-camera-height");
        battlefieldViewport.style.removeProperty("height");
        return;
      }
      const rect = battlefieldViewport.getBoundingClientRect();
      const height = Math.max(320, innerHeight - Math.max(rect.top, 0) - 14);
      battlefieldViewport.style.setProperty("--desktop-camera-height", `${height}px`);
      battlefieldViewport.style.height = `${height}px`;
    }

    function cameraViewportSize() {
      syncCameraViewportBox();
      const rect = battlefieldViewport?.getBoundingClientRect();
      return {
        width:rect ? Math.max(1, Math.min(battlefieldViewport.clientWidth, innerWidth - Math.max(rect.left, 0))) : innerWidth,
        height:rect ? Math.max(1, Math.min(battlefieldViewport.clientHeight, innerHeight - Math.max(rect.top, 0) - 14)) : innerHeight
      };
    }

    function rotatedBoardPixels() {
      const board = naturalBoard();
      return cameraIsRotated()
        ? { width:board.height, height:board.width, naturalWidth:board.width, naturalHeight:board.height }
        : { width:board.width, height:board.height, naturalWidth:board.width, naturalHeight:board.height };
    }

    function calculateFitZoom() {
      const viewport = cameraViewportSize();
      const board = rotatedBoardPixels();
      return VIEWPORT.fitZoom({
        viewportWidth:viewport.width,
        viewportHeight:viewport.height,
        boardWidth:board.width,
        boardHeight:board.height,
        margin:28,
        min:MIN_ZOOM,
        max:MAX_ZOOM
      });
    }

    function recalculateFitZoom() {
      fittedZoom = calculateFitZoom();
      return fittedZoom;
    }

    const relativeZoom = () => fittedZoom > 0 ? zoom / fittedZoom : 1;

    function snapshot() {
      return Object.freeze({
        zoom,
        fittedZoom,
        relativeZoom:relativeZoom(),
        rotated:cameraIsRotated(),
        table:tableSize()
      });
    }

    function updateCameraDetailLevel() {
      const relative = relativeZoom();
      document.documentElement.style.setProperty("--camera-relative-zoom", relative.toFixed(3));
      document.documentElement.style.setProperty("--miniature-scale", "1");
      document.body.classList.toggle("camera-far", relative < .82);
      document.body.classList.toggle("camera-normal", relative >= .82 && relative < 1.65);
      document.body.classList.toggle("camera-close", relative >= 1.65);
      document.body.classList.toggle("camera-inspection", relative >= 2.25);
      document.body.classList.toggle("camera-rotated", cameraIsRotated());
    }

    function updateReadout() {
      const relative = relativeZoom();
      const atFit = Math.abs(relative - 1) < .015;
      if (zoomReadout) zoomReadout.textContent = atFit ? "FIT" : `${Math.round(relative * 100)}%`;
      document.body.classList.toggle("fit-table-active", atFit);
    }

    function apply() {
      if (!battlefieldSurface) return;
      const viewport = cameraViewportSize();
      const board = rotatedBoardPixels();
      geometry = VIEWPORT.surfaceGeometry({
        viewportWidth:viewport.width,
        viewportHeight:viewport.height,
        boardWidth:board.width,
        boardHeight:board.height,
        zoom,
        minimumMargin:150,
        marginRatio:.58
      });

      const natural = naturalBoard();
      battlefieldSurface.style.setProperty("--camera-width", `${geometry.surfaceWidth}px`);
      battlefieldSurface.style.setProperty("--camera-height", `${geometry.surfaceHeight}px`);
      battlefieldSurface.style.setProperty("--board-left", `${geometry.boardLeft}px`);
      battlefieldSurface.style.setProperty("--board-top", `${geometry.boardTop}px`);
      battlefieldSurface.style.setProperty("--board-width", `${natural.width}px`);
      battlefieldSurface.style.setProperty("--board-height", `${natural.height}px`);
      battlefieldSurface.style.setProperty("--board-transform-origin", "0 0");
      battlefieldSurface.style.setProperty("--table-grid-x", `${6 / Math.max(1, tableSize().width) * 100}%`);
      battlefieldSurface.style.setProperty("--table-grid-y", `${6 / Math.max(1, tableSize().height) * 100}%`);
      battlefieldSurface.style.setProperty(
        "--board-transform",
        cameraIsRotated()
          ? `translateX(${natural.height * zoom}px) rotate(90deg) scale(${zoom})`
          : `scale(${zoom})`
      );
      Object.assign(battlefieldSurface.style, {
        width:`${geometry.surfaceWidth}px`,
        height:`${geometry.surfaceHeight}px`,
        minWidth:`${geometry.surfaceWidth}px`,
        minHeight:`${geometry.surfaceHeight}px`,
        flex:"0 0 auto"
      });
      updateReadout();
      onTransformChanged(snapshot());
    }

    function applyCameraSurfaceSize() {
      fittedZoom = calculateFitZoom();
      apply();
      updateCameraDetailLevel();
    }

    function settle() {
      clearTimeout(settleTimer);
      document.body.classList.add("camera-transforming");
      settleTimer = setTimeout(() => {
        document.body.classList.remove("camera-transforming");
        updateCameraDetailLevel();
        onViewSettled(snapshot());
      }, SETTLE_DELAY);
    }

    function cameraPointFromClient(x, y) {
      const rect = battlefieldViewport.getBoundingClientRect();
      return { x:x - rect.left, y:y - rect.top };
    }

    function setZoomImmediate(nextZoom) {
      const fit = fittedZoom || calculateFitZoom();
      zoom = clamp(nextZoom, Math.max(MIN_ZOOM, fit * .45), Math.min(MAX_ZOOM, fit * 8));
      return zoom;
    }

    function setBoardZoom(nextZoom, options = {}) {
      if (!battlefieldViewport || !battlefieldSurface) return;
      const point = options.viewportPoint ?? { x:battlefieldViewport.clientWidth / 2, y:battlefieldViewport.clientHeight / 2 };
      const oldWidth = Math.max(1, battlefieldSurface.offsetWidth);
      const oldHeight = Math.max(1, battlefieldSurface.offsetHeight);
      const fractionX = (battlefieldViewport.scrollLeft + point.x) / oldWidth;
      const fractionY = (battlefieldViewport.scrollTop + point.y) / oldHeight;
      fittedZoom = calculateFitZoom();
      setZoomImmediate(nextZoom);
      apply();
      requestAnimationFrame(() => {
        battlefieldViewport.scrollLeft = fractionX * battlefieldSurface.offsetWidth - point.x;
        battlefieldViewport.scrollTop = fractionY * battlefieldSurface.offsetHeight - point.y;
      });
      settle();
    }

    function centerTable(options = {}) {
      const centered = VIEWPORT.centeredScroll({
        contentWidth:battlefieldSurface.offsetWidth,
        contentHeight:battlefieldSurface.offsetHeight,
        viewportWidth:battlefieldViewport.clientWidth,
        viewportHeight:battlefieldViewport.clientHeight
      });
      battlefieldViewport.scrollTo({
        left:centered.left,
        top:centered.top,
        behavior:options.instant ? "auto" : "smooth"
      });
    }

    function fitTable() {
      syncAutomaticCameraRotation();
      syncCameraViewportBox();
      requestAnimationFrame(() => {
        fittedZoom = calculateFitZoom();
        zoom = fittedZoom;
        apply();
        updateCameraDetailLevel();
        requestAnimationFrame(() => centerTable({ instant:true }));
        onViewSettled(snapshot());
      });
    }

    function zoomCameraByFactor(factor, point = null) {
      setBoardZoom(zoom * factor, { viewportPoint:point ?? { x:battlefieldViewport.clientWidth / 2, y:battlefieldViewport.clientHeight / 2 } });
    }

    function rotateBoard() {
      manualRotation = true;
      quarterTurns = quarterTurns === 0 ? 1 : 0;
      applyCameraSurfaceSize();
      requestAnimationFrame(() => centerTable({ instant:true }));
      onViewSettled(snapshot());
    }

    function tablePointToSurfacePixels(point) {
      const size = tableSize();
      const natural = naturalBoard();
      const x = Number(point.x) * natural.width / size.width * zoom;
      const y = Number(point.y) * natural.height / size.height * zoom;
      return cameraIsRotated()
        ? { x:geometry.boardLeft + natural.height * zoom - y, y:geometry.boardTop + x }
        : { x:geometry.boardLeft + x, y:geometry.boardTop + y };
    }

    function frameTablePoint(point, options = {}) {
      if (!point || !battlefieldViewport || !battlefieldSurface) return;
      const target = tablePointToSurfacePixels(point);
      const margin = options.margin ?? 72;
      const left = battlefieldViewport.scrollLeft;
      const top = battlefieldViewport.scrollTop;
      const right = left + battlefieldViewport.clientWidth;
      const bottom = top + battlefieldViewport.clientHeight;
      let nextLeft = left;
      let nextTop = top;
      if (target.x < left + margin) nextLeft = target.x - margin;
      else if (target.x > right - margin) nextLeft = target.x - battlefieldViewport.clientWidth + margin;
      if (target.y < top + margin) nextTop = target.y - margin;
      else if (target.y > bottom - margin) nextTop = target.y - battlefieldViewport.clientHeight + margin;
      battlefieldViewport.scrollTo({
        left:Math.max(0, nextLeft),
        top:Math.max(0, nextTop),
        behavior:options.instant ? "auto" : "smooth"
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
      cameraCanPan:() => true,
      tablePointToSurfacePixels,
      frameTablePoint,
      getBoardZoom:() => zoom,
      getFittedZoom:() => fittedZoom
    });
  }

  window.CrossroadsCamera = Object.freeze({ create });
})();
