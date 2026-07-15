"use strict";

    /*
    =========================================================================
    CROSSROADS BATTLE ENGINE — ARCHITECTURE MAP

      FOUNDATION CONTRACTS     outcomes, scenario objective registry
      CONFIGURATION & DATA      rules, weapons, terrain, units
      RUNTIME STATE             battle and activation transaction state
      CAMERA & INPUT            zoom, rotation, pan, pointer conversion
      CORE HELPERS              units, geometry, dice, formatting
      BREAKTHROUGH SYSTEM       exit objective and containment scoring
      RENDERING & FEEDBACK      miniatures, overlays, previews, effects
      TURN & ORDER FLOW         bag draw, order choice, cancellation
      MOVEMENT & AMBUSH         paths, terrain costs, interruptions
      SHOOTING & ASSAULT        combat resolution and casualties
      ACTION COMPLETION         activation, round, elimination
      SCENARIO SYSTEM           definitions, deployment, scoring, victory
      REPORTING                 briefing, statistics, after-action report
      ADAPTIVE UI               mobile tray, touch targeting, gestures
      PUBLIC API                stable integration surface
      BUILDING PROTOTYPE        current experimental occupancy extension
      PRESENTATION CONTROLLER   reference drawer and player-facing shell
      BOOTSTRAP                 final initialization sequence

    Gameplay 2.5.3 externalizes scenario data and applies build metadata before the battle engine. Gameplay,
    rules, rendering, input, and existing startup order remain unchanged.
    =========================================================================
    */

    /*
      INFANTRY CORE 1.5E — FOUNDATION CONTRACTS

      DATA       definitions only
      STATE      match state and formal unit outcomes
      GEOMETRY   table-space calculations
      RULES      deterministic game resolution
      SCENARIOS  objective/scoring registries
      VIEW       rendering, camera, overlays, effects
      UI         desktop/touch interaction and reports

      New scenarios extend registries and data. They should not branch on
      scenario IDs inside movement, combat, rendering, or reporting.
    */

    // =========================================================================
    // FOUNDATION CONTRACTS
    // Formal unit outcomes and extensible scenario-objective handlers.
    // =========================================================================
    const UNIT_OUTCOME = Object.freeze({
      ACTIVE: "active",
      EXITED: "exited",
      DESTROYED: "destroyed",
      ROUTED: "routed"
    });

    // -------------------------------------------------------------------------
    // BUILD METADATA
    // One authoritative source for browser and player-facing build labels.
    // -------------------------------------------------------------------------
    const BUILD_INFO = window.CROSSROADS_BUILD_INFO;

    // -------------------------------------------------------------------------
    // RUNTIME REGISTRIES
    // Central extension points. Only the objective registry is active in this
    // phase; terrain, actions, and hooks are intentionally reserved for later.
    // -------------------------------------------------------------------------
    const REGISTRY = Object.freeze({
      objectives: new Map(),
      terrain: new Map(),
      actions: new Map(),
      hooks: Object.freeze({
        beforeRestart: [],
        afterRestart: [],
        beforeRender: [],
        afterRender: []
      })
    });

    function registerScenarioObjective(type, handler) {
      if (!type || !handler) throw new Error("Invalid scenario objective handler.");
      REGISTRY.objectives.set(type, Object.freeze({ ...handler }));
    }

    function scenarioObjectiveHandler(type) {
      const handler = REGISTRY.objectives.get(type);
      if (!handler) throw new Error(`Unknown scenario objective type: ${type}`);
      return handler;
    }

    function registerHook(name, callback) {
      const hooks = REGISTRY.hooks[name];
      if (!hooks || typeof callback !== "function") {
        throw new Error(`Invalid game hook registration: ${name}`);
      }
      hooks.push(callback);
      return () => {
        const index = hooks.indexOf(callback);
        if (index >= 0) hooks.splice(index, 1);
      };
    }

    function runHooks(name, context = {}) {
      const hooks = REGISTRY.hooks[name];
      if (!hooks) throw new Error(`Unknown game hook: ${name}`);
      for (const hook of [...hooks]) hook(context);
    }

    function applyBuildInfo() {
      document.title = `CROSSROADS — ${BUILD_INFO.engine} ${BUILD_INFO.version}`;

      const mainMenuBuildLabel = document.getElementById("mainMenuBuildLabel");
      const headerBuildBadge = document.getElementById("headerBuildBadge");
      const referenceBuildStamp = document.getElementById("referenceBuildStamp");

      if (mainMenuBuildLabel) {
        mainMenuBuildLabel.textContent =
          `${BUILD_INFO.engine.toUpperCase()} · ${BUILD_INFO.version.toUpperCase()}`;
      }
      if (headerBuildBadge) headerBuildBadge.textContent = BUILD_INFO.version;
      if (referenceBuildStamp) {
        referenceBuildStamp.textContent =
          `${BUILD_INFO.version.toUpperCase()} · ${BUILD_INFO.codename.toUpperCase()}`;
      }
    }

    function unitIsActive(unit) {
      return Boolean(
        unit &&
        unit.outcome === UNIT_OUTCOME.ACTIVE &&
        unit.soldiers > 0
      );
    }

    function setUnitOutcome(unit, outcome, metadata = {}) {
      if (!unit) return;
      unit.outcome = outcome;
      unit.outcomeRound = metadata.round ?? round;
      unit.outcomeReason = metadata.reason ?? null;
          reconcileBuildingAfterUnitChange(unit);
}

    function normalizeUnitRuntimeState(unit) {
      return {
        ...unit,
        outcome: unit.outcome ?? UNIT_OUTCOME.ACTIVE,
        outcomeRound: unit.outcomeRound ?? null,
        outcomeReason: unit.outcomeReason ?? null,
        exitRound: unit.exitRound ?? null,
        exitZoneId: unit.exitZoneId ?? null,
        exitPoints: unit.exitPoints ?? 0,
        inBuilding: unit.inBuilding ?? null,
        buildingEntryX: unit.buildingEntryX ?? null,
        buildingEntryY: unit.buildingEntryY ?? null,
        mmgDeployed: unit.mmgDeployed ?? false,
        mmgFacing: unit.mmgFacing ?? (unit.faction === "blue" ? 90 : -90)
      };
    }


    /*
      Infantry Core 1.5A source organization
      --------------------------------------
      DATA: weapons, unit types, scenarios
      STATE: match and transaction state
      GEOMETRY: distances, paths, terrain
      RULES: movement, shooting, morale, assault
      RENDER: units, overlays, adaptive HUD
      EFFECTS: queued transient visual feedback

      The downloadable prototype remains a single self-contained HTML file,
      but new visual behavior now enters through one renderer and one effect
      queue rather than order-specific DOM mutations.
    */

    // =========================================================================
    // BUILD CONFIGURATION AND STATIC RULE DATA
    // Feature flags, rules, weapon profiles, terrain, unit templates, forces.
    // =========================================================================
    const STAGE = window.CROSSROADS_STAGE;
    const FEATURES = STAGE.features;

    const RULES = {
      tableWidth: 72,
      tableHeight: 48,
      maxRounds: 6,
      objective: { x: 36, y: 24, radius: 3 },
      runDistance: 12,
      advanceDistance: 6,
      assaultDistance: 12,
      rifleRange: 24,
      lmgRange: 36,
      baseHitTarget: 4,
      regularDamageTarget: 4,
      unitCollisionRadius: 1.6,
      unitSeparation: 3.4,
      wallProtectionDepth: 4,
      wallCrossingCost: 2,
      roughGroundMultiplier: 2,
      ambushSampleStep: 0.35,
      reactionFireThreshold: 6,
      commandRadius: 6,
      commandMoraleBonus: 1,
      smgRange: 12,
      pistolRange: 6,
      mmgRange: 36
    };

    const WEAPON_PROFILES = window.CROSSROADS_WEAPON_PROFILES ?? Object.freeze({
      rifle: Object.freeze({ key: "rifle", label: "Rifle", short: "R", range: 24, shots: 1, assault: false, fixed: false }),
      smg: Object.freeze({ key: "smg", label: "SMG", short: "S", range: 12, shots: 2, assault: true, fixed: false }),
      lmg: Object.freeze({ key: "lmg", label: "LMG", short: "L", range: 36, shots: 4, assault: false, fixed: false }),
      pistol: Object.freeze({ key: "pistol", label: "Pistol", short: "P", range: 6, shots: 1, assault: true, fixed: false }),
      mmg: Object.freeze({ key: "mmg", label: "MMG", short: "MMG", range: 36, shots: 5, reducedShots: 2, crewRequired: 2, crewWeapon: true, assault: false, fixed: true })
    });

    const TERRAIN = window.CROSSROADS_TERRAIN ?? {
      woods: { id: "woods", label: "woods", type: "soft", x: 15, y: 28, width: 18, height: 14, save: 5 },
      wall: { id: "wall", label: "low wall", type: "hard", x: 38, y: 30, width: 17, height: 2.5, save: 4 },
      building: { id: "building", label: "farmhouse", type: "blocking", x: 28, y: 4, width: 13, height: 13 }
    };


    const UNIT_QUALITY = window.CROSSROADS_UNIT_QUALITY;
    if (!UNIT_QUALITY) {
      throw new Error("unit-quality.js did not load. Upload unit-quality.js beside index.html.");
    }

    function qualityProfile(unitOrQuality) {
      const qualityId =
        typeof unitOrQuality === "string"
          ? unitOrQuality
          : unitOrQuality?.quality;
      return UNIT_QUALITY[qualityId] ?? UNIT_QUALITY.regular;
    }

    function qualityLabel(unit) {
      return qualityProfile(unit).label;
    }

    // Centralized unit templates now live in unit-types.js.
    const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES ?? Object.freeze({
      officer: Object.freeze({ quality: "regular", role: "officer", name: "Officer", soldiers: 2, morale: 9, weapons: Object.freeze({ pistol: 2 }), casualtyOrder: Object.freeze(["pistol"]) }),
      rifleSquad: Object.freeze({ quality: "regular", role: "line", name: "Rifle Squad", soldiers: 6, morale: 9, weapons: Object.freeze({ rifle: 5, lmg: 1 }), casualtyOrder: Object.freeze(["rifle", "lmg"]) }),
      assaultSquad: Object.freeze({ quality: "regular", role: "assault", name: "Assault Squad", soldiers: 6, morale: 9, weapons: Object.freeze({ rifle: 3, smg: 3 }), casualtyOrder: Object.freeze(["rifle", "smg"]) }),
      mmgTeam: Object.freeze({ quality: "regular", role: "support", name: "MMG Team", soldiers: 3, morale: 9, weapons: Object.freeze({ mmg: 1 }), casualtyOrder: Object.freeze([]) })
    });

    const CORE_SCENARIO_12A = window.CROSSROADS_CORE_SCENARIO_12A;
    if (!CORE_SCENARIO_12A) {
      throw new Error("scenarios.js did not provide the core force definition.");
    }

    function instantiateScenarioUnits(scenario) {
      const result = [];
      for (const faction of ["blue", "red"]) {
        for (const entry of scenario.forces[faction]) {
          const template = UNIT_TYPES[entry.unitType];
          if (!template) throw new Error(`Unknown unit type: ${entry.unitType}`);
          result.push({
            id: entry.id,
            faction,
            type: entry.unitType,
            role: template.role,
            name: entry.name ?? template.name,
            x: entry.x,
            y: entry.y,
            soldiers: template.soldiers,
            maxSoldiers: template.soldiers,
            weapons: { ...template.weapons },
            casualtyOrder: [...template.casualtyOrder],
            pins: 0,
            quality: entry.quality ?? template.quality ?? "regular",
            morale: qualityProfile(entry.quality ?? template.quality ?? "regular").morale,
            down: false,
            activated: false,
            order: null,
            ambush: false,
            outcome: UNIT_OUTCOME.ACTIVE,
            outcomeRound: null,
            outcomeReason: null,
            inBuilding: null,
            buildingEntryX: null,
            buildingEntryY: null
          });
        }
      }
      return result;
    }

    // =========================================================================
    // LEGACY INITIAL FORCE DATA
    // Removed in Gameplay 2.5.3 after a full-reference audit confirmed that
    // scenario forces are instantiated exclusively from external scenario data.
    // =========================================================================


    // =========================================================================
    // RUNTIME BATTLE STATE
    // Match, activation, overlay, movement, reaction, and deployment state.
    // =========================================================================
    let units = [];
    let round = 1;
    let scores = { blue: 0, red: 0 };
    let bag = [];
    let currentFaction = null;
    let selectedUnitId = null;
    let chosenOrder = null;
    let phase = "ready-to-draw";
    let activationSnapshot = null;
    let battleEnded = false;
    let overlayMode = null;
    const queuedUnitEffects = new Map();
    let announcementTimer = null;
    let orderDiePopTimer = null;
    let movementWaypoint = null;
    let pendingMovement = null;
    let pendingReaction = null;
    let deploymentUnitId = null;

    let transactionLockReason = null;

    // -------------------------------------------------------------------------
    // ACTIVATION TRANSACTIONS
    // Owns reversible unit selection until an action becomes committed.
    // -------------------------------------------------------------------------
    function beginActivationTransaction(unit) {
      activationSnapshot = snapshotUnit(unit);
      transactionLockReason = null;
      updateTransactionBadge();
    }

    function lockActivationTransaction(reason) {
      if (transactionLockReason) return;
      transactionLockReason = reason;
      activationSnapshot = null;
      cancelButton.disabled = true;
      updateTransactionBadge();
    }

    function clearActivationTransaction() {
      transactionLockReason = null;
      activationSnapshot = null;
      updateTransactionBadge();
    }

    // =========================================================================
    // CAMERA AND VIEWPORT SYSTEM
    // Owns fit, zoom, rotation, centering, panning, and camera detail levels.
    // =========================================================================
