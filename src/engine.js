"use strict";

    /*
    =========================================================================
    CROSSROADS BATTLE ENGINE — ARCHITECTURE MAP

      FOUNDATION CONTRACTS     outcomes, combat and scenario runtimes
      CONFIGURATION & DATA      rules, weapons, terrain, units
      RUNTIME STATE             battle and activation transaction state
      EXTERNAL MODULES          presentation, camera, input, movement rules
      CORE HELPERS              units, geometry, dice, formatting
      SCENARIO OBJECTIVES       progress, scoring, exits, and victory
      RENDERING & FEEDBACK      overlays, previews, reports, effects
      TURN & ORDER FLOW         bag draw, order choice, cancellation
      MOVEMENT COMMIT           state mutation, Ambush, completion
      SHOOTING & ASSAULT        combat resolution and casualties
      ACTION COMPLETION         activation, round, elimination
      SCENARIO SYSTEM           definitions, deployment, scoring, victory
      REPORTING                 briefing, statistics, after-action report
      ADAPTIVE UI               mobile tray, touch targeting, gestures
      PUBLIC API                stable integration surface
      BUILDING PROTOTYPE        current experimental occupancy extension
      PRESENTATION CONTROLLER   reference drawer and player-facing shell
      BOOTSTRAP                 final initialization sequence

    Foundation 3I keeps this file as the remaining coordinator while data,
    presentation, camera, input, and movement analysis live in dedicated modules.
    =========================================================================
    */

    /*
      INFANTRY CORE 1.5E — FOUNDATION CONTRACTS

      DATA       definitions only
      STATE      match state and formal unit outcomes
      GEOMETRY   table-space calculations
      RULES      deterministic game resolution
      SCENARIOS  compiled objective runtime and victory policies
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
    // Small engine-local extension points. Scenario objectives use the separate
    // CrossroadsScenarioRuntime boundary and are not registered in this file.
    // -------------------------------------------------------------------------
    const REGISTRY = Object.freeze({
      terrain: new Map(),
      actions: new Map(),
      hooks: Object.freeze({
        beforeRestart: [],
        afterRestart: [],
        beforeRender: [],
        afterRender: []
      })
    });

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

    function cardinalFacingFromVector(dx, dy, fallback = "right") {
      if (Math.hypot(dx, dy) < 0.35) return fallback;
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
      return dy >= 0 ? "down" : "up";
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
        mmgFacing: unit.mmgFacing ?? (unit.faction === "blue" ? 90 : -90),
        facing: unit.facing ?? (unit.faction === "blue" ? "right" : "left")
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

      Crossroads now loads a modular browser architecture. New behavior should
      enter through the owning data, rules, input, camera, or presentation module
      rather than expanding this coordinator by default.
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
      baseHitTarget: 4,
      regularDamageTarget: 4,
      unitCollisionRadius: 1.6,
      buildingCollisionClearance: 0.55,
      unitSeparation: 3.4,
      wallProtectionDepth: 4,
      wallCrossingCost: 2,
      roughGroundMultiplier: 2,
      ambushSampleStep: 0.35,
      reactionFireThreshold: 6,
      commandRadius: 6,
      commandMoraleBonus: 1
    };

    // Static definitions are required external data. Startup validation fails
    // loudly if any source is missing, preventing silent fallback drift.
    const WEAPON_PROFILES = window.CROSSROADS_WEAPON_PROFILES;
    const TERRAIN = window.CROSSROADS_TERRAIN;
    const TERRAIN_GEOMETRY = window.CrossroadsTerrainGeometry;
    const UNIT_QUALITY = window.CROSSROADS_UNIT_QUALITY;

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

    const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES;
    const CORE_SCENARIO_12A = window.CROSSROADS_CORE_SCENARIO_12A;
    const SCENARIO_RUNTIME = window.CrossroadsScenarioRuntime;
    const SCENARIO_PRESENTATION = window.CrossroadsScenarioPresentation;
    const COMBAT_RUNTIME = window.CrossroadsCombatRuntime;
    const BUILDING_OCCUPANCY = window.CrossroadsBuildingOccupancy;
    if (!SCENARIO_RUNTIME || !SCENARIO_PRESENTATION) {
      throw new Error("Scenario Runtime S1.0 modules are unavailable.");
    }
    if (!COMBAT_RUNTIME?.create || !BUILDING_OCCUPANCY?.create) {
      throw new Error("Combat or building runtime modules are unavailable.");
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
    let presentationEffects = null;
    let screenOverlays = null;
    const targetingPresentation = window.CrossroadsTargetingPresentation.create();
    let announcementTimer = null;
    let orderDiePopTimer = null;
    let movementWaypoint = null;
    let pendingMovement = null;
    let pendingReaction = null;
    let deploymentUnitId = null;
    let confirmedTargetId = null;

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
    // Implemented by src/camera/camera.js and src/camera/coordinates.js.
    // =========================================================================
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

    const camera = window.CrossroadsCamera.create({
      battlefieldViewport,
      battlefieldSurface,
      zoomReadout,
      clamp,
      getTableSize:() => ({ width:RULES.tableWidth, height:RULES.tableHeight }),
      onViewChanged: () => {
        renderUnits();
        renderRangeRing();
        renderWaypoint();
        screenOverlays?.refresh();
      }
    });

    const {
      narrowBoardLayout,
      adaptivePortrait,
      syncAutomaticCameraRotation,
      cameraIsRotated,
      syncCameraViewportBox,
      cameraViewportSize,
      calculateFitZoom,
      updateCameraDetailLevel,
      applyCameraSurfaceSize,
      cameraPointFromClient,
      setBoardZoom,
      centerTable,
      fitTable,
      zoomCameraByFactor,
      rotateBoard,
      cameraCanPan,
      tablePointToSurfacePixels,
      frameTablePoint
    } = camera;

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
        buildingCardVisible: !buildingOccupant() || Boolean(document.querySelector(".building-occupancy-nameplate:not([hidden])")),
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
          Boolean(document.querySelector(".building-occupancy-nameplate")) &&
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
      battlefieldScreenOverlay: document.getElementById("battlefieldScreenOverlay"),
      orderDiePop: document.getElementById("orderDiePop"),
      orderDiePopFace: document.getElementById("orderDiePopFace"),
      orderDiePopText: document.getElementById("orderDiePopText"),
      startBattleButton: document.getElementById("startBattleButton"),
      drawButton: document.getElementById("drawButton"),
      nextRoundButton: document.getElementById("nextRoundButton"),
      restartButton: document.getElementById("restartButton"),
      cancelButton: document.getElementById("cancelButton"),
      finishAdvanceButton: document.getElementById("finishAdvanceButton"),
      addWaypointButton: document.getElementById("addWaypointButton"),
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
      "battlefieldScreenOverlay",
      "orderDiePop",
      "orderDiePopFace",
      "orderDiePopText",
      "startBattleButton",
      "drawButton",
      "nextRoundButton",
      "restartButton",
      "cancelButton",
      "finishAdvanceButton",
      "addWaypointButton",
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
    const battlefieldScreenOverlay = DOM.battlefieldScreenOverlay;
    const orderDiePop = DOM.orderDiePop;
    const orderDiePopFace = DOM.orderDiePopFace;
    const orderDiePopText = DOM.orderDiePopText;
    const startBattleButton = DOM.startBattleButton;
    const drawButton = DOM.drawButton;
    const nextRoundButton = DOM.nextRoundButton;
    const restartButton = DOM.restartButton;
    const cancelButton = DOM.cancelButton;
    const finishAdvanceButton = DOM.finishAdvanceButton;
    const addWaypointButton = DOM.addWaypointButton;
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
          ? `Choose deployment before Round 1. Units cannot overlap or pass through units. Dense woods double movement spent inside them; ordinary woods and mud cost ×1.5. Fences, hedges, ditches, and sandbags cost +1″ to cross; walls and rail embankments cost +2″. Overlong legal paths stop at the furthest affordable point. Use Add Waypoint, then tap once to place it and once more for the destination. Shift-click remains an optional shortcut.`
          : `Movement uses the earlier direct-path prototype rules so the stage isolates its featured system.`,
        `Officer teams project a <code>6″</code> command radius and add <code>+1 Morale</code> to nearby friendly Order Tests. Rifle squads carry rifles plus an LMG; assault squads mix rifles and SMGs; MMG teams cannot fire after an Advance.`
      ];

      stageRules.innerHTML = ruleLines.join("<br><br>");

      scaleNote.textContent = FEATURES.movementIntegrity
        ? "Movement integrity is active: choose Add Waypoint, place it, then choose the final destination. If a chosen point is too deep into rough ground, the unit stops at the furthest affordable legal point."
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





    const coordinates = window.CrossroadsCoordinates.create({
      battlefield,
      getTableSize:() => ({ width:RULES.tableWidth, height:RULES.tableHeight }),
      clamp,
      cameraIsRotated
    });
    const {
      pixelsPerInch,
      inchesToPixels,
      tablePointToPixels,
      tableVectorToScreenVector,
      eventToTablePoint
    } = coordinates;

    function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
    function distanceBetweenUnits(a, b) { return distanceBetweenPoints(a, b); }
    function distanceToObjective(unit) { return distanceBetweenPoints(unit, RULES.objective); }

    function unitIsOnObjective(unit) {
      return unit.soldiers > 0 && distanceToObjective(unit) <= RULES.objective.radius + 0.001;
    }


    const MMG_RULES = Object.freeze({
      arcDegrees: 90,
      facingStep: 45,
      fullCrew: 3,
      reducedCrew: 2
    });


    function normalizeDegrees(value) {
      let angle = value % 360;
      if (angle < 0) angle += 360;
      return angle;
    }





    function deployMMG(unit) {
      const cardinalAngle = {
        right: 0,
        down: 90,
        left: 180,
        up: 270
      };

      unit.mmgDeployed = true;
      unit.mmgFacing = cardinalAngle[unit.facing] ?? unit.mmgFacing ?? 0;

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



    function applyCasualties(unit, requested) {
      const casualties = Math.min(requested, unit.soldiers);
      const descriptors = [];
      for (let i = 0; i < casualties; i++) {
        const removedIndex = Math.max(0, unit.soldiers - 1);
        let removedWeapon = null;
        for (const key of unit.casualtyOrder ?? []) {
          if ((unit.weapons?.[key] ?? 0) > 0) {
            removedWeapon = key;
            unit.weapons[key] -= 1;
            break;
          }
        }
        descriptors.push({
          role: soldierRole(unit, removedIndex),
          weaponKey: removedWeapon,
          slot: formationSlots(unit, unit.mmgDeployed)[removedIndex] ?? [50, 50],
          round
        });
        unit.soldiers -= 1;
      }
      if (descriptors.length) {
        presentationEffects?.playCasualtyPuffs(unit, descriptors);
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
      const remaining = Math.max(0, unit.soldiers);
      if (remaining > 0) {
        const slots = formationSlots(unit, unit.mmgDeployed);
        presentationEffects?.playCasualtyPuffs(
          unit,
          Array.from({ length: Math.min(remaining, 4) }, (_, index) => ({
            slot: slots[Math.max(0, remaining - 1 - index)] ?? [50, 50]
          }))
        );
      }

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


    // =========================================================================
    // SCENARIO OBJECTIVE ADAPTERS
    // The engine commits battle state; Scenario Runtime evaluates objectives.
    // =========================================================================
    function scenarioContext() {
      return {
        units: livingUnits(),
        allUnits: units,
        terrain: TERRAIN.instances ?? [],
        round,
        table: activeScenario.table,
        factions: activeScenario.factions,
        maxRounds: RULES.maxRounds
      };
    }

    function objectiveSnapshots() {
      return scenarioSession ? scenarioSession.snapshot(scenarioContext()) : [];
    }

    function exitObjective() {
      return scenarioSession?.compiled.objectives.find(objective => objective.type === "exit_unit") ?? null;
    }

    function scenarioIsBreakthrough() {
      return Boolean(exitObjective());
    }

    function breakthroughProgress() {
      const snapshot = objectiveSnapshots().find(item => item.objective.type === "exit_unit");
      const attackers = units.filter(unit => unit.faction === snapshot?.objective?.faction);
      const exited = Number(snapshot?.progress?.current ?? 0);
      return { total:attackers.length, exited, contained:Math.max(0, attackers.length - exited) };
    }

    function exitUnit(unit) {
      const objective = scenarioSession?.exitObjectiveFor(unit, scenarioContext());
      if (!objective || !unitIsActive(unit)) return false;
      setUnitOutcome(unit, UNIT_OUTCOME.EXITED, { reason:objective.id });
      unit.exitRound = round;
      unit.exitZoneId = objective.id;
      unit.exitPoints = Number(objective.pointsPerUnit ?? 0);
      unit.order = "Exited";
      unit.activated = true;
      const result = scenarioSession.dispatch("unit_exited", { unitId:unit.id, factionId:unit.faction, objectiveId:objective.id, round }, scenarioContext());
      scores.blue += result.score.blue;
      scores.red += result.score.red;
      if (battleStats) {
        battleStats[unit.faction].unitsExited += 1;
        battleStats[unit.faction].soldiersExited += unit.soldiers;
        battleStats[unit.faction].breakthroughPoints += Number(result.score[unit.faction] ?? 0);
      }
      const gained = Number(result.score[unit.faction] ?? 0);
      addLog(`${activeScenario.factions[unit.faction].name} ${unit.name} exits through ${objective.label}. ${activeScenario.factions[unit.faction].name} gains ${gained} points.`, "objective");
      showBattleAnnouncement(`${unit.name.toUpperCase()} EXITED`, `${activeScenario.factions[unit.faction].name.toUpperCase()} +${gained} · Unit survives`, unit.faction, 1200);
      return true;
    }

    // =========================================================================
    // OBJECTIVE QUERIES AND TRANSIENT BATTLEFIELD FEEDBACK
    // Owns objective state, announcements, target readouts, and effect queues.
    // =========================================================================
    function objectiveState() {
      const first = objectiveSnapshots().find(snapshot => snapshot.state);
      return first?.state ?? "none";
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


    function showTargetReadout(target, state, heading, lines) {
      screenOverlays?.show(target, state, heading, lines);
    }

    function clearTargetReadout() {
      screenOverlays?.clear();
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
      ORDER_PRESENTATION,
      orderPresentation,
      packedMMGFormationHtml,
      deployedMMGFormationHtml,
      qualityStripeHtml,
      unitNameplateHtml,
      unitFormationHtml
    } = window.CrossroadsUnitPresentation;

    // Movement analysis must be composed before building and combat runtimes.
    // Both runtimes receive analyzeMovementPath as a dependency, so declaring it
    // later would trigger JavaScript's temporal dead zone during startup.
    const movementRules = window.CrossroadsMovementRules.create({
      rules: RULES,
      terrain: TERRAIN,
      movementIntegrityEnabled: () => FEATURES.movementIntegrity,
      livingUnits,
      distanceBetweenPoints,
      pointAtSegment,
      pointInsideRect,
      expandRect,
      segmentRectClip,
      segmentTerrainClip: (start, end, instance) =>
        TERRAIN_GEOMETRY.segmentClip(start, end, instance, segmentRectClip),
      segmentPointDistance,
      capitalize
    });

    const {
      analyzeMovementPath,
      fitMovementPathToAllowance,
      analyzeMovementSegment,
      analyzeDestinationCollision
    } = movementRules;

    // =========================================================================
    // EXPLICIT RUNTIME COMPOSITION
    // The engine supplies state and commit adapters. Runtime modules do not
    // reach into engine globals, replace presentation objects, or own bootstrap.
    // =========================================================================
    const buildingOccupancy = BUILDING_OCCUPANCY.create({
      terrainGeometry: TERRAIN_GEOMETRY,
      commands: window.CrossroadsCommands,
      terrainPresentation: window.CrossroadsTerrainPresentation,
      terrainLayer: document.getElementById("terrainLayer"),
      actionButton: buildingActionButton,
      unitOutcomeActive: UNIT_OUTCOME.ACTIVE,
      livingUnits,
      getUnit,
      getSelectedUnitId: () => selectedUnitId,
      clearSelectedUnit: unitId => {
        if (selectedUnitId === unitId) selectedUnitId = null;
      },
      getPhase: () => phase,
      setChosenOrder: order => {
        chosenOrder = order;
      },
      analyzeMovementPath,
      attemptOrder: (...args) => attemptOrder(...args),
      completeActivation,
      addLog,
      capitalize,
      showAnnouncement: showBattleAnnouncement,
      getActiveScenario: () => activeScenario,
      unitIsEligibleForCurrentDie,
      unitNameplateHtml,
      gestureSuppressed,
      chooseTarget,
      chooseAssaultTarget,
      selectDeploymentUnit,
      selectUnit
    });

    const {
      instance: buildingInstance,
      instances: buildingInstances,
      label: buildingLabel,
      centerPoint: buildingCenterPoint,
      doorPoint: buildingDoorPoint,
      approachPoint: buildingApproachPoint,
      occupant: buildingOccupant,
      entryAnalysis: buildingEntryAnalysis,
      windowPointToward: buildingWindowPointToward,
      canEnter: unitCanEnterBuilding,
      occupy: occupyBuilding,
      command: buildingCommand,
      enterAction: enterBuildingAction,
      exitAction: exitBuildingAction,
      combatContext: buildingCombatContext,
      defenseLabel: buildingDefenseLabel,
      orderLabel: buildingOrderLabel,
      selectOccupant: selectBuildingOccupant,
      render: renderBuildingState,
      updateActionButton: updateBuildingActionButton,
      clearInvalidOccupancy: clearInvalidBuildingOccupancy,
      reconcileAfterUnitChange: reconcileBuildingAfterUnitChange
    } = buildingOccupancy;

    const combatRuntime = COMBAT_RUNTIME.create({
      rules: RULES,
      features: FEATURES,
      weaponProfiles: WEAPON_PROFILES,
      unitQuality: UNIT_QUALITY,
      terrain: TERRAIN,
      mmgRules: MMG_RULES,
      distanceBetweenPoints,
      distanceBetweenUnits,
      segmentRectClip,
      segmentTerrainClip: (start, end, instance) =>
        TERRAIN_GEOMETRY.segmentClip(start, end, instance, segmentRectClip),
      analyzeMovementPath,
      getTerrainInstance: id => TERRAIN_GEOMETRY.get(id),
      getLivingUnits: livingUnits,
      getBattleStats: () => battleStats,
      resolveShooterPoint: (shooter, targetPoint) =>
        shooter?.inBuilding
          ? buildingWindowPointToward(shooter.inBuilding, targetPoint)
          : shooter,
      resolveTargetPoint: targetPoint => {
        const unit = targetPoint?.id ? targetPoint : null;
        const buildingId = unit?.inBuilding ?? null;
        return {
          unit,
          buildingId,
          point: buildingId ? buildingCenterPoint(buildingId) : targetPoint
        };
      },
      buildingDoorPoint,
      buildingLabel,
      occupyBuilding,
      lockActivationTransaction,
      recordOrderTest,
      addLog,
      capitalize,
      finishActivationState,
      recordCasualties,
      recordUnitDestroyed,
      destroyUnit,
      applyCasualties,
      fullLoadout,
      renderUnits,
      qualityLabel,
      qualityProfile,
      findSafeAssaultPosition,
      showBattleAnnouncement,
      completeActivation,
      checkElimination,
      clearActivationSelection: () => {
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
      },
      rollDice
    });

    const {
      commandSupport,
      commandBonus,
      attemptOrder,
      isMMGTeam,
      analyzeMMGFireArc,
      targetInsideMMGArc,
      availableFireGroups,
      weaponRange,
      determineLineCover,
      analyzeShot,
      analyzeShotAtPoint,
      resolveShootingCore,
      analyzeAssault,
      resolveCloseCombat
    } = combatRuntime;

    window.CROSSROADS_COMBAT_RUNTIME_STATE = combatRuntime.diagnostic;

    // =========================================================================
    // MINIATURE PRESENTATION BUILDERS
    // Produces counters, formations, soldiers, pins, labels, and state chits.
    // =========================================================================













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

    screenOverlays = window.CrossroadsScreenOverlays.create({
      battlefield,
      battlefieldViewport,
      battlefieldScreenOverlay,
      targetReadout,
      tableWidth: RULES.tableWidth,
      tableHeight: RULES.tableHeight
    });

    presentationEffects = window.CrossroadsPresentationEffects.create({
      battlefield,
      tableWidth: RULES.tableWidth,
      tableHeight: RULES.tableHeight,
      getTableSize: () => ({
        width: RULES.tableWidth,
        height: RULES.tableHeight
      })
    });

    // Battlefield unit DOM rendering lives in src/presentation/battlefield.js.
    const renderUnitLayer = window.CrossroadsBattlefieldPresentation.createUnitLayerRenderer({
      battlefield,
      RULES,
      WEAPON_PROFILES,
      getUnit,
      isMMGTeam,
      inchesToPixels,
      livingUnits,
      unitIsEligibleForCurrentDie,
      qualityLabel,
      unitFormationHtml,
      presentationEffects,
      unitIsOnObjective,
      analyzeShot,
      availableFireGroups,
      analyzeAssault,
      gestureSuppressed,
      adaptiveTouchActive,
      handleAdaptiveUnitTap,
      selectDeploymentUnit,
      chooseTarget,
      chooseAssaultTarget,
      selectUnit,
      installLongPress,
      showShotPreview,
      showAssaultPreview,
      showUnitPreview,
      clearTracePreview,
      getPhase: () => phase,
      getChosenOrder: () => chosenOrder,
      getSelectedUnitId: () => selectedUnitId,
      getDeploymentUnitId: () => deploymentUnitId,
      getPendingTouchTargetId: () => pendingTouchTargetId,
      getConfirmedTargetId: () => confirmedTargetId,
      getTargetingSnapshot: () => targetingPresentation.snapshot(),
      getCurrentFaction: () => currentFaction,
      commandSupport
    });


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
        if (isMMGTeam(unit) && unit.mmgDeployed) {
          rangeRing.hidden = true;
          battlefield.classList.remove("movement-mode");
          return;
        }
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






    // =========================================================================
    // UNIT SELECTION, ORDER BAG, AND ORDER CHOICE
    // Owns activation selection, cancellation, die draw, and order commitment.
    // =========================================================================
    function selectUnit(unitId) {
      if (presentationEffects?.isBusy()) return;
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

    async function chooseOrder(order) {
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
      waypointArmed = false;
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
        const removedPins = unit.pins;
        await presentationEffects.playRally(unit.id);
        unit.pins = 0;
        addLog(
          `${capitalize(unit.faction)} ${unit.name} rallies and removes ${removedPins} Pin${removedPins === 1 ? "" : "s"}.`,
          "morale"
        );
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
        waypointArmed = false;
        addWaypointButton.hidden = !FEATURES.movementIntegrity;
        clearWaypointButton.hidden = true;
        cancelButton.disabled = Boolean(transactionLockReason);
        const distance = order === "Run" ? RULES.runDistance : RULES.advanceDistance;
        setStatus(
          `${order}: tap a destination inside the gold circle.`,
          FEATURES.movementIntegrity
            ? `Maximum cost ${distance}″. Add Waypoint is optional.`
            : `Maximum movement ${distance}″.`
        );
        renderUnits();
        return;
      }

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

      if (
        FEATURES.movementIntegrity &&
        !movementWaypoint &&
        (waypointArmed || event.shiftKey)
      ) {
        placeWaypoint(unit, point);
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
    function armWaypoint() {
      if (
        phase !== "plan-movement" ||
        !FEATURES.movementIntegrity ||
        movementWaypoint
      ) return;

      waypointArmed = !waypointArmed;
      addWaypointButton.classList.toggle("active", waypointArmed);
      addWaypointButton.textContent =
        waypointArmed ? "Tap Waypoint" : "Add Waypoint";
      setStatus(
        waypointArmed
          ? "Waypoint armed. Tap the battlefield to place it."
          : "Waypoint mode cancelled. Tap a final destination."
      );
      queueAdaptiveUI();
    }

    function placeWaypoint(unit, point) {
      const waypoint = clampPoint(point);
      const analysis = analyzeMovementPath(
        unit,
        [unit, waypoint],
        chosenOrder,
        null
      );

      if (!analysis.legal) {
        rejectMovement(analysis, [unit, waypoint]);
        return false;
      }

      movementWaypoint = waypoint;
      waypointArmed = false;
      addWaypointButton.hidden = true;
      addWaypointButton.classList.remove("active");
      addWaypointButton.textContent = "Add Waypoint";
      clearWaypointButton.hidden = false;
      pendingTouchMovement = null;
      setStatus(
        "Waypoint placed. Tap the final destination.",
        `${analysis.cost.toFixed(1)}″ spent; ` +
        `${(analysis.allowance - analysis.cost).toFixed(1)}″ remains.`
      );
      renderUnits();
      return true;
    }

    function clearWaypoint() {
      if (phase !== "plan-movement") return;
      movementWaypoint = null;
      waypointArmed = false;
      addWaypointButton.hidden = !FEATURES.movementIntegrity;
      addWaypointButton.classList.remove("active");
      addWaypointButton.textContent = "Add Waypoint";
      clearWaypointButton.hidden = true;
      clearRouteLines();
      waypointMarker.hidden = true;
      setStatus("Waypoint cleared. Tap a destination or add another waypoint.");
      renderUnits();
    }

    function rejectMovement(analysis, path) {
      drawRoute(path, true);
      setStatus("Movement is not legal.", analysis.reason);
      setPreview("blocked", "Movement rejected", `Calculated cost: ${analysis.cost.toFixed(1)}″ of ${analysis.allowance}″.`, analysis.reason);
      addLog(`Movement rejected: ${analysis.reason}`, "terrain");
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

    async function finalizePendingMovement() {
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

      const movementPath = pendingMovement.path.map(point => ({
        x: point.x,
        y: point.y
      }));
      const destination = movementPath[movementPath.length - 1];
      const supportedBefore = new Set(
        unit.role === "officer"
          ? livingUnits()
              .filter(candidate => commandSupport(candidate)?.id === unit.id)
              .map(candidate => candidate.id)
          : []
      );

      const facings = [];
      for (let index = 1; index < movementPath.length; index += 1) {
        const from = movementPath[index - 1];
        const to = movementPath[index];
        const visualMovement = tableVectorToScreenVector(
          to.x - from.x,
          to.y - from.y
        );
        facings.push(
          cardinalFacingFromVector(
            visualMovement.x,
            visualMovement.y,
            unit.facing
          )
        );
      }

      unit.facing = facings[0] ?? unit.facing;
      window.CrossroadsBattlefieldPresentation.applyUnitFacing(
        battlefield,
        unit.id,
        unit.facing
      );
      await new Promise(requestAnimationFrame);
      await new Promise(resolve => setTimeout(resolve, 65));

      await presentationEffects.playMovementPath(
        unit.id,
        movementPath,
        pendingMovement.analysis.cost,
        {
          heavy: isMMGTeam(unit),
          facings
        }
      );

      unit.x = destination.x;
      unit.y = destination.y;
      unit.facing = facings[facings.length - 1] ?? unit.facing;

      if (unit.role === "officer") {
        const newlySupported = livingUnits()
          .filter(candidate =>
            candidate.id !== unit.id &&
            commandSupport(candidate)?.id === unit.id &&
            !supportedBefore.has(candidate.id)
          )
          .map(candidate => candidate.id);

        presentationEffects.playCommandPulse(unit.id, newlySupported);
      }

      if (exitUnit(unit)) {
        const order = pendingMovement.order;
        addLog(`${capitalize(unit.faction)} ${unit.name} completes ${order} by exiting the battlefield.`, "objective");
        pendingMovement = null;
        movementWaypoint = null;
        waypointArmed = false;
        addWaypointButton.hidden = true;
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
      waypointArmed = false;
      addWaypointButton.hidden = true;
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
    async function chooseTarget(targetId) {
      if (presentationEffects?.isBusy()) return;
      if (phase !== "choose-target" || !selectedUnitId || battleEnded) return;

      const shooter = getUnit(selectedUnitId);
      const target = getUnit(targetId);
      if (!shooter || !target || target.soldiers <= 0) return;

      if (target.id === shooter.id && chosenOrder === "Fire") {
        backToOrdersFromFire();
        return;
      }

      if (target.faction === shooter.faction) {
        setStatus("Choose an enemy target.");
        return;
      }

      const moving = chosenOrder === "Advance";
      const trace = analyzeShot(shooter, target);
      const groups = availableFireGroups(shooter, trace.distance, moving, true);

      if (!trace.inRange) {
        showShotPreview(shooter, target);
        setStatus(
          `${target.name} is out of range at ${trace.distance.toFixed(1)}″.`,
          `Maximum range: ${trace.range}″.`
        );
        return;
      }

      if (trace.blocked) {
        showShotPreview(shooter, target);
        setStatus(`No legal firing line to ${target.name}.`, trace.blockReason);
        return;
      }

      if (groups.length === 0) {
        showShotPreview(shooter, target);
        setStatus(
          `No surviving weapon can fire at ${target.name}.`,
          moving
            ? "Fixed weapons such as the MMG cannot fire after an Advance; finish the Advance or cancel."
            : "Every surviving weapon is out of range."
        );
        return;
      }

      if (!(isMMGTeam(shooter) && shooter.mmgDeployed)) {
        const visualFireVector = tableVectorToScreenVector(
          target.x - shooter.x,
          target.y - shooter.y
        );
        shooter.facing = cardinalFacingFromVector(
          visualFireVector.x,
          visualFireVector.y,
          shooter.facing
        );
      }

      confirmedTargetId = target.id;
      targetingPresentation.confirm(target.id);
      pendingTouchTargetId = null;
      window.CrossroadsBattlefieldPresentation.applyUnitFacing(
        battlefield,
        shooter.id,
        shooter.facing
      );
      window.CrossroadsBattlefieldPresentation.confirmTargetInPlace(
        battlefield,
        target.id
      );
      await new Promise(requestAnimationFrame);
      showShotPreview(shooter, target);

      if (chosenOrder === "Fire" && !attemptOrder(shooter, "Fire")) {
        confirmedTargetId = null;
        targetingPresentation.clear();
        return;
      }

      const fireResult = resolveShootingCore(
        shooter,
        target,
        trace,
        {
          label: chosenOrder === "Advance" ? "Advance fire" : "Fire",
          movingPenalty: moving
        }
      );

      await presentationEffects.playFire(shooter.id, groups);
      confirmedTargetId = null;
      targetingPresentation.clear();
      window.CrossroadsBattlefieldPresentation.clearTargetConfirmation(
        battlefield
      );

      if (!checkElimination()) completeActivation(chosenOrder);
      else renderUnits();
    }


    // =========================================================================
    // ASSAULT ANALYSIS AND CLOSE COMBAT
    // Owns charge legality, reaction fire, combat dice, and post-combat position.
    // =========================================================================

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


    function findSafeAssaultPosition(attacker, targetPosition, attackerStart) {
      if (!FEATURES.movementIntegrity) return targetPosition;
      const angle = Math.atan2(attackerStart.y - targetPosition.y, attackerStart.x - targetPosition.x);
      const candidates = [0, 1.8, 2.4, 3.0].flatMap(radius => [0, .7, -.7, 1.4, -1.4].map(offset => ({
        x: targetPosition.x + Math.cos(angle + offset) * radius,
        y: targetPosition.y + Math.sin(angle + offset) * radius
      })));
      for (const candidate of candidates) {
        const point = clampPoint(candidate);
        if (!destinationOverlapsBuilding(point) && !analyzeDestinationCollision(attacker, point, null).blocked) return point;
      }
      return clampPoint(attackerStart);
    }

    // =========================================================================
    // ACTION COMPLETION, ROUND FLOW, AND ELIMINATION
    // Clears transient state, completes activations, and advances the battle.
    // =========================================================================
    function clearActionOverlays() {
      targetingPresentation.clear();
      confirmedTargetId = null;
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
      if (typeof waypointArmed !== "undefined") waypointArmed = false;
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

    function destinationOverlapsBuilding(point) {
      const clearance = Math.max(0, Number(RULES.buildingCollisionClearance) || 0);
      return (TERRAIN.instances ?? []).some(instance =>
        instance.rules?.occupiable &&
        pointInsideRect(point, expandRect(instance, clearance))
      );
    }
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
    let scenarioSession = null;
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
      if (scenarioSession) {
        const result = scenarioSession.dispatch("unit_destroyed", {
          unitId:unit.id,
          targetId:unit.id,
          factionId:unit.faction,
          causedByFactionId:creditedFaction,
          cause,
          round
        }, scenarioContext());
        scores.blue += result.score.blue;
        scores.red += result.score.red;
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
      const summaries = (activeScenario.objectives ?? []).map(objective => SCENARIO_PRESENTATION.describeObjective(objective, activeScenario));
      if (activeScenario.victory.elimination) summaries.push("Eliminating the opposing force wins immediately.");
      summaries.push(`Tied scores use ${activeScenario.victory.tiebreaker === "survivingSoldiers" ? "surviving soldiers" : "surviving units"}.`);
      return summaries;
    }

    // =========================================================================
    // BRIEFING AND AFTER-ACTION REPORT UI
    // Renders mission information and the completed battle record.
    // =========================================================================
    function renderBriefing() {
      const objectiveSummaries = scenarioScoringSummary();
      const roleData = activeScenario.structure?.roles ?? {};
      const attacker = roleData.attacker;
      const defender = roleData.defender;
      briefingTitle.textContent = activeScenario.title;
      briefingDescription.textContent = activeScenario.description;
      briefingMeta.innerHTML = [
        `${activeScenario.rounds} rounds`,
        `${activeScenario.table.width}″ × ${activeScenario.table.height}″ table`,
        activeScenario.deployment.mode === "fixed" ? "Fixed deployment" : "Player deployment",
        `${activeScenario.objectives?.length ?? 0} objective${(activeScenario.objectives?.length ?? 0) === 1 ? "" : "s"}`
      ].map(item => `<span class="brief-chip">${item}</span>`).join("");

      briefingIntelLine.textContent = `MISSION: ${objectiveSummaries[0] ?? "Complete the scenario objectives and preserve combat power."}`;
      briefingMissionStrip.innerHTML = ["blue", "red"].map(faction => {
        let role = "Complete the listed objectives and deny the opposing force.";
        if (attacker === faction) role = "Attack, complete the active objectives, and force a decision before time expires.";
        if (defender === faction) role = "Defend the battlefield, delay the attacker, and preserve the required positions or targets.";
        return `<div class="briefing-role ${faction}"><strong>${activeScenario.factions[faction].name} mission</strong>${role}</div>`;
      }).join("");

      briefingBlueForce.innerHTML = factionForceSummary("blue");
      briefingRedForce.innerHTML = factionForceSummary("red");
      briefingObjectives.innerHTML = `<h3>Objectives</h3><ol>${(activeScenario.objectives ?? []).map(objective => `<li><strong>${objective.label || objective.id}</strong> — ${SCENARIO_PRESENTATION.describeObjective(objective, activeScenario)}</li>`).join("")}</ol>`;
      briefingRules.innerHTML = `<h3>Scoring & Victory</h3><ul>${objectiveSummaries.map(rule => `<li>${rule}</li>`).join("")}</ul>`;
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
    function scenarioObjective() { return activeScenario.objectives?.[0] ?? { id:"none", label:"No Objective", x:RULES.tableWidth / 2, y:RULES.tableHeight / 2, radius:0 }; }

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
      scenarioSession = SCENARIO_RUNTIME.createSession(activeScenario);
      const objective = (activeScenario.objectives ?? []).find(item => Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) ?? { x:activeScenario.table.width / 2, y:activeScenario.table.height / 2, radius:0 };
      RULES.objective = { x:Number(objective.x), y:Number(objective.y), radius:Number(objective.radius ?? 0) };

      const terrainPresentation = window.CrossroadsTerrainPresentation;
      if (!terrainPresentation) {
        throw new Error("Terrain presentation module is unavailable.");
      }

      if (!TERRAIN_GEOMETRY) {
        throw new Error("Terrain geometry module is unavailable.");
      }
      TERRAIN.instances = TERRAIN_GEOMETRY.setActiveScenario(activeScenario);

      terrainPresentation.renderScenarioTerrain({
        layer: document.getElementById("terrainLayer"),
        scenario: activeScenario
      });

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
      applyCameraSurfaceSize();
      requestAnimationFrame(() => centerTable({ instant:true }));
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
        if (destinationOverlapsBuilding(unit)) return false;
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
      if (destinationOverlapsBuilding(destination)) {
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
      const snapshots = objectiveSnapshots();
      const primary = snapshots.find(snapshot => snapshot.state) ?? snapshots[0];
      objectiveOwner.textContent = primary?.summary ?? "No active objectives";
      blueObjectiveDistance.textContent = `${scores.blue} points`;
      redObjectiveDistance.textContent = `${scores.red} points`;
      objectiveLabel.hidden = true;
      objectiveRing.hidden = true;
      objectiveMarker.hidden = true;
      document.body.classList.remove("objective-focus");
      SCENARIO_PRESENTATION.renderCards(snapshots, activeScenario.factions);
      SCENARIO_PRESENTATION.renderMarkers(snapshots, activeScenario.table);
      updateDeploymentProgress();
      updateTransactionBadge();
    }

    function scoreRoundAndContinue() {
      if (phase !== "round-complete" || battleEnded) return;
      clearActionOverlays();
      const result = scenarioSession.dispatch("round_ended", { round }, scenarioContext());
      scores.blue += result.score.blue;
      scores.red += result.score.red;
      if (result.score.blue || result.score.red) {
        showBattleAnnouncement("OBJECTIVES SCORED", `${activeScenario.factions.blue.name} +${result.score.blue} · ${activeScenario.factions.red.name} +${result.score.red}`, result.score.blue > result.score.red ? "blue" : result.score.red > result.score.blue ? "red" : "neutral", 1100);
        addLog(`Round ${round} objectives: ${activeScenario.factions.blue.name} +${result.score.blue}, ${activeScenario.factions.red.name} +${result.score.red}.`, "objective");
      } else {
        showBattleAnnouncement("NO OBJECTIVE SCORE", `Round ${round} checkpoint`, "neutral", 900);
      }
      updateScenarioUI();
      const immediate = scenarioSession.resolveVictory(scores, scenarioContext());
      if (immediate) {
        finishBattle(immediate.message, { ...immediate, blueScore:scores.blue, redScore:scores.red });
        return;
      }
      if (round >= RULES.maxRounds) {
        endBattleByScore();
        return;
      }
      round += 1;
      scenarioSession.dispatch("round_started", { round }, scenarioContext());
      showBattleAnnouncement(`ROUND ${round}`, `${activeScenario.factions.blue.name} ${scores.blue} — ${scores.red} ${activeScenario.factions.red.name}`, "neutral", 1000);
      for (const unit of livingUnits()) {
        unit.activated = false;
        unit.order = null;
        unit.down = false;
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
      const result = scenarioSession.finalize(scenarioContext());
      scores.blue += result.score.blue;
      scores.red += result.score.red;
      if (result.score.blue || result.score.red) addLog(`Final objectives: ${activeScenario.factions.blue.name} +${result.score.blue}, ${activeScenario.factions.red.name} +${result.score.red}.`, "objective");
    }

    function endBattleByScore() {
      applyFinalScenarioScoring();
      const result = scenarioSession.resolveVictory(scores, scenarioContext(), { final:true });
      finishBattle(result.message, { ...result, blueScore:scores.blue, redScore:scores.red });
    }

    function endBattleByElimination() {
      const objectiveVictory = scenarioSession?.resolveVictory(scores, scenarioContext());
      if (objectiveVictory) {
        finishBattle(objectiveVictory.message, { ...objectiveVictory, blueScore:scores.blue, redScore:scores.red });
        return;
      }
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
          reason: "Exit the building before moving or assaulting."
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

    const ORDER_COMMAND_TEXT = Object.freeze({
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
      const labels = ORDER_COMMAND_TEXT[order] ?? Object.freeze({
        desktop: order,
        mobile: order
      });
      const orderVisual = orderPresentation(order);
      const baseLabel =
        isMMGTeam(unit) && order === "Fire" && !unit.mmgDeployed
          ? "Deploy MMG"
          : labels[presentation] ?? labels.desktop;
      const commandLabel =
        `${orderVisual?.symbol ?? ""} ${baseLabel}`.trim();

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
      if (legal && destinationOverlapsBuilding(destination)) {
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
    let waypointArmed = false;
    let gestureSuppressUntil = 0;
    let adaptiveUpdateQueued = false;

    function adaptiveTouchActive() { return narrowBoardLayout(); }
    function gestureSuppressed() { return Date.now() < gestureSuppressUntil; }
    function suppressGesturesFor(milliseconds) {
      gestureSuppressUntil = Math.max(
        gestureSuppressUntil,
        Date.now() + Math.max(0, Number(milliseconds) || 0)
      );
    }

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
          addTrayAction(waypointArmed ? "Tap board" : "Preview placement", () => {}, { disabled: true });
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
        if (movementWaypoint) {
          addTrayAction("Tap Destination", () => {}, {
            disabled: true,
            className: "tray-confirm tray-wide"
          });
          addTrayAction("Clear Waypoint", clearWaypoint);
        } else {
          addTrayAction(
            waypointArmed ? "Tap Waypoint" : "Add Waypoint",
            armWaypoint,
            {
              className: waypointArmed ? "tray-confirm tray-wide" : ""
            }
          );
          addTrayAction("Confirm Direct Move", confirmPendingTouchMovement, {
            disabled:
              !pendingTouchMovement ||
              pendingTouchMovement.state === "blocked",
            className: "tray-confirm"
          });
        }
        addTrayAction("Cancel", cancelAndReselect, {
          disabled: Boolean(transactionLockReason),
          className: "tray-danger"
        });
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
      if (legal && destinationOverlapsBuilding(destination)) { legal = false; reason = "Impassable building overlaps this position."; }
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

        if (waypointArmed && !movementWaypoint) {
          placeWaypoint(unit, point);
          queueAdaptiveUI();
          return true;
        }

        previewMovementAt(point);
        pendingTouchMovement = lastMovementPreview ? {
          path: lastMovementPreview.path.map(p => ({ x: p.x, y: p.y })),
          analysis: lastMovementPreview.analysis,
          state: lastMovementPreview.state
        } : null;

        if (
          movementWaypoint &&
          pendingTouchMovement &&
          pendingTouchMovement.state !== "blocked"
        ) {
          confirmPendingTouchMovement();
          return true;
        }

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
      const end = () => { if (timer) clearTimeout(timer); timer = null; if (longPressed) suppressGesturesFor(350); };
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
        zoom: camera.getBoardZoom(),
        x: (battlefieldViewport.scrollLeft + battlefieldViewport.clientWidth / 2) / Math.max(1, battlefieldSurface.scrollWidth),
        y: (battlefieldViewport.scrollTop + battlefieldViewport.clientHeight / 2) / Math.max(1, battlefieldSurface.scrollHeight)
      };
    }

    function restoreViewportState(state) {
      if (!state || !battlefieldViewport || !battlefieldSurface) return;
      camera.setZoomImmediate(state.zoom);
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


    // =========================================================================
    // INPUT BINDING
    // Browser gestures and battlefield DOM events live in src/input/.
    // =========================================================================
    window.CrossroadsCameraInput.install({
      battlefieldViewport,
      battlefieldSurface,
      camera,
      adaptiveTouchActive,
      cameraCanPan,
      cameraPointFromClient,
      zoomCameraByFactor,
      setBoardZoom,
      applyCameraSurfaceSize,
      suppressGesturesFor
    });

    window.CrossroadsBattlefieldInput.install({
      battlefield,
      cursorReadout,
      eventToTablePoint,
      handleBattlefieldClick,
      handleBattlefieldHover,
      clearGhostPreview
    });

    briefingBeginButton.addEventListener("click", () => {
      hideBriefing();
      requestAnimationFrame(() => {
      syncCameraViewportBox();
      requestAnimationFrame(() => {
        syncAutomaticCameraRotation();
        camera.recalculateFitZoom();
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
    addWaypointButton.addEventListener("click", armWaypoint);
    clearWaypointButton.addEventListener("click", clearWaypoint);
    reactionPrimaryButton.addEventListener("click", resolveAmbushFire);
    reactionSecondaryButton.addEventListener("click", holdAmbushFire);
    for (const button of orderButtons) {
      button.addEventListener("click", () => {
        void chooseOrder(button.dataset.order);
      });
    }

    window.addEventListener("resize", () => {
      const preservedView = captureViewportState();
      const oldFit = camera.getFittedZoom() || calculateFitZoom();
      syncCameraViewportBox();
      const relativeZoom = oldFit > 0 ? camera.getBoardZoom() / oldFit : 1;

      createRulerLabels();
      clearTracePreview();
      syncAutomaticCameraRotation();

      requestAnimationFrame(() => {
        camera.recalculateFitZoom();
        camera.setZoomImmediate(camera.getFittedZoom() * relativeZoom);
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



    // Building occupancy is owned by src/runtime/building-occupancy.js.
    // The engine creates one explicit controller during dependency composition.

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