/* ===== Infantry Core 1.4.2: free-pan camera stage ===== */
    const battlefieldViewport = document.getElementById("battlefieldViewport");
    const battlefieldSurface = document.getElementById("battlefieldSurface");
    const zoomOutButton = document.getElementById("zoomOutButton");
    const zoomInButton = document.getElementById("zoomInButton");
    const fitTableButton = document.getElementById("fitTableButton");
    const rotateBoardButton = document.getElementById("rotateBoardButton");
    const zoomReadout = document.getElementById("zoomReadout");
    const largeControlsButton = document.getElementById("largeControlsButton");
    const cameraHudRound = document.getElementById("cameraHudRound");
    const cameraHudScore = document.getElementById("cameraHudScore");
    const cameraHudDie = document.getElementById("cameraHudDie");

    const CAMERA_WORLD_WIDTH = 1080;
    const CAMERA_WORLD_HEIGHT = 720;
    const CAMERA_MIN_SCALE = 0.18;
    const CAMERA_MAX_SCALE = 4.5;

    let boardZoom = 1;
    let fittedBoardZoom = 1;
    let cameraRotationQuarterTurns = 0;
    let cameraRotationOverridden = false;
    let cameraMarginX = 180;
    let cameraMarginY = 180;
    let boardOffsetX = 0;
    let boardOffsetY = 0;
    let boardVisualWidth = CAMERA_WORLD_WIDTH;
    let boardVisualHeight = CAMERA_WORLD_HEIGHT;

    function narrowBoardLayout() {
      return window.matchMedia("(max-width: 820px)").matches ||
        (window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 1180);
    }

    function adaptivePortrait() {
      return narrowBoardLayout() && window.innerHeight > window.innerWidth;
    }

    function syncAutomaticCameraRotation() {
      if (!cameraRotationOverridden) {
        cameraRotationQuarterTurns = adaptivePortrait() ? 1 : 0;
      }
    }

    function cameraIsRotated() {
      return Math.abs(cameraRotationQuarterTurns % 2) === 1;
    }

    function syncCameraViewportBox() {
      if (!battlefieldViewport) return;

      if (narrowBoardLayout()) {
        battlefieldViewport.style.removeProperty("--desktop-camera-height");
        battlefieldViewport.style.removeProperty("height");
        return;
      }

      const rect = battlefieldViewport.getBoundingClientRect();
      const bottomGap = 14;
      const availableHeight = Math.max(
        320,
        window.innerHeight - Math.max(rect.top, 0) - bottomGap
      );

      battlefieldViewport.style.setProperty(
        "--desktop-camera-height",
        `${availableHeight}px`
      );
      battlefieldViewport.style.height = `${availableHeight}px`;
    }

    function cameraViewportSize() {
      syncCameraViewportBox();

      const rect = battlefieldViewport?.getBoundingClientRect();
      const visibleWidth = rect
        ? Math.max(
            1,
            Math.min(
              battlefieldViewport.clientWidth,
              window.innerWidth - Math.max(rect.left, 0)
            )
          )
        : window.innerWidth;

      const visibleHeight = rect
        ? Math.max(
            1,
            Math.min(
              battlefieldViewport.clientHeight,
              window.innerHeight - Math.max(rect.top, 0) - 14
            )
          )
        : window.innerHeight;

      return {
        width: visibleWidth,
        height: visibleHeight
      };
    }

    function calculateFitZoom() {
      const viewport = cameraViewportSize();
      const baseWidth = cameraIsRotated() ? CAMERA_WORLD_HEIGHT : CAMERA_WORLD_WIDTH;
      const baseHeight = cameraIsRotated() ? CAMERA_WORLD_WIDTH : CAMERA_WORLD_HEIGHT;
      return clamp(
        Math.min(viewport.width / baseWidth, viewport.height / baseHeight),
        CAMERA_MIN_SCALE,
        CAMERA_MAX_SCALE
      );
    }

    function updateCameraDetailLevel() {
      const relativeZoom =
        fittedBoardZoom > 0
          ? boardZoom / fittedBoardZoom
          : 1;

      // Publish a continuous miniature scale as well as the broad LOD bands.
      // The board already zooms; this extra scale makes close inspection reveal
      // genuinely larger, more legible miniatures rather than only more board.
      const miniatureScale = clamp(
        0.90 + Math.max(0, relativeZoom - 0.82) * 0.48,
        0.90,
        1.82
      );
      document.documentElement.style.setProperty(
        "--camera-relative-zoom",
        relativeZoom.toFixed(3)
      );
      document.documentElement.style.setProperty(
        "--miniature-scale",
        miniatureScale.toFixed(3)
      );

      document.body.classList.toggle("camera-far", relativeZoom < 0.82);
      document.body.classList.toggle(
        "camera-normal",
        relativeZoom >= 0.82 && relativeZoom < 1.65
      );
      document.body.classList.toggle("camera-close", relativeZoom >= 1.65);
      document.body.classList.toggle("camera-inspection", relativeZoom >= 2.25);
      document.body.classList.toggle("camera-rotated", cameraIsRotated());
    }

    function applyCameraSurfaceSize() {
      if (!battlefieldSurface) return;

      const viewport = cameraViewportSize();
      const boardWidth = CAMERA_WORLD_WIDTH * boardZoom;
      const boardHeight = CAMERA_WORLD_HEIGHT * boardZoom;

      boardVisualWidth = cameraIsRotated() ? boardHeight : boardWidth;
      boardVisualHeight = cameraIsRotated() ? boardWidth : boardHeight;

      cameraMarginX = Math.max(150, viewport.width * 0.58);
      cameraMarginY = Math.max(150, viewport.height * 0.58);

      boardOffsetX = cameraMarginX;
      boardOffsetY = cameraMarginY;

      const stageWidth = boardVisualWidth + cameraMarginX * 2;
      const stageHeight = boardVisualHeight + cameraMarginY * 2;

      battlefieldSurface.style.setProperty("--camera-width", `${stageWidth}px`);
      battlefieldSurface.style.setProperty("--camera-height", `${stageHeight}px`);
      battlefieldSurface.style.setProperty("--board-left", `${boardOffsetX}px`);
      battlefieldSurface.style.setProperty("--board-top", `${boardOffsetY}px`);
      battlefieldSurface.style.setProperty("--board-width", `${boardWidth}px`);
      battlefieldSurface.style.setProperty("--board-height", `${boardHeight}px`);
      battlefieldSurface.style.setProperty(
        "--board-transform",
        cameraIsRotated()
          ? `translateX(${boardHeight}px) rotate(90deg)`
          : "none"
      );

      battlefieldSurface.style.width = `${stageWidth}px`;
      battlefieldSurface.style.height = `${stageHeight}px`;
      battlefieldSurface.style.minWidth = `${stageWidth}px`;
      battlefieldSurface.style.minHeight = `${stageHeight}px`;
      battlefieldSurface.style.flex = "0 0 auto";

      fittedBoardZoom = calculateFitZoom();
      const relativeZoom =
        fittedBoardZoom > 0
          ? boardZoom / fittedBoardZoom
          : 1;
      const isFit = Math.abs(relativeZoom - 1) < 0.015;
      zoomReadout.textContent =
        isFit ? "FIT" : `${Math.round(relativeZoom * 100)}%`;
      document.body.classList.toggle("fit-table-active", isFit);
      updateCameraDetailLevel();
    }

    function cameraPointFromClient(clientX, clientY) {
      const rect = battlefieldViewport.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function setBoardZoom(nextZoom, options = {}) {
      if (!battlefieldViewport || !battlefieldSurface) return;

      const viewportPoint = options.viewportPoint ?? {
        x: battlefieldViewport.clientWidth / 2,
        y: battlefieldViewport.clientHeight / 2
      };

      const oldWidth = Math.max(1, battlefieldSurface.offsetWidth);
      const oldHeight = Math.max(1, battlefieldSurface.offsetHeight);
      const focusX =
        (battlefieldViewport.scrollLeft + viewportPoint.x) / oldWidth;
      const focusY =
        (battlefieldViewport.scrollTop + viewportPoint.y) / oldHeight;

      fittedBoardZoom = calculateFitZoom();
      const minZoom = Math.max(CAMERA_MIN_SCALE, fittedBoardZoom * 0.45);
      const maxZoom = Math.min(CAMERA_MAX_SCALE, fittedBoardZoom * 8);
      boardZoom = clamp(nextZoom, minZoom, maxZoom);
      applyCameraSurfaceSize();

      requestAnimationFrame(() => {
        battlefieldViewport.scrollLeft =
          focusX * battlefieldSurface.offsetWidth - viewportPoint.x;
        battlefieldViewport.scrollTop =
          focusY * battlefieldSurface.offsetHeight - viewportPoint.y;
      });

      renderUnits();
      renderRangeRing();
      renderWaypoint();
    }

    function centerTable(options = {}) {
      const boardCenterX = boardOffsetX + boardVisualWidth / 2;
      const boardCenterY = boardOffsetY + boardVisualHeight / 2;
      battlefieldViewport.scrollTo({
        left: boardCenterX - battlefieldViewport.clientWidth / 2,
        top: boardCenterY - battlefieldViewport.clientHeight / 2,
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

        requestAnimationFrame(() => {
          centerTable({ instant: true });
        });

        renderUnits();
        renderRangeRing();
        renderWaypoint();
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
      cameraRotationOverridden = true;
      cameraRotationQuarterTurns =
        cameraRotationQuarterTurns === 0 ? 1 : 0;
      applyCameraSurfaceSize();
      requestAnimationFrame(() => centerTable({ instant: true }));
      renderUnits();
      renderRangeRing();
      renderWaypoint();
    }

    function cameraCanPan() {
      return true;
    }

    function tablePointToSurfacePixels(point) {
      const local = tablePointToPixels(point);
      const boardHeight = CAMERA_WORLD_HEIGHT * boardZoom;

      if (cameraIsRotated()) {
        return {
          x: boardOffsetX + boardHeight - local.y,
          y: boardOffsetY + local.x
        };
      }

      return {
        x: boardOffsetX + local.x,
        y: boardOffsetY + local.y
      };
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
      else if (pixel.x > right - margin) {
        nextLeft = pixel.x - battlefieldViewport.clientWidth + margin;
      }

      if (pixel.y < top + margin) nextTop = pixel.y - margin;
      else if (pixel.y > bottom - margin) {
        nextTop = pixel.y - battlefieldViewport.clientHeight + margin;
      }

      battlefieldViewport.scrollTo({
        left: Math.max(0, nextLeft),
        top: Math.max(0, nextTop),
        behavior: options.instant ? "auto" : "smooth"
      });
    }

    function applyLargeControlsState(enabled, rerender = true) {
      document.body.classList.toggle("large-controls", enabled);
      largeControlsButton.setAttribute("aria-pressed", String(enabled));
      largeControlsButton.textContent = enabled ? "Std" : "Large";
      if (rerender) renderUnits();
    }

    function toggleLargeControls() {
      const enabled = !document.body.classList.contains("large-controls");
      applyLargeControlsState(enabled, true);
      try {
        localStorage.setItem("infantryCoreLargeControls", enabled ? "1" : "0");
      } catch (_) {}
    }

    try {
      applyLargeControlsState(
        localStorage.getItem("infantryCoreLargeControls") === "1",
        false
      );
    } catch (_) {
      applyLargeControlsState(false, false);
    }

    zoomOutButton.addEventListener("click", event => {
      event.preventDefault();
      zoomCameraByFactor(1 / 1.16);
    });

    zoomInButton.addEventListener("click", event => {
      event.preventDefault();
      zoomCameraByFactor(1.16);
    });

    fitTableButton.addEventListener("click", event => {
      event.preventDefault();
      fitTable();
    });

    rotateBoardButton.addEventListener("click", event => {
      event.preventDefault();
      rotateBoard();
    });

    largeControlsButton.addEventListener("click", event => {
      event.preventDefault();
      toggleLargeControls();
    });

    window.MobileView = {
      zoomIn: () => zoomCameraByFactor(1.16),
      zoomOut: () => zoomCameraByFactor(1 / 1.16),
      fit: fitTable,
      rotate: rotateBoard,
      center: centerTable
    };

    // Desktop wheel zoom, centered on the cursor.
    battlefieldViewport.addEventListener(
      "wheel",
      event => {
        if (event.ctrlKey) return;
        event.preventDefault();

        const viewportPoint = cameraPointFromClient(
          event.clientX,
          event.clientY
        );

        const factor = Math.exp(-event.deltaY * 0.0014);
        setBoardZoom(boardZoom * factor, { viewportPoint });
      },
      { passive: false }
    );

    // Desktop click-drag panning. A small movement threshold prevents normal
    // unit clicks from being swallowed.
    let desktopPan = null;

    battlefieldViewport.addEventListener("mousedown", event => {
      if (event.button !== 0) return;

      desktopPan = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: battlefieldViewport.scrollLeft,
        scrollTop: battlefieldViewport.scrollTop,
        moved: false
      };
    });

    window.addEventListener("mousemove", event => {
      if (!desktopPan) return;

      const dx = event.clientX - desktopPan.startX;
      const dy = event.clientY - desktopPan.startY;

      if (!desktopPan.moved && Math.hypot(dx, dy) > 5) {
        desktopPan.moved = true;
        battlefieldViewport.classList.add("camera-dragging");
      }

      if (desktopPan.moved) {
        battlefieldViewport.scrollLeft =
          desktopPan.scrollLeft - dx;
        battlefieldViewport.scrollTop =
          desktopPan.scrollTop - dy;
        event.preventDefault();
      }
    });

    window.addEventListener("mouseup", () => {
      if (!desktopPan) return;

      if (desktopPan.moved) {
        gestureSuppressUntil = Date.now() + 220;
      }

      desktopPan = null;
      battlefieldViewport.classList.remove("camera-dragging");
    });

    const mobileDiagnostic = document.getElementById("mobileDiagnostic");
    const deploymentUnitTray = document.getElementById("deploymentUnitTray");
    const deploymentUnitTrayButtons = document.getElementById("deploymentUnitTrayButtons");

    function startupDiagnosticSnapshot() {
      const renderedUnitCount =
        document.getElementById("battlefield")?.querySelectorAll(".unit").length ?? 0;
      const externalDataCount = [
        window.CROSSROADS_WEAPON_PROFILES,
        window.CROSSROADS_TERRAIN,
        window.CROSSROADS_UNIT_TYPES,
        window.CROSSROADS_UNIT_QUALITY,
        window.CROSSROADS_SCENARIOS
      ].filter(Boolean).length;
      const scenarioId = activeScenario?.id ?? scenarioSelect?.value ?? "none";
      const deploymentState =
        phase === "deployment"
          ? "deploy"
          : phase === "ready-to-draw"
            ? "ready"
            : phase;

      return Object.freeze({
        build: BUILD_INFO.version,
        externalData: `${externalDataCount}/5`,
        scenario: scenarioId,
        runtimeUnits: units.length,
        renderedUnits: renderedUnitCount,
        deployment: deploymentState,
        domMissing: missingDOMReferences(),
        commandModel: Boolean(window.CrossroadsCommands?.makeCommand),
        sharedOrderCommands:
          typeof orderCommand === "function" &&
          typeof availableOrderCommands === "function",
        renderCoordinator:
          typeof renderGame === "function" &&
          typeof renderUnitLayer === "function",
        buildingSystem:
          typeof buildingCommand === "function" &&
          typeof renderBuildingState === "function",
        buildingCombat:
          typeof buildingCombatContext === "function" &&
          typeof reconcileBuildingAfterUnitChange === "function",
        buildingOccupant: buildingOccupant()?.id ?? "none",
        buildingCardVisible: Boolean(buildingOccupant()) === !buildingOccupancyBadge.hidden,
        qualitySystem:
          Boolean(window.CROSSROADS_UNIT_QUALITY) &&
          units.every(unit => Boolean(UNIT_QUALITY[unit.quality])),
        qualities: [...new Set(units.map(unit => unit.quality))].sort().join("/"),
        mmgSystem:
          typeof deployMMG === "function" &&
          typeof targetInsideMMGArc === "function",
        mmgStates: units
          .filter(isMMGTeam)
          .map(unit => `${unit.id}:${unit.mmgDeployed ? "D" : "P"}/${unit.soldiers}`)
          .join(","),
        readabilityPass:
          typeof unitIsEligibleForCurrentDie === "function" &&
          typeof packedMMGFormationHtml === "function" &&
          typeof deployedMMGFormationHtml === "function",
        visualStability:
          Boolean(buildingOccupancyTab) &&
          typeof qualityStripeHtml === "function",
        simpleUnitUI:
          typeof farCounterHtml === "function" &&
          typeof compactPinHtml === "function",
        zoom: zoomReadout?.textContent ?? "—"
      });
    }

    function updateMobileDiagnostic() {
      if (!mobileDiagnostic) return;
      const diagnostic = startupDiagnosticSnapshot();
      window.CROSSROADS_STARTUP_DIAGNOSTIC = diagnostic;
      mobileDiagnostic.textContent =
        `${diagnostic.build} · data ${diagnostic.externalData} · ` +
        `${diagnostic.scenario} · ${diagnostic.runtimeUnits}/${diagnostic.renderedUnits} units · ` +
        `DOM ${diagnostic.domMissing.length ? "MISS" : "OK"} · ` +
        `CMD ${diagnostic.commandModel ? "OK" : "MISS"}` +
        `${diagnostic.sharedOrderCommands ? "/SHARED" : ""} · ` +
        `RENDER ${diagnostic.renderCoordinator ? "OK" : "MISS"} · ` +
        `BLDG ${diagnostic.buildingSystem ? "OK" : "MISS"}` +
        `${diagnostic.buildingCombat ? "/COMBAT" : ""}:${diagnostic.buildingOccupant}` +
        `${diagnostic.buildingCardVisible ? "/CARD" : "/MISMATCH"} · ` +
        `QUAL ${diagnostic.qualitySystem ? "OK" : "MISS"}:${diagnostic.qualities} · ` +
        `MMG ${diagnostic.mmgSystem ? "OK" : "MISS"}:${diagnostic.mmgStates} · ` +
        `READ ${diagnostic.readabilityPass ? "OK" : "MISS"}` +
        `${diagnostic.visualStability ? "/STABLE" : ""}` +
        `${diagnostic.simpleUnitUI ? "/SIMPLE" : ""} · ` +
        `${diagnostic.deployment} · ${diagnostic.zoom}`;
      mobileDiagnostic.title = JSON.stringify(diagnostic);
    }

    function renderDeploymentUnitTray() {
      if (!deploymentUnitTray || !deploymentUnitTrayButtons) return;
      deploymentUnitTray.hidden = true;
      deploymentUnitTrayButtons.innerHTML = "";
    }


    // =========================================================================
    // BATTLE ENGINE DOM REFERENCES
    // Cached battlefield, control, report, and overlay elements.
    // =========================================================================

    const DOM = Object.freeze({
      battlefield: document.getElementById("battlefield"),
      rangeRing: document.getElementById("rangeRing"),
      traceLine: document.getElementById("traceLine"),
      traceLabel: document.getElementById("traceLabel"),
      routeLayer: document.getElementById("routeLayer"),
      waypointMarker: document.getElementById("waypointMarker"),
      cursorReadout: document.getElementById("cursorReadout"),
      drawnDie: document.getElementById("drawnDie"),
      targetReadout: document.getElementById("targetReadout"),
      orderDiePop: document.getElementById("orderDiePop"),
      orderDiePopFace: document.getElementById("orderDiePopFace"),
      orderDiePopText: document.getElementById("orderDiePopText"),
      startBattleButton: document.getElementById("startBattleButton"),
      drawButton: document.getElementById("drawButton"),
      nextRoundButton: document.getElementById("nextRoundButton"),
      restartButton: document.getElementById("restartButton"),
      cancelButton: document.getElementById("cancelButton"),
      finishAdvanceButton: document.getElementById("finishAdvanceButton"),
      clearWaypointButton: document.getElementById("clearWaypointButton"),
      orderButtons: [...document.querySelectorAll(".orderButton")],
      ambushOrderButton: document.getElementById("ambushOrderButton"),
      assaultOrderButton: document.getElementById("assaultOrderButton"),
      statusPanel: document.getElementById("statusPanel"),
      previewCard: document.getElementById("previewCard"),
      reactionPanel: document.getElementById("reactionPanel"),
      reactionHeading: document.getElementById("reactionHeading"),
      reactionText: document.getElementById("reactionText"),
      reactionPrimaryButton: document.getElementById("reactionPrimaryButton"),
      reactionSecondaryButton: document.getElementById("reactionSecondaryButton"),
      log: document.getElementById("log"),
      blueScore: document.getElementById("blueScore"),
      redScore: document.getElementById("redScore"),
      roundReadout: document.getElementById("roundReadout"),
      objectiveOwner: document.getElementById("objectiveOwner"),
      blueObjectiveDistance: document.getElementById("blueObjectiveDistance"),
      redObjectiveDistance: document.getElementById("redObjectiveDistance"),
      objectiveLabel: document.getElementById("objectiveLabel"),
      farmhouseTerrain: document.getElementById("farmhouseTerrain"),
      buildingOccupancyBadge: document.getElementById("buildingOccupancyBadge"),
      buildingOccupancyTab: document.getElementById("buildingOccupancyTab"),
      buildingApproachMarker: document.getElementById("buildingApproachMarker"),
      buildingActionButton: document.getElementById("buildingActionButton"),
      objectiveRing: document.getElementById("objectiveRing"),
      objectiveMarker: document.getElementById("objectiveMarker"),
      exitZoneElement: document.getElementById("exitZone"),
      briefingModal: document.getElementById("briefingModal"),
      briefingTitle: document.getElementById("briefingTitle"),
      briefingDescription: document.getElementById("briefingDescription"),
      briefingMeta: document.getElementById("briefingMeta"),
      briefingIntelLine: document.getElementById("briefingIntelLine"),
      briefingMissionStrip: document.getElementById("briefingMissionStrip"),
      briefingBlueForce: document.getElementById("briefingBlueForce"),
      briefingRedForce: document.getElementById("briefingRedForce"),
      briefingObjectives: document.getElementById("briefingObjectives"),
      briefingRules: document.getElementById("briefingRules"),
      briefingBeginButton: document.getElementById("briefingBeginButton"),
      briefingCloseButton: document.getElementById("briefingCloseButton"),
      afterActionModal: document.getElementById("afterActionModal"),
      aarTitle: document.getElementById("aarTitle"),
      aarResultBanner: document.getElementById("aarResultBanner"),
      aarScoreline: document.getElementById("aarScoreline"),
      aarStats: document.getElementById("aarStats"),
      aarUnitTable: document.getElementById("aarUnitTable"),
      aarBattleLog: document.getElementById("aarBattleLog"),
      copyStatus: document.getElementById("copyStatus"),
      showBriefingButton: document.getElementById("showBriefingButton"),
      showReportButton: document.getElementById("showReportButton"),
      copyLogButton: document.getElementById("copyLogButton"),
      aarCloseButton: document.getElementById("aarCloseButton"),
      aarRestartButton: document.getElementById("aarRestartButton"),
      featureList: document.getElementById("featureList"),
      stageRules: document.getElementById("stageRules"),
      scaleNote: document.getElementById("scaleNote")
    });

    const DOM_REQUIRED_KEYS = Object.freeze([
      "battlefield",
      "rangeRing",
      "traceLine",
      "traceLabel",
      "routeLayer",
      "waypointMarker",
      "cursorReadout",
      "drawnDie",
      "targetReadout",
      "orderDiePop",
      "orderDiePopFace",
      "orderDiePopText",
      "startBattleButton",
      "drawButton",
      "nextRoundButton",
      "restartButton",
      "cancelButton",
      "finishAdvanceButton",
      "clearWaypointButton",
      "orderButtons",
      "ambushOrderButton",
      "assaultOrderButton",
      "statusPanel",
      "previewCard",
      "reactionPanel",
      "reactionHeading",
      "reactionText",
      "reactionPrimaryButton",
      "reactionSecondaryButton",
      "log",
      "blueScore",
      "redScore",
      "roundReadout",
      "objectiveOwner",
      "blueObjectiveDistance",
      "redObjectiveDistance",
      "objectiveLabel",
      "farmhouseTerrain",
      "buildingOccupancyBadge",
      "buildingOccupancyTab",
      "buildingApproachMarker",
      "buildingActionButton",
      "objectiveRing",
      "objectiveMarker",
      "exitZoneElement",
      "briefingModal",
      "briefingTitle",
      "briefingDescription",
      "briefingMeta",
      "briefingIntelLine",
      "briefingMissionStrip",
      "briefingBlueForce",
      "briefingRedForce",
      "briefingObjectives",
      "briefingRules",
      "briefingBeginButton",
      "briefingCloseButton",
      "afterActionModal",
      "aarTitle",
      "aarResultBanner",
      "aarScoreline",
      "aarStats",
      "aarUnitTable",
      "aarBattleLog",
      "copyStatus",
      "showBriefingButton",
      "showReportButton",
      "copyLogButton",
      "aarCloseButton",
      "aarRestartButton",
      "featureList",
      "stageRules",
      "scaleNote"
    ]);

    function missingDOMReferences() {
      return DOM_REQUIRED_KEYS.filter(key => !DOM[key]);
    }

    // Compatibility aliases keep all existing engine code unchanged.
    const battlefield = DOM.battlefield;
    const rangeRing = DOM.rangeRing;
    const traceLine = DOM.traceLine;
    const traceLabel = DOM.traceLabel;
    const routeLayer = DOM.routeLayer;
    const waypointMarker = DOM.waypointMarker;
    const cursorReadout = DOM.cursorReadout;
    const drawnDie = DOM.drawnDie;
    const targetReadout = DOM.targetReadout;
    const orderDiePop = DOM.orderDiePop;
    const orderDiePopFace = DOM.orderDiePopFace;
    const orderDiePopText = DOM.orderDiePopText;
    const startBattleButton = DOM.startBattleButton;
    const drawButton = DOM.drawButton;
    const nextRoundButton = DOM.nextRoundButton;
    const restartButton = DOM.restartButton;
    const cancelButton = DOM.cancelButton;
    const finishAdvanceButton = DOM.finishAdvanceButton;
    const clearWaypointButton = DOM.clearWaypointButton;
    const orderButtons = DOM.orderButtons;
    const ambushOrderButton = DOM.ambushOrderButton;
    const assaultOrderButton = DOM.assaultOrderButton;
    const statusPanel = DOM.statusPanel;
    const previewCard = DOM.previewCard;
    const reactionPanel = DOM.reactionPanel;
    const reactionHeading = DOM.reactionHeading;
    const reactionText = DOM.reactionText;
    const reactionPrimaryButton = DOM.reactionPrimaryButton;
    const reactionSecondaryButton = DOM.reactionSecondaryButton;
    const log = DOM.log;
    const blueScore = DOM.blueScore;
    const redScore = DOM.redScore;
    const roundReadout = DOM.roundReadout;
    const objectiveOwner = DOM.objectiveOwner;
    const blueObjectiveDistance = DOM.blueObjectiveDistance;
    const redObjectiveDistance = DOM.redObjectiveDistance;
    const objectiveLabel = DOM.objectiveLabel;
    const farmhouseTerrain = DOM.farmhouseTerrain;
    const buildingOccupancyBadge = DOM.buildingOccupancyBadge;
    const buildingOccupancyTab = DOM.buildingOccupancyTab;
    const buildingApproachMarker = DOM.buildingApproachMarker;
    const buildingActionButton = DOM.buildingActionButton;
    const objectiveRing = DOM.objectiveRing;
    const objectiveMarker = DOM.objectiveMarker;
    const exitZoneElement = DOM.exitZoneElement;
    const briefingModal = DOM.briefingModal;
    const briefingTitle = DOM.briefingTitle;
    const briefingDescription = DOM.briefingDescription;
    const briefingMeta = DOM.briefingMeta;
    const briefingIntelLine = DOM.briefingIntelLine;
    const briefingMissionStrip = DOM.briefingMissionStrip;
    const briefingBlueForce = DOM.briefingBlueForce;
    const briefingRedForce = DOM.briefingRedForce;
    const briefingObjectives = DOM.briefingObjectives;
    const briefingRules = DOM.briefingRules;
    const briefingBeginButton = DOM.briefingBeginButton;
    const briefingCloseButton = DOM.briefingCloseButton;
    const afterActionModal = DOM.afterActionModal;
    const aarTitle = DOM.aarTitle;
    const aarResultBanner = DOM.aarResultBanner;
    const aarScoreline = DOM.aarScoreline;
    const aarStats = DOM.aarStats;
    const aarUnitTable = DOM.aarUnitTable;
    const aarBattleLog = DOM.aarBattleLog;
    const copyStatus = DOM.copyStatus;
    const showBriefingButton = DOM.showBriefingButton;
    const showReportButton = DOM.showReportButton;
    const copyLogButton = DOM.copyLogButton;
    const aarCloseButton = DOM.aarCloseButton;
    const aarRestartButton = DOM.aarRestartButton;
    const featureList = DOM.featureList;
    const stageRules = DOM.stageRules;
    const scaleNote = DOM.scaleNote;

    // Existing non-element declarations retained from the original section.
// =========================================================================
    // FEATURE AND RULES REFERENCE UI
    // Populates the current feature list, rule summary, and scale guidance.

    // =========================================================================
    function configureStageUI() {
      ambushOrderButton.hidden = !FEATURES.ambush;
      assaultOrderButton.hidden = !FEATURES.assault;

      const features = [
        ["Ambush interruption", FEATURES.ambush],
        ["Close assault", FEATURES.assault],
        ["Movement integrity + deployment", FEATURES.movementIntegrity],
        ["Unit types + mixed loadouts", true]
      ];

      featureList.innerHTML = features.map(([name, enabled]) =>
        `<div class="feature-chip ${enabled ? "on" : "off"}">${enabled ? "✓" : "—"} ${name}</div>`
      ).join("");

      const ruleLines = [
        `Table <code>72″ × 48″</code>; Run <code>12″</code>; Advance <code>6″</code>; Rifle <code>24″</code>; SMG <code>12″</code>; LMG/MMG <code>36″</code>.`,
        `Objective control within <code>3″</code>; score at the end of each of six rounds.`,
        FEATURES.ambush
          ? `Ambush interrupts at the first sampled point with legal range and line of sight; unused Ambush expires at round end in this prototype.`
          : `Ambush is intentionally disabled in this isolated stage.`,
        FEATURES.assault
          ? `Assaults use a 12″ direct charge, reaction fire beyond 6″, and defender-first combat across rough ground or obstacles.`
          : `Close Assault is intentionally disabled in this isolated stage.`,
        FEATURES.movementIntegrity
          ? `Choose deployment before Round 1. Units cannot overlap or pass through units. Woods double movement spent inside them; wall crossings cost +2″. Overlong legal paths stop at the furthest affordable point. Shift-click adds one waypoint.`
          : `Movement uses the earlier direct-path prototype rules so the stage isolates its featured system.`,
        `Officer teams project a <code>6″</code> command radius and add <code>+1 Morale</code> to nearby friendly Order Tests. Rifle squads carry rifles plus an LMG; assault squads mix rifles and SMGs; MMG teams cannot fire after an Advance.`
      ];

      stageRules.innerHTML = ruleLines.join("<br><br>");

      scaleNote.textContent = FEATURES.movementIntegrity
        ? "Movement integrity is active: Shift-click once to place a waypoint, then click the final destination. If a chosen point is too deep into rough ground, the unit stops at the furthest affordable legal point."
        : "This stage keeps direct movement so its featured combat system can be tested without the additional movement-planning layer.";
    }

    // =========================================================================
    // CORE UNIT, DICE, MEASUREMENT, AND LOADOUT HELPERS
    // Shared queries and calculations used throughout the rules engine.
    // =========================================================================
    function livingUnits() {
      return units.filter(unitIsActive);
    }

    function resolvedUnits() {
      return units.filter(unit => unit.outcome !== UNIT_OUTCOME.ACTIVE);
    }
    function getUnit(unitId) { return units.find(unit => unit.id === unitId) ?? null; }

    function fillBag() {
      bag = livingUnits().map(unit => unit.faction);
      shuffle(bag);
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    function pixelsPerInch() {
      return Math.max(1, battlefield.offsetWidth) / RULES.tableWidth;
    }

    function inchesToPixels(inches) {
      return inches * pixelsPerInch();
    }

    function tablePointToPixels(point) {
      const ppi = pixelsPerInch();
      return { x: point.x * ppi, y: point.y * ppi };
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
        x: clamp(localX / ppi, 0, RULES.tableWidth),
        y: clamp(localY / ppi, 0, RULES.tableHeight)
      };
    }

    function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
    function distanceBetweenUnits(a, b) { return distanceBetweenPoints(a, b); }
    function distanceToObjective(unit) { return distanceBetweenPoints(unit, RULES.objective); }

    function unitIsOnObjective(unit) {
      return unit.soldiers > 0 && distanceToObjective(unit) <= RULES.objective.radius + 0.001;
    }

    function weaponRange(unit, moving = false) {
      const groups = availableFireGroups(unit, Infinity, moving, false);
      return groups.length ? Math.max(...groups.map(group => group.profile.range)) : 0;
    }

    const MMG_RULES = Object.freeze({
      arcDegrees: 90,
      facingStep: 45,
      fullCrew: 3,
      reducedCrew: 2
    });

    function isMMGTeam(unit) {
      return Boolean(unit?.weapons?.mmg);
    }

    function normalizeDegrees(value) {
      let angle = value % 360;
      if (angle < 0) angle += 360;
      return angle;
    }

    function facingToward(from, to) {
      return normalizeDegrees(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI);
    }

    function smallestAngleDifference(a, b) {
      const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
      return Math.min(diff, 360 - diff);
    }

    function targetInsideMMGArc(unit, target) {
      if (!isMMGTeam(unit) || !unit.mmgDeployed) return true;
      return smallestAngleDifference(unit.mmgFacing, facingToward(unit, target)) <= MMG_RULES.arcDegrees / 2 + 0.001;
    }

    function deployMMG(unit) {
      unit.mmgDeployed = true;
      const nearestEnemy = livingUnits()
        .filter(other => other.faction !== unit.faction)
        .sort((a, b) => distanceBetweenUnits(unit, a) - distanceBetweenUnits(unit, b))[0];
      if (nearestEnemy) unit.mmgFacing = facingToward(unit, nearestEnemy);
      addLog(`${capitalize(unit.faction)} ${unit.name} deploys its MMG facing ${Math.round(unit.mmgFacing)}°.`, "terrain");
      showBattleAnnouncement("MMG DEPLOYED", `${unit.name} establishes a firing position`, unit.faction, 1000);
    }

    function undeployMMG(unit, reason = "movement") {
      if (!isMMGTeam(unit) || !unit.mmgDeployed) return;
      unit.mmgDeployed = false;
      addLog(`${capitalize(unit.faction)} ${unit.name} packs up its MMG for ${reason}.`, "terrain");
    }

    function rotateMMGFacing(unit, delta) {
      if (!isMMGTeam(unit) || !unit.mmgDeployed || phase !== "choose-order") return;
      unit.mmgFacing = normalizeDegrees(unit.mmgFacing + delta);
      setStatus(
        `${unit.name} facing ${Math.round(unit.mmgFacing)}°.`,
        `MMG field of fire is ${MMG_RULES.arcDegrees}°. Rotation does not consume the activation.`
      );
      renderUnits();
    }

    function availableFireGroups(unit, distance, moving = false, enforceRange = true) {
      const groups = [];

      for (const [key, rawCount] of Object.entries(unit.weapons ?? {})) {
        const profile = WEAPON_PROFILES[key];
        if (!profile || rawCount <= 0) continue;
        if (moving && profile.fixed) continue;
        if (enforceRange && distance > profile.range + 0.001) continue;

        let shots = rawCount * profile.shots;
        let models = rawCount;

        if (profile.crewWeapon) {
          models = 1;
          if (profile.fixed && !unit.mmgDeployed) shots = 0;
          else if (unit.soldiers >= MMG_RULES.fullCrew) shots = profile.shots;
          else if (unit.soldiers >= MMG_RULES.reducedCrew) shots = profile.reducedShots;
          else shots = 0;
        }

        if (shots <= 0) continue;
        groups.push({ key, profile, models, shots });
      }

      return groups;
    }

    function shortLoadout(unit) {
      const parts = [];
      for (const [key, count] of Object.entries(unit.weapons ?? {})) {
        if (count <= 0) continue;
        const profile = WEAPON_PROFILES[key];
        if (!profile) continue;
        parts.push(profile.crewWeapon ? profile.short : `${count}${profile.short}`);
      }
      return parts.join("+") || "Unarmed";
    }

    function fullLoadout(unit) {
      const parts = [];
      for (const [key, count] of Object.entries(unit.weapons ?? {})) {
        if (count <= 0) continue;
        const profile = WEAPON_PROFILES[key];
        if (!profile) continue;
        if (profile.crewWeapon) {
          const state = unit.mmgDeployed ? "deployed" : "packed";
          const shots =
            unit.soldiers >= MMG_RULES.fullCrew
              ? profile.shots
              : unit.soldiers >= MMG_RULES.reducedCrew
                ? profile.reducedShots
                : 0;
          parts.push(`${profile.label} (${unit.soldiers} crew · ${state} · ${shots} shots)`);
        }
        else parts.push(`${count} ${profile.label}${count === 1 ? "" : "s"}`);
      }
      return parts.join(" · ") || "Unarmed";
    }

    function commandSupport(unit) {
      if (unit.role === "officer") return null;
      return livingUnits().find(other =>
        other.faction === unit.faction &&
        other.role === "officer" &&
        other.id !== unit.id &&
        distanceBetweenUnits(unit, other) <= RULES.commandRadius + 0.001
      ) ?? null;
    }

    function commandBonus(unit) {
      return commandSupport(unit) ? RULES.commandMoraleBonus : 0;
    }

    function applyCasualties(unit, requested) {
      const casualties = Math.min(requested, unit.soldiers);
      for (let i = 0; i < casualties; i++) {
        unit.soldiers -= 1;
        for (const key of unit.casualtyOrder ?? []) {
          if ((unit.weapons?.[key] ?? 0) > 0) {
            unit.weapons[key] -= 1;
            break;
          }
        }
      }

      if (isMMGTeam(unit) && unit.soldiers < MMG_RULES.reducedCrew) {
        undeployMMG(unit, "crew losses");
      }

      if (unit.soldiers <= 0 && unit.outcome === UNIT_OUTCOME.ACTIVE) {
        setUnitOutcome(unit, UNIT_OUTCOME.DESTROYED, {
          reason: "casualties"
        });
      }

      reconcileBuildingAfterUnitChange(unit);
      return casualties;
    }

    function destroyUnit(unit, reason = "destroyed") {
      unit.soldiers = 0;
      for (const key of Object.keys(unit.weapons ?? {})) unit.weapons[key] = 0;
      setUnitOutcome(unit, UNIT_OUTCOME.DESTROYED, { reason });
    }

    function unitIsEligibleForCurrentDie(unit) {
      return Boolean(
        phase === "choose-unit" &&
        currentFaction &&
        unit &&
        unit.faction === currentFaction &&
        unit.outcome === UNIT_OUTCOME.ACTIVE &&
        !unit.activated
      );
    }

    function factionHasEligibleUnit(faction) {
      return livingUnits().some(unit => unit.faction === faction && !unit.activated);
    }

    function createRulerLabels() {
      battlefield.querySelectorAll(".ruler-label").forEach(el => el.remove());

      for (let x = 0; x <= RULES.tableWidth; x += 12) {
        const label = document.createElement("span");
        label.className = "ruler-label top";
        label.style.left = `${(x / RULES.tableWidth) * 100}%`;
        label.textContent = `${x}″`;
        battlefield.appendChild(label);
      }

      for (let y = 12; y <= RULES.tableHeight; y += 12) {
        const label = document.createElement("span");
        label.className = "ruler-label left";
        label.style.top = `${(y / RULES.tableHeight) * 100}%`;
        label.textContent = `${y}″`;
        battlefield.appendChild(label);
      }
    }


    registerScenarioObjective("control_zone", {
      state(objective) {
        const blue = livingUnits().some(
          unit => unit.faction === "blue" &&
            distanceBetweenPoints(unit, objective) <= objective.radius + 0.001
        );
        const red = livingUnits().some(
          unit => unit.faction === "red" &&
            distanceBetweenPoints(unit, objective) <= objective.radius + 0.001
        );

        if (blue && red) return "contested";
        if (blue) return "blue";
        if (red) return "red";
        return "none";
      }
    });

    // =========================================================================
    // BREAKTHROUGH OBJECTIVE SYSTEM
    // Owns exit-zone eligibility, exit outcomes, progress, and containment.
    // =========================================================================
    function scenarioIsBreakthrough() {
      return activeScenario.id === "breakthrough";
    }

    function exitObjective() {
      return (activeScenario.objectives ?? []).find(
        objective => objective.type === "exit_unit"
      ) ?? null;
    }

    function unitInsideExitZone(unit, objective = exitObjective()) {
      if (!unit || !objective) return false;
      const depth = objective.depth ?? 3;
      if (objective.edge === "blue") return unit.x <= depth + 0.001;
      if (objective.edge === "red") return unit.x >= RULES.tableWidth - depth - 0.001;
      if (objective.edge === "top") return unit.y <= depth + 0.001;
      if (objective.edge === "bottom") return unit.y >= RULES.tableHeight - depth - 0.001;
      return false;
    }

    function breakthroughProgress() {
      const attackers = units.filter(unit => unit.faction === "red");
      const exited = attackers.filter(unit => unit.outcome === UNIT_OUTCOME.EXITED);
      return {
        total: attackers.length,
        exited: exited.length,
        contained: attackers.length - exited.length,
        exitedSoldiers: exited.reduce((sum, unit) => sum + unit.soldiers, 0)
      };
    }

    function exitUnit(unit) {
      const objective = exitObjective();
      if (
        !scenarioIsBreakthrough() ||
        !objective ||
        !unitIsActive(unit) ||
        unit.faction !== objective.faction ||
        !unitInsideExitZone(unit, objective)
      ) return false;

      const points = objective.pointsPerUnit ?? 2;
      setUnitOutcome(unit, UNIT_OUTCOME.EXITED, { reason: objective.id });
      unit.exitRound = round;
      unit.exitZoneId = objective.id;
      unit.exitPoints = points;
      unit.order = "Exited";
      unit.activated = true;
      scores.red += points;

      if (battleStats) {
        battleStats.red.unitsExited += 1;
        battleStats.red.soldiersExited += unit.soldiers;
        battleStats.red.breakthroughPoints += points;
      }

      addLog(`${activeScenario.factions.red.name} ${unit.name} exits through ${objective.label}. Red gains ${points} points.`, "objective");
      showBattleAnnouncement(`${unit.name.toUpperCase()} EXITED`, `RED +${points} · Unit survives`, "red", 1200);
      return true;
    }

    function finalizeContainmentScore() {
      const progress = breakthroughProgress();
      scores.blue = progress.contained * (activeScenario.scoring.containmentPointsPerUnit ?? 1);
    }

    function breakthroughResult() {
      const progress = breakthroughProgress();
      if (scores.red > scores.blue) {
        return {
          winner: "red",
          reason: "breakthrough",
          message: progress.exited >= 3
            ? `Decisive Breakthrough: ${progress.exited} Red units escaped.`
            : `Red Breakthrough: ${progress.exited} Red unit${progress.exited === 1 ? "" : "s"} escaped.`
        };
      }
      if (scores.blue > scores.red) {
        return {
          winner: "blue",
          reason: "containment",
          message: progress.exited === 0
            ? "Decisive Containment: Blue prevented every Red exit."
            : `Blue Holds: ${progress.contained} Red units were contained.`
        };
      }
      return {
        winner: null,
        reason: "draw",
        message: `Hard-Fought Draw: scores are tied ${scores.blue}–${scores.red}.`
      };
    }

    // =========================================================================
    // OBJECTIVE QUERIES AND TRANSIENT BATTLEFIELD FEEDBACK
    // Owns objective state, announcements, target readouts, and effect queues.
    // =========================================================================
    function objectiveState() {
      if (scenarioIsBreakthrough()) return "none";
      const objective = scenarioObjective();
      return scenarioObjectiveHandler(
        objective.type ?? "control_zone"
      ).state(objective);
    }

    function nearestObjectiveDistance(faction) {
      const factionUnits = livingUnits().filter(unit => unit.faction === faction);
      if (factionUnits.length === 0) return null;
      return Math.min(...factionUnits.map(distanceToObjective));
    }


    function showOrderDiePop(faction) {
      if (!orderDiePop || !orderDiePopText || !orderDiePopFace) return;
      if (orderDiePopTimer) clearTimeout(orderDiePopTimer);

      orderDiePop.className = `order-die-pop ${faction}`;
      orderDiePopText.textContent = `${capitalize(faction)} DIE`;
      orderDiePopFace.textContent = faction === "blue" ? "◆" : "◇";
      orderDiePop.hidden = false;

      orderDiePopTimer = setTimeout(() => {
        orderDiePop.hidden = true;
      }, 760);
    }

    function physicalStateMarkerHtml(unit) {
      if (unit.ambush) return `<span class="physical-state-marker ambush">A</span>`;
      if (unit.down) return `<span class="physical-state-marker down">↓</span>`;
      if (unit.activated) return `<span class="physical-state-marker activated">✓</span>`;
      return "";
    }

    function showTargetReadout(target, state, heading, lines) {
      if (!targetReadout || !target) return;

      const point = tablePointToPixels(target);
      targetReadout.className = `target-readout ${state}`;
      targetReadout.style.left = `${point.x}px`;
      targetReadout.style.top = `${point.y}px`;
      targetReadout.innerHTML =
        `<strong>${heading}</strong>${lines.map(line => `<div>${line}</div>`).join("")}`;
      targetReadout.hidden = false;
    }

    function clearTargetReadout() {
      if (!targetReadout) return;
      targetReadout.hidden = true;
      targetReadout.textContent = "";
      targetReadout.removeAttribute("style");
    }

    function showBattleAnnouncement(title, subtitle = "", tone = "neutral", duration = 1050) {
      const box = document.getElementById("battleAnnouncement");
      const titleEl = document.getElementById("battleAnnouncementTitle");
      const subtitleEl = document.getElementById("battleAnnouncementSubtitle");
      if (!box || !titleEl || !subtitleEl) return;
      if (announcementTimer) clearTimeout(announcementTimer);
      box.className = `battle-announcement ${tone}`;
      titleEl.textContent = title;
      subtitleEl.textContent = subtitle;
      box.hidden = false;
      announcementTimer = setTimeout(() => { box.hidden = true; }, duration);
    }

    function updateTargetingVisualMode() {
      document.body.classList.toggle(
        "targeting-active",
        phase === "choose-target" || phase === "choose-assault-target"
      );
    }

    // Unit markup and formation builders live in src/presentation/units.js.
    const {
      farCounterHtml,
      soldierRole,
      formationSlots,
      brickSoldierHtml,
      pinScatterHtml,
      roleAscii,
      orderAscii,
      packedMMGFormationHtml,
      deployedMMGFormationHtml,
      qualityStripeHtml,
      compactPinHtml,
      unitFormationHtml
    } = window.CrossroadsUnitPresentation;

    // =========================================================================
    // MINIATURE PRESENTATION BUILDERS
    // Produces counters, formations, soldiers, pins, labels, and state chits.
    // =========================================================================

    function queueUnitEffect(unitId, effectName) {
      if (!unitId || !effectName) return;
      if (!queuedUnitEffects.has(unitId)) queuedUnitEffects.set(unitId, new Set());
      queuedUnitEffects.get(unitId).add(effectName);
    }

    function consumeUnitEffects(unitId) {
      const effects = queuedUnitEffects.get(unitId);
      queuedUnitEffects.delete(unitId);
      return effects ?? new Set();
    }












    // =========================================================================
    // BATTLEFIELD RENDERING
    // Rebuilds exit zones, units, range rings, routes, traces, and waypoints.
    // Gameplay decisions should remain outside this presentation layer.
    // =========================================================================
    function renderExitZone() {
      if (!exitZoneElement) return;
      const objective = exitObjective();

      if (!scenarioIsBreakthrough() || !objective) {
        exitZoneElement.hidden = true;
        document.body.classList.remove("exit-ready");
        return;
      }

      exitZoneElement.hidden = false;
      exitZoneElement.className = `exit-zone edge-${objective.edge}`;
      exitZoneElement.style.setProperty("--exit-depth-px", `${inchesToPixels(objective.depth ?? 3)}px`);

      const selected = getUnit(selectedUnitId);
      document.body.classList.toggle(
        "exit-ready",
        Boolean(selected && selected.faction === objective.faction && phase === "plan-movement")
      );
    }

    function renderUnitLayer() {
      battlefield.querySelectorAll(".unit, .command-ring, .mmg-fire-arc").forEach(el => el.remove());
      const shooter = getUnit(selectedUnitId);

      const selectedMMG = getUnit(selectedUnitId);
      if (selectedMMG && isMMGTeam(selectedMMG) && selectedMMG.mmgDeployed && !selectedMMG.inBuilding) {
        const arc = document.createElement("div");
        arc.className = `mmg-fire-arc ${selectedMMG.faction}`;
        arc.style.left = `${(selectedMMG.x / RULES.tableWidth) * 100}%`;
        arc.style.top = `${(selectedMMG.y / RULES.tableHeight) * 100}%`;
        arc.style.width = `${inchesToPixels(WEAPON_PROFILES.mmg.range * 2)}px`;
        arc.style.height = `${inchesToPixels(WEAPON_PROFILES.mmg.range * 2)}px`;
        arc.style.setProperty("--mmg-facing", `${selectedMMG.mmgFacing}deg`);
        battlefield.appendChild(arc);
      }

      const commandRingsRelevant =
        phase === "choose-unit" ||
        phase === "choose-order" ||
        getUnit(selectedUnitId)?.role === "officer";

      for (const officer of commandRingsRelevant
        ? livingUnits().filter(unit => unit.role === "officer")
        : []) {
        const ring = document.createElement("div");
        ring.className = `command-ring ${officer.faction}`;
        ring.style.left = `${(officer.x / RULES.tableWidth) * 100}%`;
        ring.style.top = `${(officer.y / RULES.tableHeight) * 100}%`;
        ring.style.width = `${inchesToPixels(RULES.commandRadius * 2)}px`;
        ring.style.height = `${inchesToPixels(RULES.commandRadius * 2)}px`;
        battlefield.appendChild(ring);
      }

      for (const unit of livingUnits()) {
        if (unit.inBuilding) continue;
        const el = document.createElement("button");
        el.className = `unit ${unit.faction} ${unit.type} quality-${unit.quality}${unit.inBuilding ? " in-building" : ""}${unitIsEligibleForCurrentDie(unit) ? " eligible-current" : ""}`;
        el.style.left = `${(unit.x / RULES.tableWidth) * 100}%`;
        el.style.top = `${(unit.y / RULES.tableHeight) * 100}%`;
        el.dataset.unitId = unit.id;

        el.setAttribute(
          "aria-label",
          `${unit.name}, ${qualityLabel(unit)}, ${unit.soldiers} soldiers, ${unit.ambush ? "Ambush" : unit.down ? "Down" : unit.order ?? "Ready"}, ${unit.pins} pins`
        );
        el.innerHTML = unitFormationHtml(unit);

        const visualEffects = consumeUnitEffects(unit.id);
        for (const effectName of visualEffects) {
          el.classList.add(`effect-${effectName}`);
        }

        const feedbackPriority = [
          ["casualty", "CASUALTY"],
          ["pin", "+ PIN"],
          ["hit", "HIT"],
          ["fire", "FIRE"],
          ["move", chosenOrder === "Assault" ? "ASSAULT" : "MOVE"]
        ];
        const feedback = feedbackPriority.find(([effect]) => visualEffects.has(effect));
        if (feedback) {
          const card = document.createElement("span");
          card.className = `unit-feedback-card feedback-${feedback[0]}`;
          card.textContent = feedback[1];
          el.appendChild(card);
        }

        if (visualEffects.has("move")) {
          const dust = document.createElement("span");
          dust.className = "effect-dust";
          el.appendChild(dust);
        }

        if (visualEffects.has("hit")) {
          const impact = document.createElement("span");
          impact.className = "effect-impact";
          el.appendChild(impact);
        }

        if (visualEffects.has("casualty")) {
          const mark = document.createElement("span");
          mark.className = "effect-casualty-mark";
          el.appendChild(mark);
        }

        if (visualEffects.has("fire")) {
          const weapon =
            el.querySelector(".brick-soldier.role-lmg .brick-weapon") ||
            el.querySelector(".brick-soldier.role-mmg .brick-weapon") ||
            el.querySelector(".brick-soldier.role-smg .brick-weapon") ||
            el.querySelector(".brick-weapon");

          if (weapon) {
            const flash = document.createElement("span");
            flash.className = "muzzle-flash";
            flash.textContent = "✦";
            weapon.appendChild(flash);
          }
        }

        if (unit.activated) el.classList.add("activated");
        if (unit.ambush) el.classList.add("ambush");
        if (unit.id === selectedUnitId || unit.id === deploymentUnitId) el.classList.add("selected");
        if (unit.id === pendingTouchTargetId) el.classList.add("touch-pending-target");
        if (unitIsOnObjective(unit)) el.classList.add("controls-objective");

        const isEnemyShotTarget = phase === "choose-target" && shooter && unit.faction !== shooter.faction;
        const isEnemyAssaultTarget = phase === "choose-assault-target" && shooter && unit.faction !== shooter.faction;

        if (isEnemyShotTarget) {
          const trace = analyzeShot(shooter, unit);
          const groups = availableFireGroups(shooter, trace.distance, chosenOrder === "Advance", true);
          if (!trace.inRange || trace.blocked || groups.length === 0) el.classList.add("targetable-blocked");
          else if (trace.cover.saveTarget !== null) el.classList.add("targetable-protected");
          else el.classList.add("targetable-legal");
        }

        if (isEnemyAssaultTarget) {
          const assault = analyzeAssault(shooter, unit);
          el.classList.add(assault.legal ? "targetable-assault" : "targetable-blocked");
        }

        const legalUnitChoice = phase === "choose-unit" && currentFaction === unit.faction && !unit.activated;
        const deploymentChoice = phase === "deployment";
        if (!legalUnitChoice && !isEnemyShotTarget && !isEnemyAssaultTarget && !deploymentChoice) el.classList.add("illegal");

        el.addEventListener("click", event => {
          event.stopPropagation();
          if (gestureSuppressed()) return;
          if (adaptiveTouchActive()) handleAdaptiveUnitTap(unit.id);
          else if (phase === "deployment") selectDeploymentUnit(unit.id);
          else if (phase === "choose-target") chooseTarget(unit.id);
          else if (phase === "choose-assault-target") chooseAssaultTarget(unit.id);
          else selectUnit(unit.id);
        });
        installLongPress(el, unit);

        el.addEventListener("mouseenter", () => {
          if (phase === "choose-target" && shooter && unit.faction !== shooter.faction) showShotPreview(shooter, unit);
          else if (phase === "choose-assault-target" && shooter && unit.faction !== shooter.faction) showAssaultPreview(shooter, unit);
          else showUnitPreview(unit);
        });

        el.addEventListener("mouseleave", clearTracePreview);
        battlefield.appendChild(el);
      }

    }

    function syncCancelButtonLabel() {
      cancelButton.textContent =
        phase === "choose-target" && chosenOrder === "Fire" && !transactionLockReason
          ? "Back to Orders"
          : "Cancel Order / Reselect Unit";
    }

    function renderRangeRing() {
      const unit = getUnit(selectedUnitId);
      let distance = 0;

      const validMove =
        overlayMode === "move" &&
        phase === "plan-movement" &&
        unit;

      const validFire =
        overlayMode === "fire" &&
        phase === "choose-target" &&
        unit;

      const validAssault =
        overlayMode === "assault" &&
        phase === "choose-assault-target" &&
        unit;

      if (!validMove && !validFire && !validAssault) {
        rangeRing.hidden = true;
        battlefield.classList.remove("movement-mode");
        return;
      }

      if (validMove) {
        distance =
          chosenOrder === "Run"
            ? RULES.runDistance
            : RULES.advanceDistance;
        battlefield.classList.add("movement-mode");
      } else if (validFire) {
        distance = weaponRange(unit, chosenOrder === "Advance");
        battlefield.classList.remove("movement-mode");
      } else {
        distance = RULES.assaultDistance;
        battlefield.classList.remove("movement-mode");
      }

      const pos = tablePointToPixels(unit);
      const diameter = inchesToPixels(distance * 2);
      rangeRing.hidden = false;
      rangeRing.style.left = `${pos.x}px`;
      rangeRing.style.top = `${pos.y}px`;
      rangeRing.style.width = `${diameter}px`;
      rangeRing.style.height = `${diameter}px`;
    }

    function renderWaypoint() {
      if (!movementWaypoint || phase !== "plan-movement") {
        waypointMarker.hidden = true;
        clearRouteLines();
        return;
      }

      const px = tablePointToPixels(movementWaypoint);
      waypointMarker.hidden = false;
      waypointMarker.style.left = `${px.x}px`;
      waypointMarker.style.top = `${px.y}px`;

      const unit = getUnit(selectedUnitId);
      if (unit) drawRoute([unit, movementWaypoint], false);
    }

    // =========================================================================
    // RENDER COORDINATOR
    // One ordered presentation pipeline. Existing renderUnits() callers remain
    // valid through the compatibility wrapper below.
    // =========================================================================
    const renderGame = window.CrossroadsRefresh.create([
      context => runHooks("beforeRender", context),
      renderUnitLayer,
      renderBuildingState,
      renderRangeRing,
      renderWaypoint,
      renderExitZone,
      updateScenarioUI,
      updateTargetingVisualMode,
      updateTransactionBadge,
      syncCancelButtonLabel,
      renderDeploymentUnitTray,
      updateMobileDiagnostic,
      queueAdaptiveUI,
      context => runHooks("afterRender", context)
    ]);

    function renderUnits(context = {}) {
      renderGame(context);
    }

    function drawRoute(points, blocked) {
      clearRouteLines();
      for (let i = 0; i < points.length - 1; i++) {
        const start = tablePointToPixels(points[i]);
        const end = tablePointToPixels(points[i + 1]);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const line = document.createElement("div");
        const routeMode = chosenOrder === "Assault" ? " assault-route" : "";
        line.className = `route-line${blocked ? " blocked" : ""}${routeMode}`;
        line.style.left = `${start.x}px`;
        line.style.top = `${start.y}px`;
        line.style.width = `${Math.hypot(dx, dy)}px`;
        line.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
        routeLayer.appendChild(line);
      }
    }

    function clearRouteLines() { routeLayer.innerHTML = ""; }

    // =========================================================================
    // PREVIEW AND TARGET ANALYSIS PRESENTATION
    // Converts movement, shooting, and assault analysis into player feedback.
    // =========================================================================
    function showUnitPreview(unit) {
      const support = commandSupport(unit);
      const roleText = { officer: "Officer team", line: "Line infantry", assault: "Assault infantry", support: "Crew-served support" }[unit.role] ?? "Infantry";
      const commandText = unit.role === "officer"
        ? `Projects a ${RULES.commandRadius}″ command radius.`
        : support
          ? `Supported by ${support.name}: +${RULES.commandMoraleBonus} Morale on Order Tests.`
          : "Outside officer command range.";
      setPreview(
        "legal",
        `${capitalize(unit.faction)} ${unit.name}`,
        `${qualityLabel(unit)} ${roleText} · ${unit.soldiers}/${unit.maxSoldiers} men · Morale ${unit.morale}.`,
        `${fullLoadout(unit)} · Shooting ${qualityProfile(unit).shootingTargetModifier > 0 ? "+1 harder" : qualityProfile(unit).shootingTargetModifier < 0 ? "+1 easier" : "standard"} · Assault ${qualityProfile(unit).assaultDamageTarget}+ · ${commandText}`
      );
    }

    function showShotPreview(shooter, target) {
      const moving = chosenOrder === "Advance";
      const trace = analyzeShot(shooter, target);
      const groups = availableFireGroups(shooter, trace.distance, moving, true);
      const noAvailableWeapons = groups.length === 0;
      const state = !trace.inRange || trace.blocked || noAvailableWeapons
        ? "blocked"
        : trace.cover.saveTarget !== null ? "protected" : "legal";

      drawTrace(trace.shooterPoint ?? shooter, trace.targetPoint ?? target, state,
        !trace.inRange ? `${trace.distance.toFixed(1)}″ · OUT OF RANGE`
          : trace.blocked ? `${trace.distance.toFixed(1)}″ · BLOCKED`
          : noAvailableWeapons ? `${trace.distance.toFixed(1)}″ · NO WEAPON`
          : trace.cover.saveTarget !== null ? `${trace.distance.toFixed(1)}″ · ${trace.cover.saveTarget}+ SAVE`
          : `${trace.distance.toFixed(1)}″ · CLEAR`
      );

      const firingText = groups.map(group => `${group.profile.label}: ${group.shots} shot${group.shots === 1 ? "" : "s"}`).join(" · ");

      if (!trace.inRange) {
        setPreview("blocked", `${shooter.name} → ${target.name}`, `${trace.distance.toFixed(1)}″ away; maximum available range ${trace.range}″.`, "Illegal: out of range.");
      } else if (trace.blocked) {
        setPreview("blocked", `${shooter.name} → ${target.name}`, `${trace.distance.toFixed(1)}″ away.`, `Illegal: ${trace.blockReason}`);
      } else if (noAvailableWeapons) {
        setPreview("blocked", `${shooter.name} → ${target.name}`, `${trace.distance.toFixed(1)}″ away.`, moving ? "No weapon in this unit can fire after moving at this range; fixed MMGs must use Fire or Ambush." : "No surviving weapon is in range.");
      } else if (trace.cover.saveTarget !== null) {
        setPreview("protected", `${shooter.name} → ${target.name}`, `${trace.distance.toFixed(1)}″ away; ${firingText}.`, `${trace.cover.label}: ${trace.cover.saveTarget}+ save.`);
      } else {
        setPreview("legal", `${shooter.name} → ${target.name}`, `${trace.distance.toFixed(1)}″ away; ${firingText}.`, "No cover save.");
      }

      const totalShots = groups.reduce((sum, group) => sum + group.shots, 0);
      let hitTarget = RULES.baseHitTarget + qualityProfile(shooter).shootingTargetModifier;
      if (moving && !groups.every(group => group.profile.assault)) hitTarget += 1;
      if (shooter.pins > 0) hitTarget += 1;
      hitTarget = clamp(hitTarget, 2, 7);
      hitTarget = Math.min(7, hitTarget);

      showTargetReadout(
        target,
        state,
        target.name,
        [
          !trace.inRange ? "Out of range"
            : trace.blocked ? "Blocked"
            : noAvailableWeapons ? "No weapon"
            : `${totalShots} shot${totalShots === 1 ? "" : "s"} · Hit ${hitTarget > 6 ? "—" : `${hitTarget}+`}`,
          trace.cover.saveTarget !== null
            ? `Cover ${trace.cover.saveTarget}+`
            : "No cover"
        ]
      );
    }

    function showAssaultPreview(attacker, defender) {
      const result = analyzeAssault(attacker, defender);
      drawTrace(attacker, defender, result.legal ? "assault" : "blocked", result.legal ? `${result.distance.toFixed(1)}″ · ASSAULT` : `${result.distance.toFixed(1)}″ · ILLEGAL`);

      if (!result.legal) {
        setPreview("blocked", `${attacker.name} assaults ${defender.name}`, `${result.distance.toFixed(1)}″ charge.`, result.reason);
        showTargetReadout(defender, "blocked", defender.name, [`${result.distance.toFixed(1)}″ charge`, result.reason]);
        return;
      }

      const details = [];
      if (result.reactionFire) details.push(result.ambushReaction ? "Ambush reaction fire" : "Defensive reaction fire");
      else details.push("No reaction fire");
      details.push(result.defensivePosition ? "Defender strikes first" : "Combat is simultaneous");
      details.push(`${qualityLabel(attacker)} attacks on ${qualityProfile(attacker).assaultDamageTarget}+`);
      details.push(`${qualityLabel(defender)} defends on ${qualityProfile(defender).assaultDamageTarget}+`);

      setPreview("assault", `${attacker.name} assaults ${defender.name}`, `${result.distance.toFixed(1)}″ legal charge.`, details.join(" · "));

      showTargetReadout(
        defender,
        result.legal ? "assault" : "blocked",
        defender.name,
        [
          `${result.distance.toFixed(1)}″ charge`,
          result.reactionFire ? "Reaction fire" : "No reaction fire",
          result.defensivePosition ? "Defender first" : "Simultaneous"
        ]
      );
    }

    function drawTrace(startPoint, endPoint, stateClass, text) {
      const start = tablePointToPixels(startPoint);
      const end = tablePointToPixels(endPoint);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      traceLine.hidden = false;
      traceLine.className = `trace-line ${stateClass}`;
      traceLine.style.left = `${start.x}px`;
      traceLine.style.top = `${start.y}px`;
      traceLine.style.width = `${Math.hypot(dx, dy)}px`;
      traceLine.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
      traceLabel.hidden = false;
      traceLabel.className = `trace-label ${stateClass}`;
      traceLabel.style.left = `${(start.x + end.x) / 2}px`;
      traceLabel.style.top = `${(start.y + end.y) / 2}px`;
      traceLabel.textContent = text;
    }

    function setPreview(type, heading, body, reason) {
      previewCard.className = `preview-card ${type}`;
      previewCard.innerHTML = `<strong>${heading}</strong>${body}<span class="reason">${reason}</span>`;
    }

    function clearTracePreview() {
      traceLine.hidden = true;
      traceLabel.hidden = true;
      clearTargetReadout();
      if (!["ambush-reaction"].includes(phase)) {
        previewCard.className = "preview-card";
        previewCard.textContent = "Hover a unit to inspect its role and loadout, or select an order to inspect movement, shooting, Ambush, or an assault.";
      }
    }

    // =========================================================================
    // SHOOTING ANALYSIS AND COVER
    // Determines legal fire, range, line of sight, and intervening protection.
    // =========================================================================
    function analyzeShot(shooter, target) { return analyzeShotAtPoint(shooter, target); }

    function analyzeShotAtPoint(shooter, targetPoint) {
      const shooterPoint = shooter?.inBuilding ? buildingWindowPointToward(targetPoint) : shooter;
      const targetUnit = targetPoint?.id ? targetPoint : null;
      const targetAimPoint = targetUnit?.inBuilding ? buildingCenterPoint() : targetPoint;
      const distance = distanceBetweenPoints(shooterPoint, targetAimPoint);
      const range = weaponRange(shooter, false);
      const inRange = distance <= range + 0.001;

      let buildingHit = segmentRectClip(shooterPoint, targetAimPoint, TERRAIN.building);
      if (shooter?.inBuilding || targetUnit?.inBuilding) buildingHit = null;
      const blocked = buildingHit !== null;
      const blockReason = blocked ? "the farmhouse completely blocks line of sight." : "";
      let cover = blocked ? { label: "No shot", saveTarget: null, sources: [] } : determineLineCover(shooterPoint, targetAimPoint);
      if (!blocked && targetUnit?.inBuilding) {
        cover = { label: "Hard cover inside farmhouse", saveTarget: 3, sources: ["target occupies the farmhouse"] };
      }
      return { distance, range, inRange, blocked, blockReason, cover, shooterPoint, targetPoint: targetAimPoint };
    }

    function determineLineCover(shooter, target) {
      const sources = [];
      let saveTarget = null;
      let label = "No cover";

      const woodsClip = segmentRectClip(shooter, target, TERRAIN.woods);
      if (woodsClip !== null) {
        sources.push("line passes through woods");
        saveTarget = TERRAIN.woods.save;
        label = "Soft cover from woods";
      }

      const wallClip = segmentRectClip(shooter, target, TERRAIN.wall);
      if (wallClip !== null) {
        const nearest = distanceBetweenPoints(target, wallClip.exit);
        if (nearest <= RULES.wallProtectionDepth + 0.001) {
          sources.push(`wall crossed ${nearest.toFixed(1)}″ from target`);
          if (saveTarget === null || TERRAIN.wall.save < saveTarget) {
            saveTarget = TERRAIN.wall.save;
            label = "Hard cover from low wall";
          }
        }
      }

      if (target.down) {
        if (saveTarget === null) {
          saveTarget = 5;
          label = "Down in the open";
          sources.push("target is Down");
        } else {
          saveTarget = Math.max(2, saveTarget - 2);
          label += " + Down";
          sources.push("Down improves cover");
        }
      }

      return { label, saveTarget, sources };
    }




    // =========================================================================
    // UNIT SELECTION, ORDER BAG, AND ORDER CHOICE
    // Owns activation selection, cancellation, die draw, and order commitment.
    // =========================================================================
    function selectUnit(unitId) {
      const unit = getUnit(unitId);
      if (!unit || unit.soldiers <= 0) return;

      const switchingBeforeOrder =
        phase === "choose-order" &&
        Boolean(selectedUnitId) &&
        unitId !== selectedUnitId &&
        !transactionLockReason &&
        !chosenOrder;

      if (phase !== "choose-unit" && !switchingBeforeOrder) {
        if (phase === "choose-order" && unitId === selectedUnitId) {
          setStatus(`${unit.name} is already selected. Choose an order.`);
        } else if (phase === "plan-movement") {
          setStatus("Click a destination, or Shift-click once to add a waypoint.");
        } else if (phase === "choose-target") {
          setStatus("Choose a legal enemy target, finish the Advance, or cancel.");
        } else if (phase === "choose-assault-target") {
          setStatus("Choose an enemy to assault, or cancel.");
        } else {
          setStatus("Draw a die before choosing a unit.");
        }
        return;
      }

      if (unit.faction !== currentFaction) {
        setStatus(`Choose an unused ${capitalize(currentFaction)} unit.`);
        return;
      }

      if (unit.activated) {
        setStatus(`${unit.name} has already acted this round.`);
        return;
      }

      if (switchingBeforeOrder) {
        const previousUnit = getUnit(selectedUnitId);

        // No order has been chosen and nothing irreversible has happened, so
        // safely restore the previous selection's snapshot before opening a
        // fresh transaction for the newly clicked unit.
        restoreSnapshot();
        chosenOrder = null;
        clearGhostPreview();

        addLog(
          `Activation selection switched from ${previousUnit?.name ?? "the previous unit"} to ${unit.name}.`
        );
      }

      selectedUnitId = unitId;
      beginActivationTransaction(unit);
      phase = "choose-order";
      setOrderButtonsFor(unit);
      cancelButton.disabled = Boolean(transactionLockReason);

      const support = commandSupport(unit);
      setStatus(
        `${unit.name} selected. Choose an order.`,
        `${fullLoadout(unit)} · ${distanceToObjective(unit).toFixed(1)}″ from objective · ${unit.pins} pin${unit.pins === 1 ? "" : "s"}${support ? ` · Officer support +${RULES.commandMoraleBonus}` : ""}`
      );

      renderUnits();
      if (adaptiveTouchActive()) {
        requestAnimationFrame(() => frameTablePoint(unit, { margin: 88 }));
      }
    }

    function snapshotUnit(unit) {
      return { unitId: unit.id, x: unit.x, y: unit.y, pins: unit.pins, down: unit.down, activated: unit.activated, order: unit.order, ambush: unit.ambush, inBuilding: unit.inBuilding, buildingEntryX: unit.buildingEntryX, buildingEntryY: unit.buildingEntryY };
    }

    function restoreSnapshot() {
      if (!activationSnapshot) return;
      const unit = getUnit(activationSnapshot.unitId);
      if (!unit) return;
      Object.assign(unit, activationSnapshot);
    }

    function backToOrdersFromFire() {
      if (
        phase !== "choose-target" ||
        chosenOrder !== "Fire" ||
        transactionLockReason
      ) {
        return false;
      }

      pendingTouchTargetId = null;
      pendingTouchTargetKind = null;
      clearTargetReadout();
      overlayMode = null;
      chosenOrder = null;
      phase = "choose-order";

      clearActionOverlays();
      setOrderButtonsFor(getUnit(selectedUnitId));
      cancelButton.disabled = false;

      setStatus(
        `${getUnit(selectedUnitId)?.name ?? "Unit"} remains selected.`,
        "Fire was not committed. Choose another order, select a different unit, or cancel the activation."
      );

      addLog(`${getUnit(selectedUnitId)?.name ?? "Unit"} cancelled Fire before choosing a target.`);
      renderUnits();
      return true;
    }

    function handleCancelAction() {
      if (backToOrdersFromFire()) return;
      cancelAndReselect();
    }

    function cancelAndReselect() {
      clearGhostPreview();
      if (transactionLockReason) { setStatus("This action can no longer be cancelled.", transactionLockReason); return; }
      if (!["choose-order", "plan-movement", "choose-target", "choose-assault-target"].includes(phase)) return;
      const oldUnit = getUnit(selectedUnitId);
      restoreSnapshot();
      addLog(`${oldUnit ? capitalize(oldUnit.faction) + " " + oldUnit.name : "Selection"} cancelled. The drawn die remains available.`);
      selectedUnitId = null;
      chosenOrder = null;
      clearActivationTransaction();
      movementWaypoint = null;
      pendingMovement = null;
      pendingTouchMovement = null;
      pendingTouchTargetId = null;
      pendingTouchTargetKind = null;
      phase = "choose-unit";
      setOrderButtonsDisabled();
      cancelButton.disabled = true;
      finishAdvanceButton.hidden = true;
      clearWaypointButton.hidden = true;
      clearTracePreview();
      clearRouteLines();
      setStatus(`Choose one unused ${capitalize(currentFaction)} unit.`);
      renderUnits();
    }

    function drawDie() {
      if (phase !== "ready-to-draw" || battleEnded) {
        setStatus("Finish the current activation first.");
        return;
      }

      while (bag.length > 0) {
        const nextFaction = bag.pop();
        if (factionHasEligibleUnit(nextFaction)) {
          currentFaction = nextFaction;
          selectedUnitId = null;
          chosenOrder = null;
          activationSnapshot = null;
          phase = "choose-unit";
          drawnDie.textContent = `${capitalize(currentFaction)} Order Die`;
          drawnDie.className = `drawn-die ${currentFaction}`;
          drawButton.disabled = true;
          showOrderDiePop(currentFaction);

          for (const candidate of livingUnits()) {
            if (candidate.faction === currentFaction && !candidate.activated) {
              queueUnitEffect(candidate.id, "eligible");
            }
          }
          addLog(`${capitalize(currentFaction)} die drawn. ${bag.length} dice remain.`);
          setStatus(`Choose one unused ${capitalize(currentFaction)} unit.`);
          renderUnits();
          return;
        }
        addLog(`${capitalize(nextFaction)} die discarded: no unused unit remains.`);
      }
      endRound();
    }

    function chooseOrder(order) {
      if (phase !== "choose-order" || !selectedUnitId || battleEnded) return;
      const unit = getUnit(selectedUnitId);
      if (!unit) return;

      if (order === "Rally" && unit.pins === 0) {
        setStatus("Rally is only useful for a unit with Pins.");
        return;
      }

      if (order === "Ambush" && !FEATURES.ambush) return;
      if (order === "Assault" && !FEATURES.assault) return;

      chosenOrder = order;
      pendingTouchMovement = null;
      pendingTouchTargetId = null;
      pendingTouchTargetKind = null;
      touchWaypointArmed = false;
      setOrderButtonsDisabled();

      // An undeployed MMG spends its Fire order establishing a fixed position.
      if (order === "Fire" && isMMGTeam(unit) && !unit.mmgDeployed) {
        if (!attemptOrder(unit, "Fire")) return;
        deployMMG(unit);
        unit.order = "MMG Deployed";
        completeActivation("Deploy MMG");
        return;
      }

      // Fire begins as a reversible targeting mode. No Order Test or dice roll
      // occurs until a legal target is explicitly confirmed.
      if (order === "Fire") {
        overlayMode = "fire";
        phase = "choose-target";
        cancelButton.disabled = false;
        setStatus(
          "Fire: inspect or select an enemy target.",
          `${fullLoadout(unit)} · maximum range ${weaponRange(unit)}″ · Back to Orders remains available until a target is confirmed.`
        );
        renderUnits();
        return;
      }

      if (!attemptOrder(unit, order)) return;

      if (order === "Rally") {
        unit.pins = 0;
        addLog(`${capitalize(unit.faction)} ${unit.name} rallies and removes every Pin.`, "morale");
        completeActivation("Rally");
        return;
      }

      if (order === "Down") {
        unit.down = true;
        completeActivation("Down");
        return;
      }

      if (order === "Ambush") {
        unit.ambush = true;
        unit.order = "Ambush";
        unit.activated = true;
        addLog(`${capitalize(unit.faction)} ${unit.name} waits on Ambush.`, "ambush");
        finishActivationState();
        return;
      }

      if (order === "Assault") {
        overlayMode = "assault";
        phase = "choose-assault-target";
        cancelButton.disabled = Boolean(transactionLockReason);
        setStatus("Assault: hover an enemy to inspect the charge, then click a legal target.", "Maximum direct charge: 12″.");
        renderUnits();
        return;
      }

      if (order === "Run" || order === "Advance") {
        overlayMode = "move";
        phase = "plan-movement";
        movementWaypoint = null;
        cancelButton.disabled = Boolean(transactionLockReason);
        const distance = order === "Run" ? RULES.runDistance : RULES.advanceDistance;
        setStatus(`${order}: click a destination inside the gold circle.`, FEATURES.movementIntegrity ? `Maximum cost ${distance}″. Shift-click once to add a waypoint.` : `Maximum movement ${distance}″.`);
        renderUnits();
        return;
      }

    }

    function attemptOrder(unit, order) {
      if (unit.pins === 0 && order !== "Rally") {
        addLog(`${capitalize(unit.faction)} ${unit.name}: ${order} requires no Order Test.`);
        return true;
      }

      const ignoresPins = order === "Rally";
      const officer = commandSupport(unit);
      const officerBonus = officer ? RULES.commandMoraleBonus : 0;
      const target = clamp(unit.morale + officerBonus - (ignoresPins ? 0 : unit.pins), 2, 11);
      const dice = rollDice(2);
      lockActivationTransaction("dice rolled for the Order Test");
      const total = dice[0] + dice[1];
      const passed = total <= target;
      recordOrderTest(unit, passed);

      addLog(`${capitalize(unit.faction)} ${unit.name} (${qualityLabel(unit)}) Order Test for ${order}: ${dice[0]} + ${dice[1]} = ${total}, needs ${target} or less${officer ? ` (Officer +${officerBonus})` : ""}${ignoresPins ? " (Rally ignores Pins)" : ""}.`, passed ? "morale" : "fail");

      if (!passed) {
        unit.down = true;
        unit.order = "Down · Failed";
        unit.activated = true;
        queueUnitEffect(unit.id, "hit");
        addLog(`${capitalize(unit.faction)} ${unit.name} fails and goes Down.`, "fail");
        finishActivationState();
        return false;
      }

      if (!ignoresPins && unit.pins > 0) {
        unit.pins -= 1;
        addLog(`${unit.name} passes and removes 1 Pin; ${unit.pins} remain.`, "morale");
      }

      return true;
    }

    // =========================================================================
    // BATTLEFIELD COMMAND ROUTING
    // Directs clicks to deployment, movement, shooting, or assault contexts.
    // =========================================================================
    function handleBattlefieldClick(event) {
      if (gestureSuppressed()) return;
      const point = eventToTablePoint(event);

      if (adaptiveTouchActive() && handleAdaptiveBattlefieldTap(point)) return;

      if (phase === "deployment") {
        placeDeploymentUnit(point);
        return;
      }

      if (phase !== "plan-movement" || !selectedUnitId || !chosenOrder || battleEnded) return;
      const unit = getUnit(selectedUnitId);
      if (!unit) return;

      if (FEATURES.movementIntegrity && event.shiftKey && !movementWaypoint) {
        const waypoint = clampPoint(point);
        const analysis = analyzeMovementPath(unit, [unit, waypoint], chosenOrder, null);
        if (!analysis.legal) {
          rejectMovement(analysis, [unit, waypoint]);
          return;
        }
        movementWaypoint = waypoint;
        clearWaypointButton.hidden = false;
        setStatus("Waypoint placed. Click the final destination.", `${analysis.cost.toFixed(1)}″ spent; ${(analysis.allowance - analysis.cost).toFixed(1)}″ movement cost remains.`);
        renderUnits();
        return;
      }

      const destination = clampPoint(point);
      const path = movementWaypoint ? [unit, movementWaypoint, destination] : [unit, destination];
      let analysis = analyzeMovementPath(unit, path, chosenOrder, null);

      if (!analysis.legal && analysis.kind === "allowance") {
        const fitted = fitMovementPathToAllowance(unit, path, chosenOrder, null);
        if (fitted) {
          clearRouteLines();
          waypointMarker.hidden = true;
          addLog(`${capitalize(unit.faction)} ${unit.name}'s chosen destination exceeded the available movement; the unit stops at the furthest affordable legal point.`, "terrain");
          setPreview("protected", "Movement shortened", `Spent ${fitted.analysis.cost.toFixed(1)}″ of ${fitted.analysis.allowance}″.`, "The route entered rough ground, so the destination was automatically shortened instead of rejecting the move.");
          beginMovement(unit, fitted.path, fitted.analysis);
          return;
        }
      }

      if (!analysis.legal) {
        rejectMovement(analysis, path);
        return;
      }

      clearRouteLines();
      waypointMarker.hidden = true;
      beginMovement(unit, path, analysis);
    }

    // =========================================================================
    // MOVEMENT, TERRAIN COSTS, COLLISION, AND AMBUSH INTERRUPTION
    // Analyzes paths, begins movement, and resolves reaction opportunities.
    // =========================================================================
    function clearWaypoint() {
      if (phase !== "plan-movement") return;
      movementWaypoint = null;
      clearWaypointButton.hidden = true;
      clearRouteLines();
      waypointMarker.hidden = true;
      setStatus("Waypoint cleared. Click a destination, or Shift-click a new waypoint.");
      renderUnits();
    }

    function rejectMovement(analysis, path) {
      drawRoute(path, true);
      setStatus("Movement is not legal.", analysis.reason);
      setPreview("blocked", "Movement rejected", `Calculated cost: ${analysis.cost.toFixed(1)}″ of ${analysis.allowance}″.`, analysis.reason);
      addLog(`Movement rejected: ${analysis.reason}`, "terrain");
    }

    function analyzeMovementPath(unit, path, order, exemptUnitId) {
      const allowance = order === "Run" ? RULES.runDistance : RULES.advanceDistance;
      let cost = 0;
      const details = [];

      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        const segment = analyzeMovementSegment(unit, start, end, exemptUnitId);
        cost += FEATURES.movementIntegrity ? segment.cost : segment.distance;
        details.push(...segment.details);
        if (!segment.legal) return { legal: false, kind: "obstacle", reason: segment.reason, cost, allowance, details };
      }

      const destination = path[path.length - 1];
      const destinationCollision = analyzeDestinationCollision(unit, destination, exemptUnitId);
      if (destinationCollision.blocked) return { legal: false, kind: "collision", reason: destinationCollision.reason, cost, allowance, details };

      if (cost > allowance + 0.001) {
        return { legal: false, kind: "allowance", reason: `path costs ${cost.toFixed(1)}″ but ${order} allows ${allowance}″.`, cost, allowance, details };
      }

      return { legal: true, kind: "legal", reason: "", cost, allowance, details };
    }

    function fitMovementPathToAllowance(unit, path, order, exemptUnitId) {
      const allowance = order === "Run" ? RULES.runDistance : RULES.advanceDistance;
      const fittedPath = [path[0]];
      const details = [];
      let cost = 0;

      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        const fullSegment = analyzeMovementSegment(unit, start, end, exemptUnitId);
        if (!fullSegment.legal) return null;

        const segmentCost = FEATURES.movementIntegrity ? fullSegment.cost : fullSegment.distance;
        if (cost + segmentCost <= allowance + 0.001) {
          fittedPath.push(end);
          cost += segmentCost;
          details.push(...fullSegment.details);
          continue;
        }

        const remaining = allowance - cost;
        if (remaining <= 0.02) break;

        let low = 0;
        let high = 1;
        let bestPoint = start;
        let bestSegment = null;

        for (let step = 0; step < 34; step++) {
          const t = (low + high) / 2;
          const candidate = pointAtSegment(start, end, t);
          const segment = analyzeMovementSegment(unit, start, candidate, exemptUnitId);
          const destinationCollision = segment.legal
            ? analyzeDestinationCollision(unit, candidate, exemptUnitId)
            : { blocked: true };
          const candidateCost = segment.legal
            ? (FEATURES.movementIntegrity ? segment.cost : segment.distance)
            : Infinity;

          if (segment.legal && !destinationCollision.blocked && candidateCost <= remaining + 0.0005) {
            low = t;
            bestPoint = candidate;
            bestSegment = segment;
          } else {
            high = t;
          }
        }

        if (!bestSegment || distanceBetweenPoints(start, bestPoint) < 0.05) break;
        fittedPath.push(bestPoint);
        cost += FEATURES.movementIntegrity ? bestSegment.cost : bestSegment.distance;
        details.push(...bestSegment.details);
        details.push("destination shortened to available movement");
        return {
          path: fittedPath,
          analysis: { legal: true, kind: "fitted", reason: "", cost, allowance, details, fitted: true }
        };
      }

      if (fittedPath.length < 2) return null;
      const destinationCollision = analyzeDestinationCollision(unit, fittedPath[fittedPath.length - 1], exemptUnitId);
      if (destinationCollision.blocked) return null;
      return {
        path: fittedPath,
        analysis: { legal: true, kind: "fitted", reason: "", cost, allowance, details, fitted: true }
      };
    }

    function analyzeMovementSegment(unit, start, end, exemptUnitId) {
      const distance = distanceBetweenPoints(start, end);
      const expandedBuilding = expandRect(TERRAIN.building, RULES.unitCollisionRadius);
      if (pointInsideRect(end, expandedBuilding)) return { legal: false, reason: "destination overlaps the impassable farmhouse.", distance, cost: distance, details: [] };
      if (segmentRectClip(start, end, expandedBuilding)) return { legal: false, reason: "the path passes through the impassable farmhouse.", distance, cost: distance, details: [] };

      if (FEATURES.movementIntegrity) {
        for (const other of livingUnits()) {
          if (other.id === unit.id || other.id === exemptUnitId) continue;
          const proximity = segmentPointDistance(start, end, other);
          if (proximity.distance < RULES.unitSeparation - 0.001 && proximity.t > 0.05 && proximity.t < 0.98) {
            return { legal: false, reason: `the path passes through ${capitalize(other.faction)} ${other.name}.`, distance, cost: distance, details: [] };
          }
        }
      }

      let cost = distance;
      const details = [];

      if (FEATURES.movementIntegrity) {
        const woodsClip = segmentRectClip(start, end, TERRAIN.woods);
        if (woodsClip) {
          const insideLength = distance * Math.max(0, woodsClip.tExit - woodsClip.tEnter);
          cost += insideLength * (RULES.roughGroundMultiplier - 1);
          details.push(`${insideLength.toFixed(1)}″ through woods costs double`);
        }

        const wallClip = segmentRectClip(start, end, TERRAIN.wall);
        if (wallClip) {
          cost += RULES.wallCrossingCost;
          details.push(`wall crossing +${RULES.wallCrossingCost}″`);
        }
      }

      return { legal: true, reason: "", distance, cost, details };
    }

    function analyzeDestinationCollision(unit, destination, exemptUnitId) {
      if (!FEATURES.movementIntegrity) return { blocked: false, reason: "" };
      for (const other of livingUnits()) {
        if (other.id === unit.id || other.id === exemptUnitId) continue;
        const distance = distanceBetweenPoints(destination, other);
        if (distance < RULES.unitSeparation - 0.001) return { blocked: true, reason: `destination would overlap ${capitalize(other.faction)} ${other.name}; maintain ${RULES.unitSeparation.toFixed(1)}″ separation.` };
      }
      return { blocked: false, reason: "" };
    }

    function beginMovement(unit, path, analysis) {
      clearGhostPreview();
      pendingMovement = {
        moverId: unit.id,
        order: chosenOrder,
        path: path.map(point => ({ x: point.x, y: point.y })),
        analysis,
        handledAmbushers: new Set(),
        minPathDistance: 0
      };

      if (FEATURES.ambush) {
        const opportunity = findNextAmbushOpportunity(pendingMovement);
        if (opportunity) {
          openAmbushReaction(opportunity);
          return;
        }
      }

      finalizePendingMovement();
    }

    function findNextAmbushOpportunity(movement) {
      const mover = getUnit(movement.moverId);
      if (!mover) return null;
      const ambushers = livingUnits().filter(unit => unit.faction !== mover.faction && unit.ambush && !movement.handledAmbushers.has(unit.id));
      let best = null;

      const samples = samplePath(movement.path, RULES.ambushSampleStep);
      for (const ambusher of ambushers) {
        for (const sample of samples) {
          if (sample.pathDistance <= movement.minPathDistance + 0.01) continue;
          if (isMMGTeam(ambusher) && !targetInsideMMGArc(ambusher, sample.point)) continue;
          const trace = analyzeShotAtPoint(ambusher, { ...sample.point, down: mover.down });
          if (trace.inRange && !trace.blocked) {
            const candidate = { ambusherId: ambusher.id, triggerPoint: sample.point, pathDistance: sample.pathDistance, trace };
            if (!best || candidate.pathDistance < best.pathDistance) best = candidate;
            break;
          }
        }
      }
      return best;
    }

    function openAmbushReaction(opportunity) {
      lockActivationTransaction("an Ambush reaction was triggered");
      const mover = getUnit(pendingMovement.moverId);
      const ambusher = getUnit(opportunity.ambusherId);
      if (!mover || !ambusher) return finalizePendingMovement();

      mover.x = opportunity.triggerPoint.x;
      mover.y = opportunity.triggerPoint.y;
      pendingReaction = opportunity;
      phase = "ambush-reaction";
      reactionPanel.hidden = false;
      reactionHeading.textContent = "Ambush Interrupt";
      reactionText.className = "preview-card ambush";
      reactionText.innerHTML = `<strong>${capitalize(ambusher.faction)} ${ambusher.name}</strong>${capitalize(mover.faction)} ${mover.name} has entered a legal firing line at ${opportunity.trace.distance.toFixed(1)}″.<span class="reason">Fire now, or Hold and preserve Ambush for a later movement.</span>`;
      reactionPrimaryButton.textContent = "Fire Ambush";
      reactionSecondaryButton.textContent = "Hold Fire";
      drawnDie.textContent = "Ambush Reaction";
      drawnDie.className = "drawn-die ambush";
      setStatus(`${capitalize(ambusher.faction)} decides whether to spring the Ambush.`);
      drawTrace(ambusher, mover, opportunity.trace.cover.saveTarget !== null ? "protected" : "legal", `${opportunity.trace.distance.toFixed(1)}″ · AMBUSH`);
      renderUnits();
    }

    function resolveAmbushFire() {
      if (phase !== "ambush-reaction" || !pendingReaction || !pendingMovement) return;
      const ambusher = getUnit(pendingReaction.ambusherId);
      const mover = getUnit(pendingMovement.moverId);
      if (!ambusher || !mover) return;

      ambusher.ambush = false;
      ambusher.order = "Ambush Fired";
      if (battleStats) battleStats[ambusher.faction].ambushesFired += 1;
      addLog(`${capitalize(ambusher.faction)} ${ambusher.name} springs its Ambush.`, "ambush");
      const result = resolveShootingCore(ambusher, mover, analyzeShot(ambusher, mover), { label: "Ambush fire", movingPenalty: false });
      if (battleStats) { battleStats[ambusher.faction].ambushHits += result.hits ?? 0; battleStats[ambusher.faction].ambushCasualties += result.casualties ?? 0; }
      pendingMovement.handledAmbushers.add(ambusher.id);
      pendingMovement.minPathDistance = pendingReaction.pathDistance + 0.01;
      closeReactionPanel();

      if (result.destroyed) {
        addLog(`${capitalize(mover.faction)} ${mover.name}'s movement ends because the unit was destroyed.`, "ambush");
        pendingMovement = null;
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
        if (!checkElimination()) finishActivationState();
        else renderUnits();
        return;
      }

      const next = findNextAmbushOpportunity(pendingMovement);
      if (next) openAmbushReaction(next);
      else finalizePendingMovement();
    }

    function holdAmbushFire() {
      if (phase !== "ambush-reaction" || !pendingReaction || !pendingMovement) return;
      const ambusher = getUnit(pendingReaction.ambusherId);
      if (ambusher) addLog(`${capitalize(ambusher.faction)} ${ambusher.name} holds its Ambush fire.`, "ambush");
      pendingMovement.handledAmbushers.add(pendingReaction.ambusherId);
      pendingMovement.minPathDistance = pendingReaction.pathDistance + 0.01;
      closeReactionPanel();
      const next = findNextAmbushOpportunity(pendingMovement);
      if (next) openAmbushReaction(next);
      else finalizePendingMovement();
    }

    function closeReactionPanel() {
      reactionPanel.hidden = true;
      pendingReaction = null;
      clearTracePreview();
    }

    function finalizePendingMovement() {
      if (!pendingMovement) return;
      overlayMode = null;
      lastMovementPreview = null;
      clearGhostPreview();
      rangeRing.hidden = true;
      battlefield.classList.remove("movement-mode");
      const unit = getUnit(pendingMovement.moverId);
      if (!unit || unit.soldiers <= 0) {
        pendingMovement = null;
        finishActivationState();
        return;
      }

      const destination = pendingMovement.path[pendingMovement.path.length - 1];
      unit.x = destination.x;
      unit.y = destination.y;
      queueUnitEffect(unit.id, "move");

      if (exitUnit(unit)) {
        const order = pendingMovement.order;
        addLog(`${capitalize(unit.faction)} ${unit.name} completes ${order} by exiting the battlefield.`, "objective");
        pendingMovement = null;
        movementWaypoint = null;
        clearWaypointButton.hidden = true;
        clearRouteLines();
        waypointMarker.hidden = true;
        clearActionOverlays();
        finishActivationState();
        checkBattleEnd();
        renderUnits();
        return;
      }
      const order = pendingMovement.order;
      const cost = pendingMovement.analysis.cost;
      const details = pendingMovement.analysis.details;

      if (isMMGTeam(unit)) undeployMMG(unit, order.toLowerCase());
      addLog(`${capitalize(unit.faction)} ${unit.name} completes ${order} movement for ${cost.toFixed(1)}″ of movement cost${details.length ? ` (${details.join(", ")})` : ""}.`);
      if (unitIsOnObjective(unit)) addLog(`${capitalize(unit.faction)} ${unit.name} is within 3″ of the objective.`, "objective");

      pendingMovement = null;
      movementWaypoint = null;
      clearWaypointButton.hidden = true;
      clearRouteLines();
      waypointMarker.hidden = true;

      if (order === "Advance") {
        overlayMode = "fire";
        phase = "choose-target";
        finishAdvanceButton.hidden = false;
        cancelButton.disabled = Boolean(transactionLockReason);
        setStatus("Advance complete. Hover an enemy to shoot, or finish without firing.", `Objective distance: ${distanceToObjective(unit).toFixed(1)}″.`);
        drawnDie.textContent = `${capitalize(unit.faction)} Advance`;
        drawnDie.className = `drawn-die ${unit.faction}`;
        renderUnits();
      } else {
        completeActivation("Run");
      }
    }

    function finishAdvanceWithoutShooting() {
      if (phase !== "choose-target" || chosenOrder !== "Advance" || battleEnded) return;
      addLog(`${getUnit(selectedUnitId)?.name ?? "Unit"} completes its Advance without firing.`);
      completeActivation("Advance");
    }

    // =========================================================================
    // SHOOTING RESOLUTION
    // Applies fire groups, hit rolls, saves, pins, casualties, and statistics.
    // =========================================================================
    function chooseTarget(targetId) {
      if (phase !== "choose-target" || !selectedUnitId || battleEnded) return;
      const shooter = getUnit(selectedUnitId);
      const target = getUnit(targetId);
      if (!shooter || !target || target.soldiers <= 0) return;
      if (target.id === shooter.id && chosenOrder === "Fire") {
        backToOrdersFromFire();
        return;
      }
      if (target.faction === shooter.faction) return setStatus("Choose an enemy target.");

      if (isMMGTeam(shooter) && shooter.mmgDeployed && chosenOrder === "Fire") {
        shooter.mmgFacing = facingToward(shooter, target);
      }
      const trace = analyzeShot(shooter, target);
      const moving = chosenOrder === "Advance";
      const groups = availableFireGroups(shooter, trace.distance, moving, true);
      showShotPreview(shooter, target);
      if (!trace.inRange) return setStatus(`${target.name} is out of range at ${trace.distance.toFixed(1)}″.`, `Maximum range: ${trace.range}″.`);
      if (trace.blocked) return setStatus(`No line of sight to ${target.name}.`, trace.blockReason);
      if (groups.length === 0) return setStatus(`No surviving weapon can fire at ${target.name}.`, moving ? "Fixed weapons such as the MMG cannot fire after an Advance; finish the Advance or cancel." : "Every surviving weapon is out of range.");

      // A stationary Fire order is only committed now, after a legal target
      // has been chosen. Pinned units take their Order Test at this point.
      if (chosenOrder === "Fire" && !attemptOrder(shooter, "Fire")) {
        return;
      }

      resolveShootingCore(shooter, target, trace, { label: chosenOrder === "Advance" ? "Advance fire" : "Fire", movingPenalty: moving });
      if (!checkElimination()) completeActivation(chosenOrder);
      else renderUnits();
    }

    function resolveShootingCore(shooter, target, trace, options) {
      lockActivationTransaction(`${options?.label ?? "Shooting"} dice rolled`);
      const groups = availableFireGroups(shooter, trace.distance, options.movingPenalty, true);
      if (groups.length === 0) {
        addLog(`${capitalize(shooter.faction)} ${shooter.name} has no weapon able to fire at ${trace.distance.toFixed(1)}″${options.movingPenalty ? " after moving" : ""}.`, "fail");
        return { destroyed: false, hits: 0, casualties: 0 };
      }

      let totalHits = 0;
      let totalShots = 0;
      const shooterStats = battleStats?.[shooter.faction];

      addLog(`${capitalize(shooter.faction)} ${shooter.name} uses ${options.label} at ${target.name} from ${trace.distance.toFixed(1)}″.`, options.label.includes("Ambush") ? "ambush" : "hit");
      queueUnitEffect(shooter.id, "fire");

      for (const group of groups) {
        let hitTarget = RULES.baseHitTarget;
        const modifiers = [];
        const qualityShotModifier = qualityProfile(shooter).shootingTargetModifier;
        if (qualityShotModifier !== 0) {
          hitTarget += qualityShotModifier;
          modifiers.push(qualityShotModifier > 0 ? "Inexperienced" : "Veteran");
        }
        if (options.movingPenalty && !group.profile.assault) { hitTarget += 1; modifiers.push("fired on the move"); }
        if (shooter.pins > 0) { hitTarget += 1; modifiers.push("firer still pinned"); }
        hitTarget = clamp(hitTarget, 2, 7);

        const rolls = rollDice(group.shots);
        const hits = hitTarget > 6 ? 0 : rolls.filter(value => value >= hitTarget).length;
        totalShots += group.shots;
        totalHits += hits;

        addLog(`${group.profile.label}: ${group.shots} shot${group.shots === 1 ? "" : "s"}, hits on ${hitTarget > 6 ? "—" : hitTarget + "+"}${modifiers.length ? ` (${modifiers.join(", ")})` : ""}. Rolls: ${rolls.join(", ")} → ${hits} hit${hits === 1 ? "" : "s"}.`, hits > 0 ? "hit" : "");
      }

      if (shooterStats) { shooterStats.shotsFired += totalShots; shooterStats.hitsScored += totalHits; }

      if (totalHits > 0) {
        if (shooterStats) shooterStats.pinsInflicted += 1;
        target.pins += 1;
        queueUnitEffect(target.id, "hit");
        queueUnitEffect(target.id, "pin");
        addLog(`${target.name} gains 1 Pin and now has ${target.pins}.`, "pin");
        if (target.pins >= target.morale) {
          const removed = target.soldiers;
          recordCasualties(shooter.faction, target.faction, removed);
          recordUnitDestroyed(target, shooter.faction, "Routed after reaching its Morale in Pins");
          destroyUnit(target);
          addLog(`${capitalize(target.faction)} ${target.name} reaches its Morale in Pins and routes.`, "kill");
          return { destroyed: true, hits: totalHits, casualties: removed, shots: totalShots };
        }
      }

      const damageRolls = rollDice(totalHits);
      const potentialCasualties = damageRolls.filter(value => value >= RULES.regularDamageTarget).length;
      if (totalHits > 0) addLog(`Combined damage on 4+: ${damageRolls.join(", ")} → ${potentialCasualties} potential casualt${potentialCasualties === 1 ? "y" : "ies"}.`, potentialCasualties > 0 ? "kill" : "");

      let saved = 0;
      if (potentialCasualties > 0 && trace.cover.saveTarget !== null) {
        const saveRolls = rollDice(potentialCasualties);
        saved = saveRolls.filter(value => value >= trace.cover.saveTarget).length;
        addLog(`${trace.cover.label} ${trace.cover.saveTarget}+: ${saveRolls.join(", ")} → ${saved} saved.`, saved > 0 ? "morale" : "");
      } else if (potentialCasualties > 0) addLog("No cover save is available.");

      const requestedCasualties = Math.max(0, potentialCasualties - saved);
      const casualties = applyCasualties(target, requestedCasualties);
      if (casualties > 0 && target.soldiers > 0) {
        queueUnitEffect(target.id, "casualty");
        queueUnitEffect(target.id, "hit");
      }
      recordCasualties(shooter.faction, target.faction, casualties);
      if (casualties > 0) addLog(`${capitalize(target.faction)} ${target.name} suffers ${casualties} casualt${casualties === 1 ? "y" : "ies"}; remaining loadout: ${fullLoadout(target)}.`, "kill");
      if (target.soldiers === 0) {
        recordUnitDestroyed(target, shooter.faction, `${options.label} casualties`);
        addLog(`${capitalize(target.faction)} ${target.name} is destroyed.`, "kill");
      }
      renderUnits();
      return { destroyed: target.soldiers === 0, hits: totalHits, casualties, shots: totalShots };
    }

    // =========================================================================
    // ASSAULT ANALYSIS AND CLOSE COMBAT
    // Owns charge legality, reaction fire, combat dice, and post-combat position.
    // =========================================================================
    function analyzeAssault(attacker, defender) {
      if (defender?.inBuilding) {
        const door = buildingDoorPoint();
        const distance = distanceBetweenPoints(attacker, door);
        if (attacker?.inBuilding) return { legal:false, reason:"Exit the farmhouse before assaulting.", distance };
        if (distance > RULES.assaultDistance + 0.001) return { legal:false, reason:`Doorway is ${distance.toFixed(1)}″ away; assault range is 12″.`, distance };
        const pathAnalysis = analyzeMovementPath(attacker, [attacker, door], "Run", defender.id);
        if (!pathAnalysis.legal) return { legal:false, reason:pathAnalysis.reason, distance };
        const shotTrace = analyzeShot(defender, attacker);
        const reactionFire = !defender.down && shotTrace.inRange && !shotTrace.blocked;
        return { legal:true, reason:"", distance, pathAnalysis, reactionFire, ambushReaction:defender.ambush, defensivePosition:true, buildingAssault:true, shotTrace };
      }
      const distance = distanceBetweenUnits(attacker, defender);
      if (distance > RULES.assaultDistance + 0.001) return { legal: false, reason: `Out of assault range: ${distance.toFixed(1)}″ exceeds 12″.`, distance };

      const pathAnalysis = analyzeMovementPath(attacker, [attacker, defender], "Run", defender.id);
      if (!pathAnalysis.legal) return { legal: false, reason: pathAnalysis.reason, distance };

      const shotTrace = analyzeShot(defender, attacker);
      const ambushReaction = FEATURES.ambush && defender.ambush && shotTrace.inRange && !shotTrace.blocked;
      const reactionFire = !defender.down && shotTrace.inRange && !shotTrace.blocked && (ambushReaction || distance > RULES.reactionFireThreshold);
      const crossesWoods = segmentRectClip(attacker, defender, TERRAIN.woods) !== null;
      const crossesWall = segmentRectClip(attacker, defender, TERRAIN.wall) !== null;
      const defensivePosition = !defender.down && (crossesWoods || crossesWall);

      return { legal: true, reason: "", distance, pathAnalysis, reactionFire, ambushReaction, defensivePosition, crossesWoods, crossesWall, shotTrace };
    }

    function chooseAssaultTarget(targetId) {
      if (phase !== "choose-assault-target" || !selectedUnitId || battleEnded) return;
      const attacker = getUnit(selectedUnitId);
      const defender = getUnit(targetId);
      if (!attacker || !defender || defender.faction === attacker.faction) return;

      const analysis = analyzeAssault(attacker, defender);
      showAssaultPreview(attacker, defender);
      if (!analysis.legal) return setStatus("Assault is not legal.", analysis.reason);
      resolveAssault(attacker, defender, analysis);
    }

    function resolveAssault(attacker, defender, analysis) {
      if (battleStats) battleStats[attacker.faction].assaultsAttempted += 1;
      addLog(`${capitalize(attacker.faction)} ${attacker.name} declares a ${analysis.distance.toFixed(1)}″ assault against ${defender.name}.`, "assault");

      if (analysis.reactionFire) {
        if (analysis.ambushReaction) {
          defender.ambush = false;
          defender.order = "Ambush Fired";
          addLog(`${capitalize(defender.faction)} ${defender.name} uses its Ambush for reaction fire.`, "ambush");
        } else {
          addLog(`${capitalize(defender.faction)} ${defender.name} fires defensively before contact.`, "assault");
        }

        const reactionResult = resolveShootingCore(defender, attacker, analysis.shotTrace, { label: "Reaction fire", movingPenalty: false });
        if (reactionResult.destroyed) {
          if (battleStats) battleStats[defender.faction].assaultsStoppedByFire += 1;
          addLog(`The assault collapses before contact.`, "assault");
          selectedUnitId = null;
          chosenOrder = null;
          activationSnapshot = null;
          if (!checkElimination()) finishActivationState();
          return;
        }
      } else {
        addLog(`No reaction fire is available.`, "assault");
      }

      resolveCloseCombat(attacker, defender, analysis);
    }

    function resolveCloseCombat(attacker, defender, analysis) {
      lockActivationTransaction("close-combat dice rolled");
      let combatRound = 1;
      const defenderPosition = { x: defender.x, y: defender.y };
      const attackerStart = { x: attacker.x, y: attacker.y };
      let winner = null;

      while (!winner && combatRound <= 30 && attacker.soldiers > 0 && defender.soldiers > 0) {
        addLog(`Close combat round ${combatRound}${analysis.defensivePosition && combatRound === 1 ? " — defender has a Defensive Position" : ""}.`, "assault");
        let attackerKills = 0;
        let defenderKills = 0;

        if (analysis.defensivePosition && combatRound === 1) {
          const defenderRolls = rollDice(defender.soldiers);
          const defenderAssaultTarget = qualityProfile(defender).assaultDamageTarget;
          defenderKills = defenderRolls.filter(value => value >= defenderAssaultTarget).length;
          defenderKills = applyCasualties(attacker, defenderKills);
          recordCasualties(defender.faction, attacker.faction, defenderKills);
          addLog(`Defender strikes first (${qualityLabel(defender)}, ${qualityProfile(defender).assaultDamageTarget}+): ${defenderRolls.join(", ")} → ${defenderKills} attacker casualt${defenderKills === 1 ? "y" : "ies"}.`, "assault");

          if (attacker.soldiers > 0) {
            const attackerRolls = rollDice(attacker.soldiers);
            const attackerAssaultTarget = qualityProfile(attacker).assaultDamageTarget;
            attackerKills = attackerRolls.filter(value => value >= attackerAssaultTarget).length;
            attackerKills = applyCasualties(defender, attackerKills);
            recordCasualties(attacker.faction, defender.faction, attackerKills);
            addLog(`Surviving attackers strike (${qualityLabel(attacker)}, ${qualityProfile(attacker).assaultDamageTarget}+): ${attackerRolls.join(", ")} → ${attackerKills} defender casualt${attackerKills === 1 ? "y" : "ies"}.`, "assault");
          }
        } else {
          const attackerDice = attacker.soldiers;
          const defenderDice = defender.soldiers;
          const attackerRolls = rollDice(attackerDice);
          const defenderRolls = rollDice(defenderDice);
          const attackerAssaultTarget = qualityProfile(attacker).assaultDamageTarget;
          attackerKills = attackerRolls.filter(value => value >= attackerAssaultTarget).length;
          const defenderAssaultTarget = qualityProfile(defender).assaultDamageTarget;
          defenderKills = defenderRolls.filter(value => value >= defenderAssaultTarget).length;
          defenderKills = applyCasualties(attacker, defenderKills);
          attackerKills = applyCasualties(defender, attackerKills);
          recordCasualties(defender.faction, attacker.faction, defenderKills);
          recordCasualties(attacker.faction, defender.faction, attackerKills);
          addLog(`Simultaneous attacks — attacker ${qualityLabel(attacker)} ${qualityProfile(attacker).assaultDamageTarget}+: ${attackerRolls.join(", ")} → ${attackerKills}; defender ${qualityLabel(defender)} ${qualityProfile(defender).assaultDamageTarget}+: ${defenderRolls.join(", ")} → ${defenderKills}.`, "assault");
        }

        if (attacker.soldiers === 0 && defender.soldiers === 0) winner = "mutual";
        else if (attackerKills > defenderKills || defender.soldiers === 0) winner = "attacker";
        else if (defenderKills > attackerKills || attacker.soldiers === 0) winner = "defender";
        else {
          addLog(`The round is tied; another close-combat round begins.`, "assault");
          combatRound += 1;
        }
      }

      if (!winner) winner = attacker.soldiers >= defender.soldiers ? "attacker" : "defender";

      if (winner === "attacker") {
        const removed = defender.soldiers;
        recordCasualties(attacker.faction, defender.faction, removed);
        recordUnitDestroyed(defender, attacker.faction, "Defeated in close combat");
        if (battleStats) battleStats[attacker.faction].assaultsWon += 1;
        destroyUnit(defender);
        const safe = findSafeAssaultPosition(attacker, defenderPosition, attackerStart);
        attacker.x = safe.x;
        attacker.y = safe.y;
        if (analysis.buildingAssault) {
          occupyBuilding(attacker, { fromAssault: true });
      showBattleAnnouncement("FARMHOUSE CLEARED", `${attacker.name} takes the position`, attacker.faction, 1200);
          addLog(`${capitalize(attacker.faction)} ${attacker.name} clears and occupies the farmhouse.`, "assault");
        } else {
          addLog(`${capitalize(attacker.faction)} ${attacker.name} wins; ${defender.name} is destroyed and the attacker occupies the position.`, "assault");
        }
        completeActivation("Assault");
      } else if (winner === "defender") {
        const removed = attacker.soldiers;
        recordCasualties(defender.faction, attacker.faction, removed);
        recordUnitDestroyed(attacker, defender.faction, "Defeated in close combat");
        if (battleStats) battleStats[defender.faction].assaultsWon += 1;
        destroyUnit(attacker);
        addLog(`${capitalize(defender.faction)} ${defender.name} wins; the assaulting unit is destroyed.`, "assault");
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
        if (!checkElimination()) finishActivationState();
      } else {
        const attackerRemoved = attacker.soldiers;
        const defenderRemoved = defender.soldiers;
        recordCasualties(defender.faction, attacker.faction, attackerRemoved);
        recordCasualties(attacker.faction, defender.faction, defenderRemoved);
        recordUnitDestroyed(attacker, defender.faction, "Mutual destruction in close combat");
        recordUnitDestroyed(defender, attacker.faction, "Mutual destruction in close combat");
        destroyUnit(attacker);
        destroyUnit(defender);
        addLog(`Both units are destroyed in the close combat.`, "assault");
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
        if (!checkElimination()) finishActivationState();
      }
      renderUnits();
    }

    function findSafeAssaultPosition(attacker, targetPosition, attackerStart) {
      if (!FEATURES.movementIntegrity) return targetPosition;
      const angle = Math.atan2(attackerStart.y - targetPosition.y, attackerStart.x - targetPosition.x);
      const candidates = [0, 1.8, 2.4, 3.0].flatMap(radius => [0, .7, -.7, 1.4, -1.4].map(offset => ({
        x: targetPosition.x + Math.cos(angle + offset) * radius,
        y: targetPosition.y + Math.sin(angle + offset) * radius
      })));
      for (const candidate of candidates) {
        const point = clampPoint(candidate);
        if (!pointInsideRect(point, expandRect(TERRAIN.building, RULES.unitCollisionRadius)) && !analyzeDestinationCollision(attacker, point, null).blocked) return point;
      }
      return clampPoint(attackerStart);
    }

    // =========================================================================
    // ACTION COMPLETION, ROUND FLOW, AND ELIMINATION
    // Clears transient state, completes activations, and advances the battle.
    // =========================================================================
    function clearActionOverlays() {
      overlayMode = null;
      rangeRing.hidden = true;
      battlefield.classList.remove("movement-mode");
      clearGhostPreview();
      clearTracePreview();
      clearRouteLines();
      movementWaypoint = null;
      waypointMarker.hidden = true;

      if (typeof pendingTouchMovement !== "undefined") pendingTouchMovement = null;
      if (typeof pendingTouchTargetId !== "undefined") pendingTouchTargetId = null;
      if (typeof pendingTouchTargetKind !== "undefined") pendingTouchTargetKind = null;
      if (typeof pendingTouchDeploymentPoint !== "undefined") pendingTouchDeploymentPoint = null;
      if (typeof touchWaypointArmed !== "undefined") touchWaypointArmed = false;
    }

    function finalizeActionTransaction({
      unit = getUnit(selectedUnitId),
      order = chosenOrder,
      logMessage = null
    } = {}) {
      clearActionOverlays();
      if (typeof clearTargetReadout === "function") clearTargetReadout();

      if (unit) {
        unit.order = order;
        unit.activated = true;
      }

      if (logMessage) addLog(logMessage);
      finishActivationState();
    }

    function completeActivation(order) {
      const unit = getUnit(selectedUnitId);
      finalizeActionTransaction({
        unit,
        order,
        logMessage: unit
          ? `${capitalize(unit.faction)} ${unit.name}: ${order} order complete.`
          : null
      });
    }

    function finishActivationState() {
      clearActionOverlays();
      phase = "ready-to-draw";
      currentFaction = null;
      selectedUnitId = null;
      chosenOrder = null;
      clearActivationTransaction();
      pendingMovement = null;
      closeReactionPanel();
      setOrderButtonsDisabled();
      cancelButton.disabled = true;
      finishAdvanceButton.hidden = true;
      clearWaypointButton.hidden = true;

      if (bag.length === 0 || !livingUnits().some(unit => !unit.activated)) endRound();
      else {
        drawnDie.textContent = "Order completed";
        drawnDie.className = "drawn-die";
        drawButton.disabled = false;
        setStatus(`Order completed. ${bag.length} dice remain in the bag.`);
        renderUnits();
      }
    }

    function endRound() {
      if (battleEnded) return;

      clearActionOverlays();

      // Ambush only lasts for the current round. Expire it immediately at
      // round end, even when no enemy ever entered range.
      for (const unit of livingUnits()) {
        if (unit.ambush) {
          addLog(
            `${capitalize(unit.faction)} ${unit.name}'s unused Ambush expires at the end of Round ${round}.`,
            "ambush"
          );
          unit.ambush = false;
          unit.order = "Ambush Expired";
        }
      }

      phase = "round-complete";
      currentFaction = null;
      selectedUnitId = null;
      chosenOrder = null;
      activationSnapshot = null;
      pendingMovement = null;
      closeReactionPanel();

      setOrderButtonsDisabled();
      cancelButton.disabled = true;
      finishAdvanceButton.hidden = true;
      clearWaypointButton.hidden = true;
      drawButton.disabled = true;

      // Explicitly expose both the desktop and adaptive continue controls.
      nextRoundButton.hidden = false;
      nextRoundButton.disabled = false;

      drawnDie.textContent = "Round Complete";
      drawnDie.className = "drawn-die";

      const state = objectiveState();
      setStatus(
        {
          blue: "Round complete. Blue controls the objective.",
          red: "Round complete. Red controls the objective.",
          contested: "Round complete. The objective is contested.",
          none: "Round complete. Nobody controls the objective."
        }[state],
        "Unused Ambush orders have expired. Press Score Round & Continue."
      );

      showBattleAnnouncement(
        `ROUND ${round} COMPLETE`,
        state === "contested"
          ? "Objective contested"
          : state === "none"
            ? "Objective uncontrolled"
            : `${activeScenario.factions[state].name} controls`,
        state === "blue" ? "blue" : state === "red" ? "red" : "neutral",
        1000
      );
      addLog(`Round ${round} complete. Objective state: ${state}.`, "objective");
      renderUnits();
      updateAdaptiveUI();
    }


    function checkElimination() {
      const factions = new Set(livingUnits().map(unit => unit.faction));
      if (factions.size >= 2) return false;
      endBattleByElimination();
      return true;
    }






    function setOrderButtonsDisabled() { for (const button of orderButtons) button.disabled = true; }

    function setStatus(message, detail = "") {
      statusPanel.innerHTML = `<strong>What to do</strong>${message}${detail ? `<span class="detail">${detail}</span>` : ""}`;
      queueAdaptiveUI();
    }

    function addLog(message, className = "") {
      battleLogEntries.push({ round, phase, message, className });
      const entry = document.createElement("div");
      entry.className = `log-entry ${className}`.trim();
      entry.textContent = message;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }

    // =========================================================================
    // GENERIC GEOMETRY, PATH, DICE, AND FORMATTING HELPERS
    // Low-level calculations shared by movement, cover, LOS, and rendering.
    // =========================================================================
    function samplePath(path, step) {
      const samples = [];
      let cumulative = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        const length = distanceBetweenPoints(start, end);
        const count = Math.max(1, Math.ceil(length / step));
        for (let n = 1; n <= count; n++) {
          const t = n / count;
          samples.push({ point: pointAtSegment(start, end, t), pathDistance: cumulative + length * t });
        }
        cumulative += length;
      }
      return samples;
    }

    function segmentRectClip(start, end, rect) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      let tEnter = 0;
      let tExit = 1;
      const checks = [
        [-dx, start.x - rect.x],
        [ dx, rect.x + rect.width - start.x],
        [-dy, start.y - rect.y],
        [ dy, rect.y + rect.height - start.y]
      ];

      for (const [p, q] of checks) {
        if (Math.abs(p) < 1e-9) {
          if (q < 0) return null;
          continue;
        }
        const t = q / p;
        if (p < 0) {
          if (t > tExit) return null;
          if (t > tEnter) tEnter = t;
        } else {
          if (t < tEnter) return null;
          if (t < tExit) tExit = t;
        }
      }

      if (tEnter > tExit) return null;
      return { tEnter, tExit, entry: pointAtSegment(start, end, tEnter), exit: pointAtSegment(start, end, tExit) };
    }

    function segmentPointDistance(start, end, point) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq === 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
      const closest = { x: start.x + dx * t, y: start.y + dy * t };
      return { distance: distanceBetweenPoints(closest, point), t, closest };
    }

    function pointAtSegment(start, end, t) { return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }; }

    function pointInsideRect(point, rect) {
      return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    function expandRect(rect, amount) { return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 }; }
    function clampPoint(point) { return { x: clamp(point.x, RULES.unitCollisionRadius, RULES.tableWidth - RULES.unitCollisionRadius), y: clamp(point.y, RULES.unitCollisionRadius, RULES.tableHeight - RULES.unitCollisionRadius) }; }
    function rollDice(count) { return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)); }
    function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }



    // =========================================================================
    // DATA-DRIVEN SCENARIO DEFINITIONS
    // Forces, deployment, objectives, scoring, victory, and briefing content.
    // =========================================================================
    const SCENARIOS = window.CROSSROADS_SCENARIOS;
    if (!SCENARIOS) {
      throw new Error("scenarios.js did not load. Upload scenarios.js beside index.html.");
    }

    // =========================================================================
    // ACTIVE SCENARIO AND REPORTING STATE
    // Current scenario, deployment progress, battle statistics, and result.
    // =========================================================================
    let activeScenarioId = "take_the_crossroads";
    let activeScenario = SCENARIOS[activeScenarioId];
    let deploymentFactionIndex = 0;
    let deploymentConfirmed = new Set();
    let finalScenarioScored = false;
    let battleStats = null;
    let battleLogEntries = [];
    let battleResult = null;
    let battleHasBegun = false;


    // =========================================================================
    // BATTLE STATISTICS AND AFTER-ACTION DATA
    // Records orders, casualties, destruction, scoring, and unit survival.
    // =========================================================================
    function emptyFactionStats() {
      return {
        unitsStarted: 0,
        soldiersStarted: 0,
        shotsFired: 0,
        hitsScored: 0,
        casualtiesInflicted: 0,
        casualtiesSuffered: 0,
        pinsInflicted: 0,
        orderTests: 0,
        orderTestsPassed: 0,
        orderTestsFailed: 0,
        objectiveRoundsControlled: 0,
        finalObjectiveControl: 0,
        ambushesFired: 0,
        ambushHits: 0,
        ambushCasualties: 0,
        assaultsAttempted: 0,
        assaultsWon: 0,
        assaultsStoppedByFire: 0,
        unitsDestroyed: 0,
        unitsLost: 0,
        unitsExited: 0,
        soldiersExited: 0,
        breakthroughPoints: 0
      };
    }

    function createBattleStats() {
      const result = {
        blue: emptyFactionStats(),
        red: emptyFactionStats(),
        destroyedUnitIds: new Set(),
        unitHistory: {}
      };

      for (const faction of ["blue", "red"]) {
        const factionUnits = units.filter(unit => unit.faction === faction);
        result[faction].unitsStarted = factionUnits.length;
        result[faction].soldiersStarted = factionUnits.reduce((sum, unit) => sum + unit.soldiers, 0);
      }

      for (const unit of units) {
        result.unitHistory[unit.id] = {
          id: unit.id,
          faction: unit.faction,
          name: unit.name,
          type: unit.type,
          started: unit.soldiers,
          destroyedRound: null,
          destroyedCause: "",
          creditedFaction: null
        };
      }

      return result;
    }

    function recordCasualties(sourceFaction, targetFaction, count) {
      if (!battleStats || count <= 0) return;
      if (sourceFaction && battleStats[sourceFaction]) battleStats[sourceFaction].casualtiesInflicted += count;
      if (targetFaction && battleStats[targetFaction]) battleStats[targetFaction].casualtiesSuffered += count;
    }

    function recordUnitDestroyed(unit, creditedFaction, cause) {
      if (!battleStats || !unit || battleStats.destroyedUnitIds.has(unit.id)) return;
      battleStats.destroyedUnitIds.add(unit.id);
      battleStats[unit.faction].unitsLost += 1;
      if (creditedFaction && battleStats[creditedFaction]) battleStats[creditedFaction].unitsDestroyed += 1;
      const history = battleStats.unitHistory[unit.id];
      if (history) {
        history.destroyedRound = round;
        history.destroyedCause = cause;
        history.creditedFaction = creditedFaction;
      }
    }

    function recordOrderTest(unit, passed) {
      if (!battleStats || !unit) return;
      const stats = battleStats[unit.faction];
      stats.orderTests += 1;
      if (passed) stats.orderTestsPassed += 1;
      else stats.orderTestsFailed += 1;
    }

    function factionForceSummary(faction) {
      const force = units.filter(unit => unit.faction === faction);
      const list = force.map(unit => `<li><strong>${unit.name}</strong> — ${fullLoadout(unit)} · ${unit.soldiers} soldiers</li>`).join("");
      const soldiers = force.reduce((sum, unit) => sum + unit.soldiers, 0);
      return `<h3>${activeScenario.factions[faction].name}</h3><div>${force.length} units · ${soldiers} soldiers</div><ul>${list}</ul>`;
    }

    function scenarioScoringSummary() {
      if (scenarioIsBreakthrough()) {
        return [
          "Red scores 2 points immediately for each unit that exits through the Blue edge.",
          "At battle end, Blue scores 1 point for each Red unit that did not exit.",
          "The higher score wins; tied scores use surviving soldiers as the tiebreaker."
        ];
      }

      const pieces = [];
      const roundPoints = activeScenario.scoring.roundControl ?? 0;
      const finalPoints = activeScenario.scoring.finalControl ?? 0;
      if (roundPoints > 0) pieces.push(`Control ${scenarioObjective().label} at round end: ${roundPoints} point${roundPoints === 1 ? "" : "s"}.`);
      if (finalPoints > 0) pieces.push(`Control ${scenarioObjective().label} when the battle ends: ${finalPoints} point${finalPoints === 1 ? "" : "s"}.`);
      if (activeScenario.victory.elimination) pieces.push("Eliminating the opposing force wins immediately.");
      pieces.push(`Tied scores use ${activeScenario.victory.tiebreaker === "survivingSoldiers" ? "surviving soldiers" : "surviving units"}.`);
      return pieces;
    }

    // =========================================================================
    // BRIEFING AND AFTER-ACTION REPORT UI
    // Renders mission information and the completed battle record.
    // =========================================================================
    function renderBriefing() {
      const objective = scenarioObjective();
      briefingTitle.textContent = activeScenario.title;
      briefingDescription.textContent = activeScenario.description;
      briefingMeta.innerHTML = [
        `${activeScenario.rounds} rounds`,
        `${activeScenario.table.width}″ × ${activeScenario.table.height}″ table`,
        activeScenario.deployment.mode === "fixed" ? "Fixed deployment" : "Player deployment",
        scenarioIsBreakthrough()
          ? "Exit objective · Blue table edge"
          : `${objective.label} · ${objective.radius}″ control radius`
      ].map(item => `<span class="brief-chip">${item}</span>`).join("");

      briefingIntelLine.textContent = scenarioIsBreakthrough()
        ? "MISSION: Red must break through the Blue line. Every unit that exits survives and scores immediately; every unit contained strengthens Blue's final score."
        : "MISSION: Seize the crossroads, deny it to the enemy, and keep enough combat power intact to hold it through the final round.";

      briefingMissionStrip.innerHTML = scenarioIsBreakthrough()
        ? `<div class="briefing-role blue"><strong>Blue mission</strong>Delay, pin, and contain Red before units enter the 3″ exit strip.</div><div class="briefing-role red"><strong>Red mission</strong>Move surviving units through the Blue table edge. Each exit scores 2 points.</div>`
        : `<div class="briefing-role blue"><strong>Blue mission</strong>Control the central objective at round end and deny Red access.</div><div class="briefing-role red"><strong>Red mission</strong>Control the central objective at round end and deny Blue access.</div>`;

      briefingBlueForce.innerHTML = factionForceSummary("blue");
      briefingRedForce.innerHTML = factionForceSummary("red");
      briefingObjectives.innerHTML = scenarioIsBreakthrough()
        ? `<h3>Deployment & Objective</h3><p><strong>${activeScenario.factions.blue.name}:</strong> Deploy within the 18″ Blue zone and build a blocking position.</p><p><strong>${activeScenario.factions.red.name}:</strong> Deploy within the 12″ Red zone and reach the marked exit edge.</p>`
        : `<h3>Deployment & Objective</h3><p>Both forces deploy within 12″ of their own table edge. The objective at the center is controlled by an uncontested active unit within 3″.</p>`;
      briefingRules.innerHTML = `<h3>Scoring & Victory</h3><ul>${scenarioScoringSummary().map(rule => `<li>${rule}</li>`).join("")}</ul>`;
      briefingBeginButton.textContent = activeScenario.deployment.mode === "fixed" ? "BEGIN BATTLE" : "BEGIN DEPLOYMENT";
      briefingCloseButton.textContent = "CHANGE SCENARIO";
      configureResponsiveModalSections(briefingModal, true);
    }

    function showBriefing() {
      renderBriefing();
      briefingModal.hidden = false;
    }

    function hideBriefing() {
      briefingModal.hidden = true;
    }

    function determineResultTier(result) {
      if (!result || !result.winner) return "Stalemate";
      const name = activeScenario.factions[result.winner].name;
      if (result.reason === "elimination") return `Decisive ${name} Victory`;
      if (result.reason === "tiebreak") return `Hard-Fought ${name} Victory`;
      const margin = Math.abs((result.blueScore ?? scores.blue) - (result.redScore ?? scores.red));
      if (margin >= 3) return `Decisive ${name} Victory`;
      if (margin >= 2) return `Clear ${name} Victory`;
      return `Narrow ${name} Victory`;
    }

    function currentFactionReport(faction) {
      const stats = battleStats?.[faction] ?? emptyFactionStats();
      const force = units.filter(unit => unit.faction === faction);
      const unitsRemaining = force.filter(unit => unit.soldiers > 0).length;
      const soldiersRemaining = force.reduce((sum, unit) => sum + Math.max(0, unit.soldiers), 0);
      return { ...stats, unitsRemaining, soldiersRemaining };
    }

    function factionStatsHtml(faction) {
      const data = currentFactionReport(faction);
      const name = activeScenario.factions[faction].name;
      return `<article class="aar-box force-card ${faction}">
        <div class="aar-faction-title"><h3>${name}</h3><strong>${scores[faction]} pts</strong></div>
        <div class="stat-list">
          <span>Units remaining</span><strong>${data.unitsRemaining} / ${data.unitsStarted}</strong>
          <span>Soldiers remaining</span><strong>${data.soldiersRemaining} / ${data.soldiersStarted}</strong>
          <span>Casualties inflicted</span><strong>${data.casualtiesInflicted}</strong>
          <span>Units destroyed</span><strong>${data.unitsDestroyed}</strong>
          <span>Pins inflicted</span><strong>${data.pinsInflicted}</strong>
          <span>Order Tests</span><strong>${data.orderTestsPassed} passed / ${data.orderTestsFailed} failed</strong>
          <span>Objective rounds</span><strong>${data.objectiveRoundsControlled}</strong>
          <span>Ambushes</span><strong>${data.ambushesFired} fired · ${data.ambushHits} hits</strong>
          <span>Assaults</span><strong>${data.assaultsWon} won / ${data.assaultsAttempted} attempted</strong>
          <span>Shots / hits</span><strong>${data.shotsFired} / ${data.hitsScored}</strong>
        </div>
      </article>`;
    }

    function unitReportHtml() {
      const rows = units.map(unit => {
        const history = battleStats?.unitHistory?.[unit.id];
        const alive = unit.soldiers > 0;
        const status = alive ? `Survived with ${unit.soldiers}` : `Destroyed in Round ${history?.destroyedRound ?? round}`;
        const cause = alive ? "—" : (history?.destroyedCause || "Destroyed");
        return `<tr><td data-label="Force">${activeScenario.factions[unit.faction].name}</td><td data-label="Unit">${unit.name}</td><td data-label="Quality">${qualityLabel(unit)}</td><td data-label="Started">${history?.started ?? unit.maxSoldiers}</td><td data-label="Remaining">${Math.max(0, unit.soldiers)}</td><td data-label="Outcome">${status}</td><td data-label="Cause">${cause}</td></tr>`;
      }).join("");
      return `<table class="unit-report-table"><thead><tr><th>Force</th><th>Unit</th><th>Quality</th><th>Started</th><th>Remaining</th><th>Outcome</th><th>Cause</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function buildBattleLogText() {
      const resultLine = battleResult?.message ?? "Battle in progress";
      const entries = battleLogEntries.map(entry => `[Round ${entry.round}] ${entry.message}`).join("\n");
      return `${activeScenario.title}\n${resultLine}\nFinal score: ${activeScenario.factions.blue.name} ${scores.blue} — ${scores.red} ${activeScenario.factions.red.name}\n\n${entries}`;
    }

    function renderAfterActionReport(message, result) {
      battleResult = { ...(result ?? {}), message };
      const tier = determineResultTier(battleResult);
      const bannerClass = battleResult.winner ?? "draw";
      aarTitle.textContent = activeScenario.title;
      aarResultBanner.className = `result-banner ${bannerClass}`;
      aarResultBanner.innerHTML = `<span class="result-tier">${tier}</span>${message}`;
      aarScoreline.innerHTML = `<span>${activeScenario.factions.blue.name} ${scores.blue}</span><span>—</span><span>${scores.red} ${activeScenario.factions.red.name}</span>`;
      aarStats.innerHTML = factionStatsHtml("blue") + factionStatsHtml("red");
      aarUnitTable.innerHTML = unitReportHtml();
      aarBattleLog.value = buildBattleLogText();
      copyStatus.textContent = "";
      showReportButton.hidden = false;
      configureResponsiveModalSections(afterActionModal, true);
    }

    function showAfterActionReport() {
      if (!battleResult) return;
      renderAfterActionReport(battleResult.message, battleResult);
      afterActionModal.hidden = false;
    }

    async function copyBattleLog() {
      const value = aarBattleLog.value;
      try {
        await navigator.clipboard.writeText(value);
        copyStatus.textContent = "Battle log copied.";
      } catch (error) {
        aarBattleLog.focus();
        aarBattleLog.select();
        document.execCommand("copy");
        copyStatus.textContent = "Battle log selected and copied using the browser fallback.";
      }
    }

    // =========================================================================
    // SCENARIO LOADING AND TERRAIN PRESENTATION
    // Applies the active definition and creates its runtime unit state.
    // =========================================================================
    function scenarioObjective() { return activeScenario.objectives[0]; }

    function buildUnitsForActiveScenario() {
      return instantiateScenarioUnits(activeScenario);
    }

    function applyRectStyle(el, rect) {
      el.style.left = `${rect.x / RULES.tableWidth * 100}%`;
      el.style.top = `${rect.y / RULES.tableHeight * 100}%`;
      el.style.width = `${rect.width / RULES.tableWidth * 100}%`;
      el.style.height = `${rect.height / RULES.tableHeight * 100}%`;
    }

    function applyScenarioDefinition() {
      activeScenario = SCENARIOS[activeScenarioId];
      RULES.tableWidth = activeScenario.table.width;
      RULES.tableHeight = activeScenario.table.height;
      RULES.maxRounds = activeScenario.rounds;
      const objective = scenarioObjective();
      RULES.objective = { x: objective.x, y: objective.y, radius: objective.radius };

      for (const key of ["woods", "wall", "building"]) {
        Object.assign(TERRAIN[key], activeScenario.terrain[key]);
        const el = battlefield.querySelector(`.terrain.${key}`);
        if (el) applyRectStyle(el, TERRAIN[key]);
      }

      const ring = battlefield.querySelector(".objective-ring");
      const marker = battlefield.querySelector(".objective-marker");
      for (const el of [ring, marker]) {
        if (!el) continue;
        el.style.left = `${objective.x / RULES.tableWidth * 100}%`;
        el.style.top = `${objective.y / RULES.tableHeight * 100}%`;
      }
      if (ring) ring.style.width = `${objective.radius * 2 / RULES.tableWidth * 100}%`;

      const blueZone = activeScenario.deployment.zones.blue;
      const redZone = activeScenario.deployment.zones.red;
      const blueEl = battlefield.querySelector(".deployment-zone.blue");
      const redEl = battlefield.querySelector(".deployment-zone.red");
      if (blueEl) {
        blueEl.style.left = `${blueZone.xMin / RULES.tableWidth * 100}%`;
        blueEl.style.width = `${(blueZone.xMax - blueZone.xMin) / RULES.tableWidth * 100}%`;
      }
      if (redEl) {
        redEl.style.left = `${redZone.xMin / RULES.tableWidth * 100}%`;
        redEl.style.right = "auto";
        redEl.style.width = `${(redZone.xMax - redZone.xMin) / RULES.tableWidth * 100}%`;
      }
      const blueLabel = battlefield.querySelector(".deployment-label.blue");
      const redLabel = battlefield.querySelector(".deployment-label.red");
      if (blueLabel) blueLabel.textContent = blueZone.label.toUpperCase();
      if (redLabel) redLabel.textContent = redZone.label.toUpperCase();

      document.getElementById("blueFactionName").textContent = activeScenario.factions.blue.name;
      document.getElementById("redFactionName").textContent = activeScenario.factions.red.name;
      document.getElementById("scenarioBrief").innerHTML = `<strong>${activeScenario.title}</strong><br>${activeScenario.description}`;
      createRulerLabels();
    }

    // =========================================================================
    // DEPLOYMENT SYSTEM
    // Owns faction sequence, legal zones, placement, confirmation, and start.
    // =========================================================================
    function currentDeploymentFaction() {
      return activeScenario.deployment.order[deploymentFactionIndex] ?? null;
    }

    function pointInDeploymentZone(point, faction) {
      const zone = activeScenario.deployment.zones[faction];
      return point.x >= zone.xMin && point.x <= zone.xMax && point.y >= zone.yMin && point.y <= zone.yMax;
    }

    function deploymentIsValidForFaction(faction) {
      const factionUnits = livingUnits().filter(unit => unit.faction === faction);
      return factionUnits.every(unit => {
        if (!pointInDeploymentZone(unit, faction)) return false;
        if (pointInsideRect(unit, expandRect(TERRAIN.building, RULES.unitCollisionRadius))) return false;
        return !analyzeDestinationCollision(unit, unit, null).blocked;
      });
    }

    function updateDeploymentProgress() {
      const el = document.getElementById("deploymentProgress");
      if (!el) return;
      const restoreButton = document.getElementById("restoreDeploymentButton");
      const clearButton = document.getElementById("clearDeploymentButton");
      if (restoreButton) restoreButton.hidden = phase !== "deployment";
      if (clearButton) clearButton.hidden = phase !== "deployment";
      if (phase !== "deployment") {
        el.textContent = activeScenario.deployment.mode === "fixed" ? "Fixed deployment loaded." : "Deployment complete.";
        return;
      }
      const faction = currentDeploymentFaction();
      const valid = faction ? deploymentIsValidForFaction(faction) : false;
      el.textContent = `${activeScenario.factions[faction].name} deploying · ${valid ? "all positions valid" : "one or more positions invalid"}`;
      startBattleButton.disabled = !valid;
      startBattleButton.textContent = deploymentFactionIndex < activeScenario.deployment.order.length - 1 ? "Confirm Deployment" : "Confirm Deployment & Start";
    }

    function cloneInitialUnits() {
      return (buildUnitsForActiveScenario()).map(normalizeUnitRuntimeState);
    }

    function selectDeploymentUnit(unitId) {
      if (phase !== "deployment") return;
      const unit = getUnit(unitId);
      const faction = currentDeploymentFaction();
      if (!unit || unit.faction !== faction) {
        setStatus(`Deploy ${activeScenario.factions[faction].name} first.`);
        return;
      }
      deploymentUnitId = deploymentUnitId === unitId ? null : unitId;
      if (deploymentUnitId) setStatus(`Place ${unit.name} inside the highlighted deployment zone.`, "Confirm when every position is valid.");
      else setStatus(`Select a ${activeScenario.factions[faction].name} unit to reposition.`);
      renderUnits();
    }

    function placeDeploymentUnit(point) {
      clearGhostPreview();
      const unit = getUnit(deploymentUnitId);
      if (!unit || phase !== "deployment") return;
      if (!pointInDeploymentZone(point, unit.faction)) {
        setStatus("That point is outside this faction's deployment zone.");
        return;
      }
      const destination = clampPoint(point);
      if (pointInsideRect(destination, expandRect(TERRAIN.building, RULES.unitCollisionRadius))) {
        setStatus("Cannot deploy inside the impassable building.");
        return;
      }
      const collision = analyzeDestinationCollision(unit, destination, null);
      if (collision.blocked) {
        setStatus("Cannot deploy there.", collision.reason);
        return;
      }
      unit.x = destination.x;
      unit.y = destination.y;
      addLog(`${activeScenario.factions[unit.faction].name} ${unit.name} deployed at ${unit.x.toFixed(1)}″, ${unit.y.toFixed(1)}″.`, "terrain");

      // A successful placement commits this unit's deployment position and
      // clears selection so the next click selects another unit rather than
      // accidentally moving the same unit again.
      deploymentUnitId = null;
      const faction = currentDeploymentFaction();
      setStatus(
        `${unit.name} placed.`,
        `Select the next ${activeScenario.factions[faction].name} unit, or confirm deployment when every position is valid.`
      );

      renderUnits();
      updateDeploymentProgress();
    }

    function startBattle() {
      if (phase !== "deployment") return;
      const faction = currentDeploymentFaction();
      if (!deploymentIsValidForFaction(faction)) {
        setStatus("Deployment cannot be confirmed yet.", "Move every unit into a legal, non-overlapping position.");
        return;
      }
      deploymentConfirmed.add(faction);
      deploymentUnitId = null;
      deploymentFactionIndex += 1;
      const nextFaction = currentDeploymentFaction();
      if (nextFaction) {
        setStatus(`${activeScenario.factions[nextFaction].name} now deploys.`);
        drawnDie.textContent = `Deploy ${activeScenario.factions[nextFaction].name}`;
        renderUnits();
        updateDeploymentProgress();
        return;
      }
      beginScenarioBattle();
    }

    function beginScenarioBattle() {
      clearGhostPreview();
      deploymentUnitId = null;
      fillBag();
      phase = "ready-to-draw";
      startBattleButton.hidden = true;
      drawButton.hidden = false;
      drawButton.disabled = false;
      drawnDie.textContent = "No die drawn";
      drawnDie.className = "drawn-die";
      setStatus("Press “Draw Order Die.”");
      battleHasBegun = true;
      showBattleAnnouncement("ROUND 1", activeScenario.title, "neutral", 1000);
      addLog(`Deployment complete. ${activeScenario.title} begins.`);
      renderUnits();
      updateDeploymentProgress();
    }

    // =========================================================================
    // SCENARIO STATUS, ROUND SCORING, VICTORY, AND RESTART
    // Keeps scenario presentation synchronized with authoritative battle state.
    // =========================================================================
    function updateScenarioUI() {
      blueScore.textContent = scores.blue;
      redScore.textContent = scores.red;
      roundReadout.textContent = `${round} / ${RULES.maxRounds}`;

      if (scenarioIsBreakthrough()) {
        const progress = breakthroughProgress();
        objectiveOwner.textContent = `${progress.exited} exited · ${progress.contained} contained`;
        objectiveLabel.hidden = true;
        objectiveRing.hidden = true;
        objectiveMarker.hidden = true;
        blueObjectiveDistance.textContent = `${scores.blue} containment`;
        redObjectiveDistance.textContent = `${progress.exited} exited`;
        document.body.classList.remove("objective-focus");
      } else {
        const state = objectiveState();
        objectiveOwner.textContent = {
          blue: `${activeScenario.factions.blue.name} controls`,
          red: `${activeScenario.factions.red.name} controls`,
          contested: "Contested",
          none: "Uncontrolled"
        }[state];

        const objective = scenarioObjective();
        objectiveLabel.hidden = false;
        objectiveRing.hidden = false;
        objectiveMarker.hidden = false;
        objectiveLabel.textContent = state === "blue"
          ? `${activeScenario.factions.blue.name.toUpperCase()} CONTROLS · ${objective.radius}″`
          : state === "red"
            ? `${activeScenario.factions.red.name.toUpperCase()} CONTROLS · ${objective.radius}″`
            : state === "contested"
              ? `CONTESTED · ${objective.radius}″`
              : `${objective.label.toUpperCase()} · ${objective.radius}″`;

        document.body.classList.toggle("objective-focus", phase === "round-complete" || phase === "plan-movement");
        const bd = nearestObjectiveDistance("blue");
        const rd = nearestObjectiveDistance("red");
        blueObjectiveDistance.textContent = bd === null ? "No units" : bd <= objective.radius ? "In range" : `${bd.toFixed(1)}″`;
        redObjectiveDistance.textContent = rd === null ? "No units" : rd <= objective.radius ? "In range" : `${rd.toFixed(1)}″`;
      }

      updateDeploymentProgress();
      updateTransactionBadge();
    }

    function scoreRoundAndContinue() {
      if (phase !== "round-complete" || battleEnded) return;
      clearActionOverlays();

      if (scenarioIsBreakthrough()) {
        if (round >= RULES.maxRounds) {
          finalizeContainmentScore();
          const result = breakthroughResult();
          finishBattle(result.message, {
            winner: result.winner,
            reason: result.reason,
            blueScore: scores.blue,
            redScore: scores.red
          });
          return;
        }

        round += 1;
        showBattleAnnouncement(`ROUND ${round}`, `${breakthroughProgress().exited} Red units exited`, "neutral", 1000);

        for (const unit of livingUnits()) {
          unit.activated = false;
          unit.order = null;
          unit.down = false;
          unit.ambush = false;
        }

        fillBag();
        phase = "ready-to-draw";
        nextRoundButton.disabled = true;
        drawButton.disabled = false;
        drawnDie.textContent = "No die drawn";
        drawnDie.className = "drawn-die";
        setStatus("Press “Draw Order Die.”", `${breakthroughProgress().exited} Red units have exited.`);
        addLog(`Round ${round} begins. The attackers continue toward the exit edge.`);
        renderUnits();
        return;
      }

      const state = objectiveState();
      const points = activeScenario.scoring.roundControl ?? 0;
      if (points > 0 && (state === "blue" || state === "red")) {
        scores[state] += points;
        if (battleStats) battleStats[state].objectiveRoundsControlled += 1;
        showBattleAnnouncement(
          `${activeScenario.factions[state].name.toUpperCase()} +${points}`,
          `Controls ${scenarioObjective().label}`,
          state,
          1100
        );
        addLog(`${activeScenario.factions[state].name} scores ${points} point${points === 1 ? "" : "s"} for controlling ${scenarioObjective().label}.`, "objective");
      } else if (state === "contested") {
        showBattleAnnouncement("NO SCORE", `${scenarioObjective().label} contested`, "neutral", 900);
        addLog(`${scenarioObjective().label} is contested. Neither side scores.`, "objective");
      } else if (points > 0) {
        showBattleAnnouncement("NO SCORE", `${scenarioObjective().label} uncontrolled`, "neutral", 900);
        addLog(`${scenarioObjective().label} is uncontrolled. Neither side scores.`, "objective");
      } else {
        addLog("This scenario has no round-by-round objective scoring.", "objective");
      }
      updateScenarioUI();
      if (round >= RULES.maxRounds) {
        endBattleByScore();
        return;
      }
      round += 1;
      showBattleAnnouncement(
        `ROUND ${round}`,
        `${activeScenario.factions.blue.name} ${scores.blue} — ${scores.red} ${activeScenario.factions.red.name}`,
        "neutral",
        1000
      );
      for (const unit of livingUnits()) {
        unit.activated = false;
        unit.order = null;
        unit.down = false;

        // Defensive fallback for saves or unusual state transitions.
        if (unit.ambush) {
          addLog(`${capitalize(unit.faction)} ${unit.name}'s unused Ambush expires.`, "ambush");
          unit.ambush = false;
        }
      }
      fillBag();
      phase = "ready-to-draw";
      nextRoundButton.disabled = true;
      drawButton.disabled = false;
      drawnDie.textContent = "No die drawn";
      drawnDie.className = "drawn-die";
      setStatus("Press “Draw Order Die.”");
      addLog(`Round ${round} begins. Down and unused Ambush markers clear; the bag is refilled.`);
      renderUnits();
    }

    function applyFinalScenarioScoring() {
      if (finalScenarioScored) return;
      finalScenarioScored = true;
      if (scenarioIsBreakthrough()) {
        finalizeContainmentScore();
        return;
      }
      const bonus = activeScenario.scoring.finalControl ?? 0;
      const state = objectiveState();
      if (bonus > 0 && (state === "blue" || state === "red")) {
        scores[state] += bonus;
        if (battleStats) battleStats[state].finalObjectiveControl += 1;
        addLog(`${activeScenario.factions[state].name} receives ${bonus} final point${bonus === 1 ? "" : "s"} for controlling ${scenarioObjective().label}.`, "objective");
      }
    }

    function endBattleByScore() {
      applyFinalScenarioScoring();
      if (scenarioIsBreakthrough()) {
        const result = breakthroughResult();
        finishBattle(result.message, { winner: result.winner, reason: result.reason, blueScore: scores.blue, redScore: scores.red });
        return;
      }
      let message;
      let winner = null;
      let reason = "score";
      if (scores.blue > scores.red) {
        winner = "blue";
        message = `${activeScenario.factions.blue.name} wins ${scores.blue}–${scores.red}.`;
      } else if (scores.red > scores.blue) {
        winner = "red";
        message = `${activeScenario.factions.red.name} wins ${scores.red}–${scores.blue}.`;
      } else {
        const metric = activeScenario.victory.tiebreaker;
        const blueMetric = metric === "survivingSoldiers" ? livingUnits().filter(u => u.faction === "blue").reduce((n,u)=>n+u.soldiers,0) : livingUnits().filter(u => u.faction === "blue").length;
        const redMetric = metric === "survivingSoldiers" ? livingUnits().filter(u => u.faction === "red").reduce((n,u)=>n+u.soldiers,0) : livingUnits().filter(u => u.faction === "red").length;
        if (blueMetric > redMetric) {
          winner = "blue";
          reason = "tiebreak";
          message = `Score tied ${scores.blue}–${scores.red}; ${activeScenario.factions.blue.name} wins the ${metric === "survivingSoldiers" ? "surviving-soldiers" : "surviving-units"} tiebreak ${blueMetric}–${redMetric}.`;
        } else if (redMetric > blueMetric) {
          winner = "red";
          reason = "tiebreak";
          message = `Score tied ${scores.blue}–${scores.red}; ${activeScenario.factions.red.name} wins the ${metric === "survivingSoldiers" ? "surviving-soldiers" : "surviving-units"} tiebreak ${redMetric}–${blueMetric}.`;
        } else {
          reason = "draw";
          message = `The battle is a draw: ${scores.blue}–${scores.red}, with the tiebreak also even.`;
        }
      }
      finishBattle(message, { winner, reason, blueScore: scores.blue, redScore: scores.red });
    }

    function endBattleByElimination() {
      if (!activeScenario.victory.elimination) return;
      const blueAlive = livingUnits().some(unit => unit.faction === "blue");
      const redAlive = livingUnits().some(unit => unit.faction === "red");
      const winner = blueAlive ? "blue" : redAlive ? "red" : null;
      const message = winner ? `${activeScenario.factions[winner].name} wins by eliminating every opposing unit.` : "Both forces were eliminated.";
      finishBattle(message, { winner, reason: winner ? "elimination" : "draw", blueScore: scores.blue, redScore: scores.red });
    }


    function finishBattle(message, result = {}) {
      battleEnded = true;
      phase = "game-over";
      drawnDie.textContent = "Battle Over";
      drawnDie.className = "drawn-die";
      drawButton.disabled = true;
      nextRoundButton.disabled = true;
      cancelButton.disabled = true;
      finishAdvanceButton.hidden = true;
      clearWaypointButton.hidden = true;
      setOrderButtonsDisabled();
      clearTracePreview();
      clearRouteLines();
      setStatus(message, "Open the After-Action Report, inspect the battlefield, or restart the battle.");
      addLog(message, "objective");
      renderUnits();
      renderAfterActionReport(message, result);
      afterActionModal.hidden = false;
    }

    function restartBattle() {
      activeScenarioId = document.getElementById("scenarioSelect")?.value ?? activeScenarioId;
      activeScenario = SCENARIOS[activeScenarioId];
      applyScenarioDefinition();
      units = cloneInitialUnits();
      clearInvalidBuildingOccupancy();
      round = 1;
      scores = { blue: 0, red: 0 };
      bag = [];
      currentFaction = null;
      selectedUnitId = null;
      chosenOrder = null;
      clearActivationTransaction();
      battleEnded = false;
      movementWaypoint = null;
      pendingMovement = null;
      pendingReaction = null;
      deploymentUnitId = null;
      deploymentFactionIndex = 0;
      deploymentConfirmed = new Set();
      finalScenarioScored = false;
      battleResult = null;
      battleHasBegun = false;
      battleLogEntries = [];
      battleStats = createBattleStats();
      showReportButton.hidden = true;
      afterActionModal.hidden = true;
      reactionPanel.hidden = true;
      nextRoundButton.disabled = true;
      cancelButton.disabled = true;
      finishAdvanceButton.hidden = true;
      clearWaypointButton.hidden = true;
      setOrderButtonsDisabled();
      clearTracePreview();
      clearRouteLines();
      log.innerHTML = "";

      if (activeScenario.deployment.mode === "fixed") {
        phase = "ready-to-draw";
        fillBag();
        startBattleButton.hidden = true;
        drawButton.hidden = false;
        drawButton.disabled = false;
        drawnDie.textContent = "No die drawn";
        setStatus("Fixed deployment loaded. Press “Draw Order Die.”");
        addLog(`${activeScenario.title} loaded with fixed deployment.`);
      } else {
        phase = "deployment";
        startBattleButton.hidden = false;
        drawButton.hidden = true;
        drawButton.disabled = true;
        const faction = currentDeploymentFaction();
        drawnDie.textContent = `Deploy ${activeScenario.factions[faction].name}`;
        setStatus(`${activeScenario.factions[faction].name} deploys first.`, "Select and reposition units, then confirm deployment.");
        addLog(`${activeScenario.title} loaded. Player deployment begins.`, "terrain");
      }
      renderUnits();
      updateDeploymentProgress();
      showBriefing();
    }



    // =========================================================================
    // ORDER AVAILABILITY, GHOSTS, AND HOVER PREVIEWS
    // Explains legal actions before a player commits them.
    // =========================================================================
    let lastMovementPreview = null;

    function orderAvailability(unit, order) {
      if (!unit) return { available: false, reason: "No unit selected." };
      if (unit.inBuilding && ["Run", "Advance", "Assault"].includes(order)) {
        return {
          available: false,
          reason: "Exit the farmhouse before moving or assaulting."
        };
      }
      if (order === "Rally" && unit.pins === 0) return { available: false, reason: "Unit has no Pins." };
      if (isMMGTeam(unit)) {
        if (unit.soldiers < MMG_RULES.reducedCrew && ["Fire", "Ambush"].includes(order)) {
          return { available: false, reason: "The MMG requires at least 2 surviving crew to fire." };
        }
        if (order === "Fire" && !unit.mmgDeployed) {
          return { available: true, reason: "Use this activation to deploy the fixed MMG." };
        }
        if (order === "Ambush" && !unit.mmgDeployed) {
          return { available: false, reason: "Deploy the MMG before setting Ambush." };
        }
      }
      if (order === "Ambush" && availableFireGroups(unit, Infinity, false, false).length === 0) return { available: false, reason: "Unit has no weapon capable of firing." };
      if (order === "Fire" && availableFireGroups(unit, Infinity, false, false).length === 0) return { available: false, reason: "Unit has no surviving ranged weapon." };
      if (order === "Assault") {
        const reachable = livingUnits().some(enemy => enemy.faction !== unit.faction && analyzeAssault(unit, enemy).legal);
        if (!reachable) return { available: false, reason: "No enemy can be reached by a legal 12″ charge." };
      }
      return { available: true, reason: "Available." };
    }

    const ORDER_COMMAND_LABELS = Object.freeze({
      Run: Object.freeze({ desktop: "Run · 12″", mobile: "Run" }),
      Advance: Object.freeze({ desktop: "Advance · 6″", mobile: "Adv" }),
      Fire: Object.freeze({ desktop: "Fire", mobile: "Fire" }),
      Down: Object.freeze({ desktop: "Down", mobile: "Down" }),
      Ambush: Object.freeze({ desktop: "Ambush", mobile: "Amb" }),
      Assault: Object.freeze({ desktop: "Assault · 12″", mobile: "Charge" }),
      Rally: Object.freeze({ desktop: "Rally · Clear Pins", mobile: "Rally" })
    });

    function orderCommand(unit, order, presentation = "desktop") {
      const availability = orderAvailability(unit, order);
      const labels = ORDER_COMMAND_LABELS[order] ?? Object.freeze({
        desktop: order,
        mobile: order
      });

      const commandLabel =
        isMMGTeam(unit) && order === "Fire" && !unit.mmgDeployed
          ? "Deploy MMG"
          : labels[presentation] ?? labels.desktop;

      return window.CrossroadsCommands.makeCommand({
        id: `order-${order.toLowerCase()}`,
        label: commandLabel,
        enabled: availability.available,
        execute: () => chooseOrder(order),
        reason: availability.reason,
        meta: {
          order,
          presentation,
          title: availability.available
            ? `${order} is available.`
            : `${order} unavailable — ${availability.reason}`
        }
      });
    }

    function availableOrderCommands(unit, orders, presentation = "mobile") {
      return orders
        .map(order => orderCommand(unit, order, presentation))
        .filter(command => command.enabled);
    }

    function setOrderButtonsFor(unit) {
      const reasonBox = DOM.orderReasons;
      const rows = [];

      for (const button of orderButtons) {
        const command = orderCommand(unit, button.dataset.order, "desktop");
        button.textContent = command.label;
        button.disabled = !command.enabled;
        button.title = command.meta.title;
        rows.push(
          `<div class="order-reason ${command.enabled ? "ok" : "no"}">` +
          `<strong>${command.meta.order}:</strong> ${command.reason}</div>`
        );
      }

      if (reasonBox) reasonBox.innerHTML = rows.join("");
    }

    function clearGhostPreview() {
      const ghost = document.getElementById("ghostToken");
      const dot = document.getElementById("ambushPreviewDot");

      lastMovementPreview = null;

      if (ghost) {
        ghost.hidden = true;
        ghost.textContent = "";
        ghost.style.removeProperty("left");
        ghost.style.removeProperty("top");
      }

      if (dot) {
        dot.hidden = true;
        dot.style.removeProperty("left");
        dot.style.removeProperty("top");
      }
    }

    function showGhost(point, state, text) {
      const ghost = document.getElementById("ghostToken");
      if (!ghost) return;
      const pos = tablePointToPixels(point);
      ghost.hidden = false;
      ghost.className = `ghost-token ${state === "blocked" ? "blocked" : state === "amber" ? "amber" : ""}`;
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.textContent = text;
    }

    function previewMovementAt(point) {
      if (phase !== "plan-movement" || !selectedUnitId || !chosenOrder) return;
      const unit = getUnit(selectedUnitId);
      if (!unit) return;
      const destination = clampPoint(point);
      const requestedPath = movementWaypoint ? [unit, movementWaypoint, destination] : [unit, destination];
      let analysis = analyzeMovementPath(unit, requestedPath, chosenOrder, null);
      let finalPath = requestedPath;
      let state = analysis.legal ? "legal" : "blocked";
      let note = analysis.reason;
      if (!analysis.legal && analysis.kind === "allowance") {
        const fitted = fitMovementPathToAllowance(unit, requestedPath, chosenOrder, null);
        if (fitted) {
          finalPath = fitted.path;
          analysis = fitted.analysis;
          state = "amber";
          note = "Destination will be shortened to the furthest affordable legal point.";
        }
      }
      const finalPoint = finalPath[finalPath.length - 1];
      showGhost(finalPoint, state, `${analysis.cost.toFixed(1)}″`);
      drawRoute(finalPath, state === "blocked");
      const remaining = Math.max(0, analysis.allowance - analysis.cost);
      const details = analysis.details?.length ? analysis.details.join(" · ") : "Open-ground movement.";
      setPreview(state === "blocked" ? "blocked" : state === "amber" ? "protected" : "legal", `${chosenOrder} movement preview`, `Cost ${analysis.cost.toFixed(1)}″ of ${analysis.allowance}″ · ${remaining.toFixed(1)}″ remaining.`, `${details} ${note ?? ""}`.trim());
      lastMovementPreview = { path: finalPath, analysis, state };

      const potential = FEATURES.ambush ? previewFirstAmbush(finalPath, unit) : null;
      const dot = document.getElementById("ambushPreviewDot");
      if (potential && dot) {
        const pos = tablePointToPixels(potential.triggerPoint);
        dot.hidden = false;
        dot.style.left = `${pos.x}px`;
        dot.style.top = `${pos.y}px`;
        dot.title = `${potential.ambusher.name} may interrupt here at ${potential.trace.distance.toFixed(1)}″.`;
      } else if (dot) dot.hidden = true;
    }

    function previewFirstAmbush(path, mover) {
      const ambushers = livingUnits().filter(unit => unit.faction !== mover.faction && unit.ambush);
      let best = null;
      const samples = samplePath(path, RULES.ambushSampleStep);
      for (const ambusher of ambushers) {
        for (const sample of samples) {
          const trace = analyzeShotAtPoint(ambusher, { ...sample.point, down: mover.down });
          if (trace.inRange && !trace.blocked) {
            const candidate = { ambusher, triggerPoint: sample.point, pathDistance: sample.pathDistance, trace };
            if (!best || candidate.pathDistance < best.pathDistance) best = candidate;
            break;
          }
        }
      }
      return best;
    }

    function previewDeploymentAt(point) {
      if (phase !== "deployment" || !deploymentUnitId) return;
      const unit = getUnit(deploymentUnitId);
      if (!unit) return;
      const destination = clampPoint(point);
      let legal = pointInDeploymentZone(destination, unit.faction);
      let reason = legal ? "Inside deployment zone." : "Outside deployment zone.";
      if (legal && pointInsideRect(destination, expandRect(TERRAIN.building, RULES.unitCollisionRadius))) {
        legal = false; reason = "Impassable building overlaps this position.";
      }
      if (legal) {
        const collision = analyzeDestinationCollision(unit, destination, null);
        if (collision.blocked) { legal = false; reason = collision.reason; }
      }
      showGhost(destination, legal ? "legal" : "blocked", legal ? "PLACE" : "NO");
      setPreview(legal ? "legal" : "blocked", `Deploy ${unit.name}`, `${destination.x.toFixed(1)}″, ${destination.y.toFixed(1)}″.`, reason);
    }

    function handleBattlefieldHover(point) {
      if (phase === "plan-movement") previewMovementAt(point);
      else if (phase === "deployment") previewDeploymentAt(point);
      else clearGhostPreview();
    }

    function updateTransactionBadge() {
      const el = document.getElementById("transactionBadge");
      if (!el) return;
      if (transactionLockReason) {
        el.className = "transaction-badge locked";
        el.innerHTML = `<strong>Action locked</strong><br>${transactionLockReason}`;
      } else if (["choose-order", "plan-movement", "choose-target", "choose-assault-target"].includes(phase) && selectedUnitId) {
        el.className = "transaction-badge";
        el.innerHTML = `<strong>Cancel available</strong><br>No dice or reaction has committed this action.`;
      } else {
        el.className = "transaction-badge";
        el.innerHTML = `<strong>No open transaction</strong><br>Select a unit after drawing an Order Die.`;
      }
    }

    function restoreStartingPositions() {
      const fresh = buildUnitsForActiveScenario();
      const map = new Map(fresh.map(unit => [unit.id, unit]));
      for (const unit of units) {
        const initial = map.get(unit.id);
        if (initial) { unit.x = initial.x; unit.y = initial.y; }
      }
      deploymentUnitId = null;
      addLog("Starting deployment positions restored.", "terrain");
      renderUnits();
    }

    function clearCurrentDeployment() {
      if (phase !== "deployment") return;
      const faction = currentDeploymentFaction();
      const zone = activeScenario.deployment.zones[faction];
      const factionUnits = livingUnits().filter(unit => unit.faction === faction);
      factionUnits.forEach((unit, index) => {
        unit.x = (zone.xMin + zone.xMax) / 2;
        unit.y = zone.yMin + 5 + index * Math.max(4, (zone.yMax - zone.yMin - 10) / Math.max(1, factionUnits.length - 1));
      });
      deploymentUnitId = null;
      addLog(`${activeScenario.factions[faction].name} deployment reset to a simple legal column.`, "terrain");
      renderUnits();
    }

    // =========================================================================
    // ADAPTIVE TOUCH UI AND CONTEXTUAL COMMAND TRAY
    // Mobile action rendering, confirmations, unit picking, and gestures.
    // =========================================================================
/* ===== Touch interaction and contextual command tray ===== */
    const mobileCommandTray = document.getElementById("mobileCommandTray");
    const mobileCommandSummary = document.getElementById("mobileCommandSummary");
    const mobileCommandActions = document.getElementById("mobileCommandActions");
    const mobileDetailDrawer = document.getElementById("mobileDetailDrawer");
    const mobileDrawerUnit = document.getElementById("mobileDrawerUnit");
    const mobileDrawerStatus = document.getElementById("mobileDrawerStatus");
    const mobileDrawerPreview = document.getElementById("mobileDrawerPreview");
    const mobileUnitPicker = document.getElementById("mobileUnitPicker");
    const mobileUnitPickerActions = document.getElementById("mobileUnitPickerActions");

    let pendingTouchMovement = null;
    let pendingTouchTargetId = null;
    let pendingTouchTargetKind = null;
    let pendingTouchDeploymentPoint = null;
    let touchWaypointArmed = false;
    let gestureSuppressUntil = 0;
    let adaptiveUpdateQueued = false;

    function adaptiveTouchActive() { return narrowBoardLayout(); }
    function gestureSuppressed() { return Date.now() < gestureSuppressUntil; }

    function queueAdaptiveUI() {
      if (adaptiveUpdateQueued) return;
      adaptiveUpdateQueued = true;
      requestAnimationFrame(() => {
        adaptiveUpdateQueued = false;
        updateAdaptiveUI();
      });
    }

    let mobileMoreOrdersOpen = false;
    let lastMobileTrayPhase = null;

    function addTrayAction(label, handler, options = {}) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = Boolean(options.disabled);
      if (options.className) button.className = options.className;
      if (options.title) button.title = options.title;
      button.addEventListener("click", handler);
      mobileCommandActions.appendChild(button);
      return button;
    }

    function addTrayCommand(command) {
      if (!command) throw new Error("Tray command is required.");
      return addTrayAction(command.label, command.execute ?? (() => {}), {
        disabled: !command.enabled,
        className: command.meta.className ?? "",
        title: command.reason || command.meta.title || ""
      });
    }

    function mobileDetailsCommand(options = {}) {
      return window.CrossroadsCommands.makeCommand({
        id: "mobile-details",
        label: "Details",
        enabled: true,
        execute: toggleMobileDetails,
        reason: "Open the current unit, status, and preview details.",
        meta: {
          className: options.className ?? ""
        }
      });
    }

    function trayPhaseTitle() {
      const selected = getUnit(selectedUnitId);
      if (phase === "deployment") return deploymentUnitId ? `Deploy ${getUnit(deploymentUnitId)?.name ?? "unit"}` : "Deployment";
      if (phase === "ready-to-draw") return `Round ${round} · Ready`;
      if (phase === "choose-unit") return `${capitalize(currentFaction ?? "")} die · Choose unit`;
      if (phase === "choose-order") return selected ? selected.name : "Choose order";
      if (phase === "plan-movement") return `${chosenOrder} · ${selected?.name ?? "unit"}`;
      if (phase === "choose-target") return `Target · ${selected?.name ?? "unit"}`;
      if (phase === "choose-assault-target") return `Assault · ${selected?.name ?? "unit"}`;
      if (phase === "ambush-reaction") return "Ambush reaction";
      if (phase === "round-complete") return `Round ${round} complete`;
      if (phase === "game-over") return "Battle over";
      return "Infantry Core";
    }

    function updateCameraHud() {
      if (!cameraHudRound || !cameraHudScore || !cameraHudDie) return;
      cameraHudRound.textContent = `R${round}`;
      cameraHudScore.textContent =
        `${activeScenario.factions.blue.name} ${scores.blue}–${scores.red} ${activeScenario.factions.red.name}`;

      cameraHudDie.textContent =
        phase === "choose-unit" && currentFaction
          ? `${capitalize(currentFaction)} die`
          : phase === "round-complete"
            ? "Round complete"
            : phase === "deployment"
              ? "Deploy"
              : phase === "game-over"
                ? "Battle over"
                : drawnDie.textContent === "No die drawn"
                  ? "Ready"
                  : drawnDie.textContent;
    }

    function updateAdaptiveUI() {
      const active = adaptiveTouchActive();

      if (lastMobileTrayPhase !== phase) {
        mobileMoreOrdersOpen = false;
        lastMobileTrayPhase = phase;
      }

      updateCameraHud();
      document.body.classList.toggle("adaptive-touch", active);
      if (!mobileCommandTray) return;
      mobileCommandTray.setAttribute("aria-hidden", String(!active));
      if (!active) return;

      const selected = getUnit(selectedUnitId);
      mobileCommandSummary.innerHTML = `<strong>${trayPhaseTitle()}</strong><span>${activeScenario.factions.blue.name} ${scores.blue}–${scores.red} ${activeScenario.factions.red.name}</span>`;
      mobileCommandActions.replaceChildren();

      if (phase === "deployment") {
        if (deploymentUnitId) {
          addTrayAction(touchWaypointArmed ? "Tap board" : "Preview placement", () => {}, { disabled: true });
          addTrayAction("Confirm Place", confirmPendingTouchDeployment, { disabled: !pendingTouchDeploymentPoint, className: "tray-confirm tray-wide" });
        } else {
          addTrayAction("Select a unit on the table", () => {}, { disabled: true, className: "tray-wide" });
        }
        addTrayAction(startBattleButton.textContent || "Confirm Deployment", () => startBattleButton.click(), { disabled: startBattleButton.disabled, className: "tray-confirm" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "ready-to-draw") {
        addTrayAction("Draw Die", drawDie, { className: "tray-confirm tray-wide" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "choose-unit") {
        addTrayAction(`Choose an unused ${capitalize(currentFaction ?? "")} unit`, () => {}, { disabled: true, className: "tray-wide" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "choose-order" && selected) {
        const structureCommand = buildingCommand(selected, "mobile");
        if (structureCommand.enabled) addTrayCommand(structureCommand);

        if (isMMGTeam(selected) && selected.mmgDeployed) {
          addTrayAction("Face ◀", () => rotateMMGFacing(selected, -MMG_RULES.facingStep), {
            title: "Rotate the MMG field of fire 45° left."
          });
          addTrayAction("Face ▶", () => rotateMMGFacing(selected, MMG_RULES.facingStep), {
            title: "Rotate the MMG field of fire 45° right."
          });
        }

        const primaryOrders = ["Run", "Advance", "Fire", "Assault"]
          .filter(order => order !== "Assault" || FEATURES.assault);
        const secondaryOrders = ["Down", "Ambush", "Rally"]
          .filter(order => order !== "Ambush" || FEATURES.ambush);

        if (!mobileMoreOrdersOpen) {
          for (const command of availableOrderCommands(selected, primaryOrders)) {
            addTrayCommand(command);
          }

          const hasSecondary =
            availableOrderCommands(selected, secondaryOrders).length > 0;

          if (hasSecondary) {
            addTrayAction("More", () => {
              mobileMoreOrdersOpen = true;
              updateAdaptiveUI();
            });
          }

          addTrayAction("Back", cancelAndReselect, {
            disabled: Boolean(transactionLockReason),
            className: "tray-danger"
          });
        } else {
          for (const command of availableOrderCommands(selected, secondaryOrders)) {
            addTrayCommand(command);
          }

          addTrayAction("Main", () => {
            mobileMoreOrdersOpen = false;
            updateAdaptiveUI();
          });

          addTrayAction("Back", cancelAndReselect, {
            disabled: Boolean(transactionLockReason),
            className: "tray-danger"
          });
        }
      } else if (phase === "plan-movement") {
        addTrayAction(movementWaypoint ? "Clear Waypoint" : touchWaypointArmed ? "Waypoint Armed" : "Add Waypoint", () => {
          if (movementWaypoint) clearWaypoint();
          else { touchWaypointArmed = !touchWaypointArmed; setStatus(touchWaypointArmed ? "Tap the battlefield to place a waypoint." : "Waypoint mode cancelled."); queueAdaptiveUI(); }
        });
        addTrayAction("Confirm", confirmPendingTouchMovement, { disabled: !pendingTouchMovement || pendingTouchMovement.state === "blocked", className: "tray-confirm tray-wide" });
        addTrayAction("Cancel", cancelAndReselect, { disabled: Boolean(transactionLockReason), className: "tray-danger" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "choose-target") {
        addTrayAction(pendingTouchTargetId ? "Confirm Fire" : "Tap enemy", confirmPendingTouchTarget, { disabled: !pendingTouchTargetId, className: "tray-confirm tray-wide" });
        if (chosenOrder === "Advance") {
          addTrayAction("Finish Without Fire", finishAdvanceWithoutShooting);
          addTrayAction("Retarget", clearPendingTouchTarget, { disabled: !pendingTouchTargetId });
          addTrayAction("Cancel Activation", cancelAndReselect, { disabled: Boolean(transactionLockReason), className: "tray-danger" });
        } else {
          addTrayAction("Retarget", clearPendingTouchTarget, { disabled: !pendingTouchTargetId });
          addTrayAction("Orders", backToOrdersFromFire, { disabled: Boolean(transactionLockReason) });
          addTrayAction("Reselect", cancelAndReselect, { disabled: Boolean(transactionLockReason), className: "tray-danger" });
        }
      } else if (phase === "choose-assault-target") {
        addTrayAction(pendingTouchTargetId ? "Confirm Assault" : "Tap enemy", confirmPendingTouchTarget, { disabled: !pendingTouchTargetId, className: "tray-confirm tray-wide" });
        addTrayAction("Retarget", clearPendingTouchTarget, { disabled: !pendingTouchTargetId });
        addTrayAction("Cancel", cancelAndReselect, { disabled: Boolean(transactionLockReason), className: "tray-danger" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "ambush-reaction") {
        addTrayAction("Fire Ambush", resolveAmbushFire, { className: "tray-ambush tray-wide" });
        addTrayAction("Hold Fire", holdAmbushFire);
      } else if (phase === "round-complete") {
        addTrayAction("Continue", scoreRoundAndContinue, { className: "tray-confirm tray-wide" });
        addTrayCommand(mobileDetailsCommand());
      } else if (phase === "game-over") {
        addTrayAction("Report", showAfterActionReport, { className: "tray-confirm tray-wide" });
        addTrayAction("Restart", restartBattle);
      } else {
        addTrayCommand(mobileDetailsCommand({ className: "tray-full" }));
      }

      const unitText = selected
        ? `<strong>${selected.name}</strong><br>${fullLoadout(selected)} · ${selected.soldiers}/${selected.maxSoldiers} soldiers · P${selected.pins}`
        : deploymentUnitId
          ? `<strong>${getUnit(deploymentUnitId)?.name ?? "Deployment unit"}</strong>`
          : "No unit selected.";
      mobileDrawerUnit.innerHTML = unitText;
      mobileDrawerStatus.innerHTML = statusPanel.innerHTML;
      mobileDrawerPreview.innerHTML = previewCard.innerHTML;
    }

    function toggleMobileDetails() {
      mobileDetailDrawer.hidden = !mobileDetailDrawer.hidden;
      if (!mobileDetailDrawer.hidden) updateAdaptiveUI();
    }

    function clearPendingTouchTarget() {
      pendingTouchTargetId = null;
      pendingTouchTargetKind = null;
      clearTracePreview();
      renderUnits();
    }

    function selectTouchTarget(targetId, kind) {
      const actor = getUnit(selectedUnitId);
      const target = getUnit(targetId);
      if (!actor || !target || actor.faction === target.faction) return;
      pendingTouchTargetId = targetId;
      pendingTouchTargetKind = kind;
      if (kind === "fire") showShotPreview(actor, target);
      else showAssaultPreview(actor, target);
      renderUnits();
      queueAdaptiveUI();
    }

    function confirmPendingTouchTarget() {
      if (!pendingTouchTargetId) return;
      const id = pendingTouchTargetId;
      const kind = pendingTouchTargetKind;
      pendingTouchTargetId = null;
      pendingTouchTargetKind = null;
      if (kind === "assault") chooseAssaultTarget(id);
      else chooseTarget(id);
      queueAdaptiveUI();
    }

    function confirmPendingTouchMovement() {
      if (!pendingTouchMovement || pendingTouchMovement.state === "blocked") return;
      const unit = getUnit(selectedUnitId);
      if (!unit) return;

      const movement = pendingTouchMovement;

      // Remove every planning overlay before movement resolution starts.
      // This prevents a committed movement ghost from surviving while Ambush
      // checks or activation cleanup run.
      pendingTouchMovement = null;
      lastMovementPreview = null;
      clearGhostPreview();
      clearRouteLines();
      waypointMarker.hidden = true;
      rangeRing.hidden = true;
      overlayMode = null;
      battlefield.classList.remove("movement-mode");

      beginMovement(unit, movement.path, movement.analysis);
      queueAdaptiveUI();
    }

    function confirmPendingTouchDeployment() {
      if (!pendingTouchDeploymentPoint) return;
      const point = pendingTouchDeploymentPoint;
      pendingTouchDeploymentPoint = null;
      placeDeploymentUnit(point);
      queueAdaptiveUI();
    }

    function analyzeDeploymentPoint(point) {
      const unit = getUnit(deploymentUnitId);
      if (!unit) return { legal: false, reason: "Select a unit first.", destination: point };
      const destination = clampPoint(point);
      let legal = pointInDeploymentZone(destination, unit.faction);
      let reason = legal ? "Inside deployment zone." : "Outside deployment zone.";
      if (legal && pointInsideRect(destination, expandRect(TERRAIN.building, RULES.unitCollisionRadius))) { legal = false; reason = "Impassable building overlaps this position."; }
      if (legal) {
        const collision = analyzeDestinationCollision(unit, destination, null);
        if (collision.blocked) { legal = false; reason = collision.reason; }
      }
      return { legal, reason, destination };
    }

    function handleAdaptiveBattlefieldTap(point) {
      if (phase === "deployment") {
        if (!deploymentUnitId) return false;
        const result = analyzeDeploymentPoint(point);
        pendingTouchDeploymentPoint = result.legal ? result.destination : null;
        previewDeploymentAt(point);
        queueAdaptiveUI();
        return true;
      }

      if (phase === "plan-movement") {
        const unit = getUnit(selectedUnitId);
        if (!unit) return false;
        if (touchWaypointArmed && !movementWaypoint) {
          const waypoint = clampPoint(point);
          const analysis = analyzeMovementPath(unit, [unit, waypoint], chosenOrder, null);
          if (!analysis.legal) { rejectMovement(analysis, [unit, waypoint]); return true; }
          movementWaypoint = waypoint;
          touchWaypointArmed = false;
          clearWaypointButton.hidden = false;
          pendingTouchMovement = null;
          setStatus("Waypoint placed. Tap the final destination.", `${analysis.cost.toFixed(1)}″ spent; ${(analysis.allowance - analysis.cost).toFixed(1)}″ remains.`);
          renderUnits();
          return true;
        }
        previewMovementAt(point);
        pendingTouchMovement = lastMovementPreview ? {
          path: lastMovementPreview.path.map(p => ({ x: p.x, y: p.y })),
          analysis: lastMovementPreview.analysis,
          state: lastMovementPreview.state
        } : null;
        queueAdaptiveUI();
        return true;
      }
      return false;
    }

    function installLongPress(el, unit) {
      let timer = null;
      let longPressed = false;
      const start = event => {
        if (!adaptiveTouchActive()) return;
        longPressed = false;
        timer = setTimeout(() => {
          longPressed = true;
          if (phase === "choose-target" && unit.faction !== getUnit(selectedUnitId)?.faction) showShotPreview(getUnit(selectedUnitId), unit);
          else if (phase === "choose-assault-target" && unit.faction !== getUnit(selectedUnitId)?.faction) showAssaultPreview(getUnit(selectedUnitId), unit);
          else showUnitPreview(unit);
          mobileDetailDrawer.hidden = false;
          updateAdaptiveUI();
          if (navigator.vibrate) navigator.vibrate(18);
        }, 520);
      };
      const end = () => { if (timer) clearTimeout(timer); timer = null; if (longPressed) gestureSuppressUntil = Date.now() + 350; };
      el.addEventListener("pointerdown", start);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("pointerleave", end);
    }

    function nearbyUnits(unit) {
      return livingUnits().filter(other => distanceBetweenPoints(unit, other) <= 2.8);
    }

    function openUnitPicker(unitsToPick, handler) {
      mobileUnitPickerActions.replaceChildren();
      for (const unit of unitsToPick) addPickerButton(unit, handler);
      mobileUnitPicker.hidden = false;
    }

    function addPickerButton(unit, handler) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${activeScenario.factions[unit.faction].name} · ${unit.name} · ${unit.soldiers} men`;
      button.addEventListener("click", () => { mobileUnitPicker.hidden = true; handler(unit.id); });
      mobileUnitPickerActions.appendChild(button);
    }

    function handleAdaptiveUnitTap(unitId) {
      if (gestureSuppressed()) return;
      const unit = getUnit(unitId);
      if (!unit) return;
      const closeUnits = nearbyUnits(unit);
      const action = id => {
        if (phase === "deployment") selectDeploymentUnit(id);
        else if (phase === "choose-target") selectTouchTarget(id, "fire");
        else if (phase === "choose-assault-target") selectTouchTarget(id, "assault");
        else selectUnit(id);
      };
      if (closeUnits.length > 1) openUnitPicker(closeUnits, action);
      else action(unitId);
    }

    // Continuous one-finger pan, two-finger pinch, and double-tap zoom.
    const activePointers = new Map();
    let panGesture = null;
    let pinchGesture = null;
    let lastCameraTap = { time: 0, x: 0, y: 0 };

    function pointerMidpoint(points) {
      return {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      };
    }

    battlefieldViewport.addEventListener("pointerdown", event => {
      if (!adaptiveTouchActive() || event.pointerType === "mouse") return;

      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });

      battlefieldViewport.setPointerCapture?.(event.pointerId);

      if (activePointers.size === 1) {
        panGesture = {
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: battlefieldViewport.scrollLeft,
          scrollTop: battlefieldViewport.scrollTop,
          moved: false
        };
      }

      if (activePointers.size === 2) {
        const points = [...activePointers.values()];
        const midpoint = pointerMidpoint(points);
        const distance = Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y
        );
        const viewportPoint = cameraPointFromClient(midpoint.x, midpoint.y);

        pinchGesture = {
          startDistance: Math.max(1, distance),
          startZoom: boardZoom,
          worldFocusX:
            (battlefieldViewport.scrollLeft + viewportPoint.x) /
            Math.max(1, battlefieldSurface.offsetWidth),
          worldFocusY:
            (battlefieldViewport.scrollTop + viewportPoint.y) /
            Math.max(1, battlefieldSurface.offsetHeight),
          moved: false
        };

        panGesture = null;
      }
    });

    battlefieldViewport.addEventListener("pointermove", event => {
      if (!activePointers.has(event.pointerId)) return;

      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });

      if (activePointers.size >= 2 && pinchGesture) {
        const points = [...activePointers.values()];
        const midpoint = pointerMidpoint(points);
        const viewportPoint = cameraPointFromClient(midpoint.x, midpoint.y);
        const distance = Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y
        );

        if (Math.abs(distance - pinchGesture.startDistance) > 3) {
          pinchGesture.moved = true;
          document.body.classList.add("camera-panning");
        }

        boardZoom = clamp(
          pinchGesture.startZoom *
            distance /
            pinchGesture.startDistance,
          CAMERA_MIN_SCALE,
          CAMERA_MAX_SCALE
        );

        applyCameraSurfaceSize();

        battlefieldViewport.scrollLeft =
          pinchGesture.worldFocusX * battlefieldSurface.offsetWidth -
          viewportPoint.x;
        battlefieldViewport.scrollTop =
          pinchGesture.worldFocusY * battlefieldSurface.offsetHeight -
          viewportPoint.y;

        event.preventDefault();
        return;
      }

      if (
        activePointers.size === 1 &&
        panGesture &&
        cameraCanPan()
      ) {
        const dx = event.clientX - panGesture.startX;
        const dy = event.clientY - panGesture.startY;

        if (Math.hypot(dx, dy) > 5) {
          panGesture.moved = true;
          document.body.classList.add("camera-panning");
        }

        if (panGesture.moved) {
          battlefieldViewport.scrollLeft =
            panGesture.scrollLeft - dx;
          battlefieldViewport.scrollTop =
            panGesture.scrollTop - dy;
          event.preventDefault();
        }
      }
    }, { passive: false });

    function endAdaptivePointer(event) {
      const pointer = activePointers.get(event.pointerId);
      const moved = Boolean(
        panGesture?.moved ||
        pinchGesture?.moved
      );

      activePointers.delete(event.pointerId);

      if (moved) {
        gestureSuppressUntil = Date.now() + 320;
      } else if (
        pointer &&
        activePointers.size === 0 &&
        event.pointerType !== "mouse"
      ) {
        const now = Date.now();
        const nearLastTap =
          now - lastCameraTap.time < 310 &&
          Math.hypot(
            event.clientX - lastCameraTap.x,
            event.clientY - lastCameraTap.y
          ) < 34;

        if (nearLastTap) {
          const viewportPoint = cameraPointFromClient(
            event.clientX,
            event.clientY
          );
          const targetZoom =
            boardZoom < Math.max(1.05, fittedBoardZoom * 1.8)
              ? Math.max(1.05, fittedBoardZoom * 2.1)
              : fittedBoardZoom;
          setBoardZoom(targetZoom, { viewportPoint });
          gestureSuppressUntil = Date.now() + 360;
          lastCameraTap = { time: 0, x: 0, y: 0 };
        } else {
          lastCameraTap = {
            time: now,
            x: event.clientX,
            y: event.clientY
          };
        }
      }

      if (activePointers.size < 2) pinchGesture = null;
      if (activePointers.size === 0) {
        panGesture = null;
        document.body.classList.remove("camera-panning");
      } else if (activePointers.size === 1) {
        const remaining = [...activePointers.values()][0];
        panGesture = {
          startX: remaining.x,
          startY: remaining.y,
          scrollLeft: battlefieldViewport.scrollLeft,
          scrollTop: battlefieldViewport.scrollTop,
          moved: false
        };
      }
    }

    battlefieldViewport.addEventListener("pointerup", endAdaptivePointer);
    battlefieldViewport.addEventListener("pointercancel", endAdaptivePointer);
    battlefieldViewport.addEventListener("lostpointercapture", event => {
      if (activePointers.has(event.pointerId)) endAdaptivePointer(event);
    });

    document.getElementById("mobileDrawerCloseButton").addEventListener("click", () => { mobileDetailDrawer.hidden = true; });
    document.getElementById("mobileBriefingButton").addEventListener("click", showBriefing);
    document.getElementById("mobileLogButton").addEventListener("click", () => {
      mobileDetailDrawer.hidden = true;
      log.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("mobileUnitPickerClose").addEventListener("click", () => { mobileUnitPicker.hidden = true; });

/* ===== Orientation and viewport preservation ===== */
    // =========================================================================
    // RESPONSIVE VIEWPORT AND MODAL PRESERVATION
    // Preserves camera state across layout and orientation changes.
    // =========================================================================
    let lastViewportState = null;
    function captureViewportState() {
      if (!battlefieldViewport || !battlefieldSurface) return null;
      return {
        zoom: boardZoom,
        x: (battlefieldViewport.scrollLeft + battlefieldViewport.clientWidth / 2) / Math.max(1, battlefieldSurface.scrollWidth),
        y: (battlefieldViewport.scrollTop + battlefieldViewport.clientHeight / 2) / Math.max(1, battlefieldSurface.scrollHeight)
      };
    }

    function restoreViewportState(state) {
      if (!state || !battlefieldViewport || !battlefieldSurface) return;
      boardZoom = clamp(state.zoom, CAMERA_MIN_SCALE, CAMERA_MAX_SCALE);
      applyCameraSurfaceSize();
      requestAnimationFrame(() => {
        battlefieldViewport.scrollLeft = state.x * battlefieldSurface.scrollWidth - battlefieldViewport.clientWidth / 2;
        battlefieldViewport.scrollTop = state.y * battlefieldSurface.scrollHeight - battlefieldViewport.clientHeight / 2;
      });
    }

    window.addEventListener("orientationchange", () => {
      lastViewportState = captureViewportState();
      setTimeout(() => {
        syncAutomaticCameraRotation();
        applyCameraSurfaceSize();
        restoreViewportState(lastViewportState);
        updateAdaptiveUI();
      }, 180);
    });

/* ===== Responsive briefing and report sections ===== */
    function configureResponsiveModalSections(root, collapseMost = true) {
      if (!root) return;
      const sections = root.querySelectorAll(".brief-box, .aar-box");
      sections.forEach((section, index) => {
        section.classList.add("responsive-section");
        if (section.dataset.responsiveReady === "1") return;
        section.dataset.responsiveReady = "1";
        const heading = section.querySelector("h3");
        if (!heading) return;
        heading.setAttribute("role", "button");
        heading.tabIndex = 0;
        const toggle = () => {
          if (!window.matchMedia("(max-width: 720px)").matches) return;
          section.classList.toggle("responsive-collapsed");
        };
        heading.addEventListener("click", toggle);
        heading.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
        if (collapseMost && index > 0 && window.matchMedia("(max-width: 720px)").matches) section.classList.add("responsive-collapsed");
      });
    }


    // =========================================================================
    // PUBLIC ENGINE API
    // Stable integration surface for diagnostics and future modular extraction.
    // =========================================================================
    const InfantryCore = Object.freeze({
      data: Object.freeze({ weapons: WEAPON_PROFILES, unitTypes: UNIT_TYPES, scenarios: SCENARIOS }),
      state: Object.freeze({
        get phase() { return phase; },
        get round() { return round; },
        get units() { return units; },
        get scores() { return { ...scores }; },
        get statistics() { return battleStats; },
        get result() { return battleResult; }
      }),
      geometry: Object.freeze({ distanceBetweenPoints, segmentRectClip, analyzeMovementPath, analyzeShot, analyzeAssault }),
      rules: Object.freeze({ attemptOrder, resolveShootingCore, resolveCloseCombat, beginMovement }),
      scenario: Object.freeze({ scenarios: SCENARIOS, applyScenarioDefinition, buildUnitsForActiveScenario, objectiveState, scoreRoundAndContinue }),
      ui: Object.freeze({ renderUnits, setStatus, setPreview, addLog, previewMovementAt, previewDeploymentAt, orderAvailability })
    });
    window.InfantryCore = InfantryCore;


    briefingBeginButton.addEventListener("click", () => {
      hideBriefing();
      requestAnimationFrame(() => {
      syncCameraViewportBox();
      requestAnimationFrame(() => {
        syncAutomaticCameraRotation();
        fittedBoardZoom = calculateFitZoom();
        fitTable();
        renderUnits();
      });
    });
      if (activeScenario.deployment.mode === "fixed") {
        battleHasBegun = true;
        setStatus("Fixed deployment loaded. Press “Draw Order Die.”");
      }
    });
    briefingCloseButton.addEventListener("click", () => {
      hideBriefing();
      document.body.classList.add("menu-open");
      document.getElementById("scenarioMenuOverlay").hidden = false;
    });
    showBriefingButton.addEventListener("click", showBriefing);
    showReportButton.addEventListener("click", showAfterActionReport);
    copyLogButton.addEventListener("click", copyBattleLog);
    aarCloseButton.addEventListener("click", () => { afterActionModal.hidden = true; });
    aarRestartButton.addEventListener("click", () => { afterActionModal.hidden = true; restartBattle(); });

    startBattleButton.addEventListener("click", startBattle);
    drawButton.addEventListener("click", drawDie);
    nextRoundButton.addEventListener("click", scoreRoundAndContinue);
    restartButton.addEventListener("click", restartBattle);
    cancelButton.addEventListener("click", handleCancelAction);
    finishAdvanceButton.addEventListener("click", finishAdvanceWithoutShooting);
    clearWaypointButton.addEventListener("click", clearWaypoint);
    reactionPrimaryButton.addEventListener("click", resolveAmbushFire);
    reactionSecondaryButton.addEventListener("click", holdAmbushFire);
    battlefield.addEventListener("click", handleBattlefieldClick);

    battlefield.addEventListener("mousemove", event => {
      const point = eventToTablePoint(event);
      cursorReadout.textContent = `Cursor: ${point.x.toFixed(1)}″, ${point.y.toFixed(1)}″`;
      handleBattlefieldHover(point);
    });

    battlefield.addEventListener("mouseleave", () => { cursorReadout.textContent = "Cursor: —"; clearGhostPreview(); });

    for (const button of orderButtons) button.addEventListener("click", () => chooseOrder(button.dataset.order));

    window.addEventListener("resize", () => {
      const preservedView = captureViewportState();
      const oldFit = fittedBoardZoom || calculateFitZoom();
      syncCameraViewportBox();
      const relativeZoom = oldFit > 0 ? boardZoom / oldFit : 1;

      createRulerLabels();
      clearTracePreview();
      syncAutomaticCameraRotation();

      requestAnimationFrame(() => {
        fittedBoardZoom = calculateFitZoom();
        boardZoom = fittedBoardZoom * relativeZoom;
        applyCameraSurfaceSize();

        if (preservedView) {
          restoreViewportState(preservedView);
        } else {
          centerTable({ instant: true });
        }

        renderRangeRing();
        renderWaypoint();
        renderUnits();
        updateAdaptiveUI();
      });
    });

    document.getElementById("scenarioSelect").addEventListener("change", restartBattle);
    document.getElementById("restoreDeploymentButton").addEventListener("click", restoreStartingPositions);
    document.getElementById("clearDeploymentButton").addEventListener("click", clearCurrentDeployment);
    // =========================================================================
    // MOBILE PANEL CONFIGURATION
    // Adds collapsible behavior and touch-friendly report organization.
    // =========================================================================
    function configureMobilePanels() {
      document.querySelectorAll(".side > .panel").forEach((panel, index) => {
        const heading = panel.querySelector(":scope > h2");
        if (!heading) return;
        panel.classList.add("mobile-collapsible");
        heading.tabIndex = 0;
        heading.setAttribute("role", "button");
        const toggle = () => {
          if (!adaptiveTouchActive()) return;
          panel.classList.toggle("mobile-collapsed");
        };
        heading.addEventListener("click", toggle);
        heading.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
        if (index >= 4) panel.classList.add("mobile-collapsed");
      });
    }



    // ===== CROSSROADS 2.0A-D staged building module =====
    // =========================================================================
    // BUILDING OCCUPANCY PROTOTYPE
    // Owns farmhouse occupancy, Enter/Exit commands, and occupancy rendering.
    // Integrated through explicit engine seams; no function replacement wrappers.
    // =========================================================================
    const BUILDING_RULES = Object.freeze({
      id: "farmhouse",
      capacity: 1,
      entryDistance: 3.5,
      hardCoverSave: 3
    });

    function buildingCenterPoint() {
      return { x: TERRAIN.building.x + TERRAIN.building.width / 2, y: TERRAIN.building.y + TERRAIN.building.height / 2 };
    }

    function buildingDoorPoint() {
      return { x: TERRAIN.building.x - 0.6, y: TERRAIN.building.y + TERRAIN.building.height * 0.5 };
    }

    function buildingApproachPoint() {
      const door = buildingDoorPoint();
      return { x: door.x - 1.8, y: door.y };
    }

    function buildingEntryAnalysis(unit) {
      if (!unit || unit.inBuilding || buildingOccupant()) {
        return {
          legal: false,
          reason: buildingOccupant()
            ? "The farmhouse is already occupied."
            : "The selected unit cannot enter the farmhouse."
        };
      }

      const approach = buildingApproachPoint();
      return analyzeMovementPath(
        unit,
        [unit, approach],
        "Advance",
        unit.id
      );
    }

    function buildingWindowPointToward(target) {
      const b = TERRAIN.building;
      const c = buildingCenterPoint();
      const dx = (target?.x ?? c.x) - c.x;
      const dy = (target?.y ?? c.y) - c.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return { x: dx < 0 ? b.x - .15 : b.x + b.width + .15, y: clamp(target?.y ?? c.y, b.y + 2, b.y + b.height - 2) };
      }
      return { x: clamp(target?.x ?? c.x, b.x + 2, b.x + b.width - 2), y: dy < 0 ? b.y - .15 : b.y + b.height + .15 };
    }

    function buildingOccupant() {
      return livingUnits().find(unit => unit.inBuilding === BUILDING_RULES.id) ?? null;
    }

    function unitCanEnterBuilding(unit) {
      return Boolean(buildingEntryAnalysis(unit).legal);
    }

    function occupyBuilding(unit, options = {}) {
      if (!unit || (!options.fromAssault && !unitCanEnterBuilding(unit))) return false;
      const center = buildingCenterPoint();
      if (!options.fromAssault && !options.preserveEntry) {
        unit.buildingEntryX = unit.x;
        unit.buildingEntryY = unit.y;
      }
      unit.inBuilding = BUILDING_RULES.id;
      unit.x = center.x;
      unit.y = center.y;
      unit.down = false;
      queueUnitEffect(unit.id, "move");
      return true;
    }

    function buildingCommand(unit, presentation = "desktop") {
      const exiting = Boolean(unit?.inBuilding);
      const entryAnalysis = exiting ? null : buildingEntryAnalysis(unit);
      const entering = Boolean(entryAnalysis?.legal);
      const enabled = phase === "choose-order" && Boolean(unit) && (exiting || entering);
      const label = exiting ? "Exit Farmhouse" : "Enter Farmhouse";

      return window.CrossroadsCommands.makeCommand({
        id: exiting ? "exit-farmhouse" : "enter-farmhouse",
        label,
        enabled,
        execute: exiting ? exitBuildingAction : enterBuildingAction,
        reason: enabled
          ? exiting
            ? "Leave the farmhouse through its doorway."
            : `Advance ${entryAnalysis.cost.toFixed(1)}″ to the doorway and occupy the farmhouse.`
          : entryAnalysis?.reason ?? "The selected unit cannot interact with the farmhouse.",
        meta: {
          presentation,
          className: "tray-confirm tray-wide building-action"
        }
      });
    }

    function enterBuildingAction() {
      const unit = getUnit(selectedUnitId);
      if (phase !== "choose-order" || !unitCanEnterBuilding(unit)) return;
      chosenOrder = "Enter Building";
      if (!attemptOrder(unit, "Advance")) return;
      const approach = buildingApproachPoint();
      unit.buildingEntryX = approach.x;
      unit.buildingEntryY = approach.y;
      occupyBuilding(unit, { preserveEntry: true });
      addLog(`${capitalize(unit.faction)} ${unit.name} advances through the doorway and occupies the farmhouse.`, "terrain");
      showBattleAnnouncement("FARMHOUSE OCCUPIED", `${activeScenario.factions[unit.faction].name} takes defensive positions`, unit.faction, 1250);
      completeActivation("Enter Building");
    }

    function exitBuildingAction() {
      const unit = getUnit(selectedUnitId);
      if (phase !== "choose-order" || !unit?.inBuilding) return;
      chosenOrder = "Exit Building";
      if (!attemptOrder(unit, "Advance")) return;
      const exitPoint = {
        x: unit.buildingEntryX ?? buildingApproachPoint().x,
        y: unit.buildingEntryY ?? buildingApproachPoint().y
      };
      unit.inBuilding = null;
      unit.x = exitPoint.x;
      unit.y = exitPoint.y;
      unit.buildingEntryX = null;
      unit.buildingEntryY = null;
      queueUnitEffect(unit.id, "move");
      addLog(`${capitalize(unit.faction)} ${unit.name} exits the farmhouse through the doorway.`, "terrain");
      showBattleAnnouncement("FARMHOUSE CLEARED", `${unit.name} returns to the doorway`, unit.faction, 1000);
      completeActivation("Exit Building");
    }

    function buildingCombatContext(attacker, target) {
      const attackerInside = Boolean(attacker?.inBuilding);
      const targetInside = Boolean(target?.inBuilding);
      const parts = [];

      if (attackerInside) parts.push("Firing from farmhouse window");
      if (targetInside) parts.push("Target inside farmhouse · hard cover");
      if (targetInside && target?.down) parts.push("Target is Down");
      if (attackerInside && attacker?.ambush) parts.push("Ambush fire");

      return parts;
    }

    function buildingDefenseLabel(target) {
      if (!target?.inBuilding) return "";
      return target.down
        ? "Farmhouse hard cover + Down"
        : "Farmhouse hard cover";
    }

    function buildingOrderLabel(unit) {
      if (!unit) return "";
      if (unit.ambush) return "AMBUSH";
      if (unit.down) return "DOWN";
      return unit.order ? String(unit.order).toUpperCase() : "READY";
    }

    function selectBuildingOccupant() {
      const occupant = buildingOccupant();
      if (!occupant) return;
      if (phase === "choose-target") chooseTarget(occupant.id);
      else if (phase === "choose-assault-target") chooseAssaultTarget(occupant.id);
      else if (phase === "deployment") selectDeploymentUnit(occupant.id);
      else selectUnit(occupant.id);
    }

    function renderBuildingState() {
      const occupant = buildingOccupant();
      const selected = getUnit(selectedUnitId);
      const entryCommand = buildingCommand(selected, "desktop");
      const canEnter = Boolean(entryCommand.enabled && !selected?.inBuilding);

      if (farmhouseTerrain) {
        farmhouseTerrain.classList.toggle("occupied-blue", occupant?.faction === "blue");
        farmhouseTerrain.classList.toggle("occupied-red", occupant?.faction === "red");
        farmhouseTerrain.classList.toggle("occupant-selected", occupant?.id === selectedUnitId);
        farmhouseTerrain.classList.toggle("entry-available", canEnter);
        farmhouseTerrain.classList.toggle("eligible-current", Boolean(occupant && unitIsEligibleForCurrentDie(occupant)));
        farmhouseTerrain.setAttribute(
          "aria-label",
          occupant
            ? `Farmhouse occupied by ${occupant.name}, ${occupant.soldiers} soldiers, ${occupant.pins} pins`
            : "Empty farmhouse"
        );
      }

      if (buildingOccupancyBadge) {
        buildingOccupancyBadge.hidden = !occupant;
        buildingOccupancyBadge.className = `building-occupancy-badge ${occupant?.faction ?? ""}`;
        buildingOccupancyBadge.innerHTML = occupant
          ? `<span class="building-occupancy-faction">${activeScenario.factions[occupant.faction].name}</span>
             <strong class="building-occupancy-name">${occupant.name}</strong>
             <span class="building-occupancy-quality">${qualityLabel(occupant)}</span>
             <span class="building-occupancy-stats">${occupant.faction === "blue" ? "B" : "R"} · ${occupant.soldiers} men · ${occupant.pins} pin${occupant.pins === 1 ? "" : "s"}</span>
             <span class="building-occupancy-order">${buildingOrderLabel(occupant)}</span>${unitIsEligibleForCurrentDie(occupant) ? `<span class="building-ready-tag">READY</span>` : ""}`
          : "";
        buildingOccupancyBadge.onclick = occupant
          ? event => {
              event.stopPropagation();
              if (!gestureSuppressed()) selectBuildingOccupant();
            }
          : null;
      }

      if (buildingOccupancyTab) {
        buildingOccupancyTab.hidden = !occupant;
        buildingOccupancyTab.className =
          `building-occupancy-tab ${occupant?.faction ?? ""}` +
          `${occupant && unitIsEligibleForCurrentDie(occupant) ? " ready" : ""}`;
        buildingOccupancyTab.textContent = occupant
          ? `${occupant.faction === "blue" ? "BLUE" : "RED"} · ${occupant.name} · ${occupant.soldiers}`
          : "";
        buildingOccupancyTab.onclick = occupant
          ? event => {
              event.stopPropagation();
              if (!gestureSuppressed()) selectBuildingOccupant();
            }
          : null;
      }

      if (buildingApproachMarker) {
        buildingApproachMarker.hidden = !canEnter;
        if (canEnter) {
          const approach = buildingApproachPoint();
          const building = TERRAIN.building;
          buildingApproachMarker.style.left =
            `${((approach.x - building.x) / building.width) * 100}%`;
          buildingApproachMarker.style.top =
            `${((approach.y - building.y) / building.height) * 100}%`;
        }
      }

      if (farmhouseTerrain && !farmhouseTerrain.dataset.selectionBound) {
        farmhouseTerrain.dataset.selectionBound = "true";
        farmhouseTerrain.addEventListener("click", event => {
          if (!buildingOccupant() || gestureSuppressed()) return;
          event.stopPropagation();
          selectBuildingOccupant();
        });
      }

      updateBuildingActionButton();
    }

    function updateBuildingActionButton() {
      if (!buildingActionButton) return;
      const command = buildingCommand(getUnit(selectedUnitId), "desktop");
      buildingActionButton.hidden = !command.enabled;
      buildingActionButton.disabled = !command.enabled;
      buildingActionButton.textContent = command.label;
      buildingActionButton.title = command.reason;
      buildingActionButton.onclick = command.enabled ? command.execute : null;
    }

    function clearInvalidBuildingOccupancy() {
      const occupants = livingUnits().filter(unit => unit.inBuilding === BUILDING_RULES.id);
      occupants.slice(1).forEach(unit => { unit.inBuilding = null; });
    }

    function reconcileBuildingAfterUnitChange(unit) {
      if (!unit) {
        clearInvalidBuildingOccupancy();
        return;
      }

      const noLongerActive =
        unit.outcome && unit.outcome !== UNIT_OUTCOME.ACTIVE;
      const noSoldiers = Number(unit.soldiers) <= 0;

      if (unit.inBuilding && (noLongerActive || noSoldiers)) {
        unit.inBuilding = null;
        unit.buildingEntryX = null;
        unit.buildingEntryY = null;
      }

      clearInvalidBuildingOccupancy();

      if (selectedUnitId === unit.id && (noLongerActive || noSoldiers)) {
        selectedUnitId = null;
      }
    }


    // Building behavior is integrated explicitly into restartBattle(),
    // orderAvailability(), the shared command model, and the render coordinator.

    // ===== CROSSROADS 1.7D + 1.8 V1 presentation controller =====
    // =========================================================================
    // PLAYER-FACING PRESENTATION CONTROLLER
    // Owns the reference drawer and moves development panels out of normal play.
    // =========================================================================
    const referenceLauncher = document.getElementById("referenceLauncher");
    const referenceDrawer = document.getElementById("referenceDrawer");
    const referenceCloseButton = document.getElementById("referenceCloseButton");
    const referenceBriefingButton = document.getElementById("referenceBriefingButton");
    const referenceFitButton = document.getElementById("referenceFitButton");
    const referenceMainMenuButton = document.getElementById("referenceMainMenuButton");
    const referencePanelHost = document.getElementById("referencePanelHost");

    function openReferenceDrawer() {
      if (!referenceDrawer) return;
      referenceDrawer.hidden = false;
    }

    function closeReferenceDrawer() {
      if (!referenceDrawer) return;
      referenceDrawer.hidden = true;
    }

    function returnToCrossroadsMainMenu() {
      closeReferenceDrawer();
      if (briefingModal) briefingModal.hidden = true;
      if (afterActionModal) afterActionModal.hidden = true;
      const scenarioOverlay = document.getElementById("scenarioMenuOverlay");
      const mainOverlay = document.getElementById("mainMenuOverlay");
      if (scenarioOverlay) scenarioOverlay.hidden = true;
      if (mainOverlay) mainOverlay.style.display = "grid";
      document.body.classList.add("menu-open");
    }

    function organizePlayerFacingInterface() {
      const panels = [...document.querySelectorAll(".side > .panel")];
      const moveHeadings = new Set(["Core Architecture", "Combat Log"]);

      for (const panel of panels) {
        const heading = panel.querySelector(":scope > h2");
        const headingText = heading?.textContent?.trim() ?? "";
        const isRulesPanel = panel.classList.contains("rules");
        if (moveHeadings.has(headingText) || isRulesPanel) {
          panel.classList.add("dev-only-panel");
          if (referencePanelHost) {
            panel.classList.remove("dev-only-panel");
            referencePanelHost.appendChild(panel);
          }
        }
      }

      const devControlIds = [
        "scenarioSelect",
        "scenarioBrief",
        "deploymentProgress",
        "restoreDeploymentButton",
        "clearDeploymentButton"
      ];
      for (const id of devControlIds) {
        document.getElementById(id)?.classList.add("developer-control");
      }
    }

    // =========================================================================
    // BOOTSTRAP AND EVENT BINDING
    // Final section: binds presentation controls and starts the existing game.
    // Startup order is intentionally unchanged in Foundation Pass 1.
    // =========================================================================
    referenceLauncher?.addEventListener("click", openReferenceDrawer);
    referenceCloseButton?.addEventListener("click", closeReferenceDrawer);
    referenceDrawer?.addEventListener("click", event => {
      if (event.target === referenceDrawer) closeReferenceDrawer();
    });
    referenceBriefingButton?.addEventListener("click", () => {
      closeReferenceDrawer();
      showBriefing();
    });
    referenceFitButton?.addEventListener("click", () => {
      closeReferenceDrawer();
      fitTable();
    });
    referenceMainMenuButton?.addEventListener("click", returnToCrossroadsMainMenu);
    applyBuildInfo();
    organizePlayerFacingInterface();
    configureStageUI();
    configureMobilePanels();
    createRulerLabels();
    restartBattle();
    updateAdaptiveUI();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitTable();
        renderUnits();
        updateMobileDiagnostic();
      });
    });
