"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Math, Object, Array, Map, Set });
context.window = context;

function run(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

vm.runInContext(`
  window.CrossroadsBattlefieldPresentation = Object.freeze({
    createUnitLayerRenderer(deps) {
      window.__capturedRendererDeps = deps;
      return () => {};
    },
    applyUnitFacing() {},
    confirmTargetInPlace() {},
    clearTargetConfirmation() {}
  });
`, context);

run("src/rules/morale.js");
run("src/rules/shooting.js");
run("src/rules/assault.js");
run("src/rules/combat-runtime.js");

vm.runInContext(`
  const RULES = {
    baseHitTarget: 4,
    regularDamageTarget: 4,
    wallProtectionDepth: 4,
    commandRadius: 6,
    commandMoraleBonus: 1,
    assaultDistance: 12,
    reactionFireThreshold: 6
  };
  const FEATURES = { ambush: true, movementIntegrity: true };
  const WEAPON_PROFILES = {
    rifle: { key: "rifle", label: "Rifle", range: 24, shots: 1, assault: false, fixed: false },
    smg: { key: "smg", label: "SMG", range: 12, shots: 2, assault: true, fixed: false },
    mmg: { key: "mmg", label: "MMG", range: 36, shots: 5, reducedShots: 2, crewWeapon: true, fixed: true, assault: false }
  };
  const UNIT_QUALITY = {
    regular: { label: "Regular", shootingTargetModifier: 0, assaultDamageTarget: 4 }
  };
  const TERRAIN = { instances: [] };
  const MMG_RULES = { arcDegrees: 90, fullCrew: 3, reducedCrew: 2 };
  const TERRAIN_GEOMETRY = { get() { return null; } };

  function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function distanceBetweenUnits(a, b) { return distanceBetweenPoints(a, b); }
  function segmentRectClip() { return null; }
  function buildingWindowPointToward(id, target) { return target; }
  function buildingCenterPoint() { return { x: 0, y: 0 }; }
  function buildingDoorPoint() { return { x: 0, y: 0 }; }
  function analyzeMovementPath() { return { legal: true, reason: "" }; }

  function isMMGTeam() { return "legacy"; }
  function analyzeMMGFireArc() { return { insideArc: false }; }
  function targetInsideMMGArc() { return false; }
  function availableFireGroups() { return []; }
  function weaponRange() { return -1; }
  function determineLineCover() { return null; }
  function analyzeShot() { return null; }
  function analyzeShotAtPoint() { return null; }
  function resolveShootingCore() { return null; }
  function commandSupport() { return "legacy"; }
  function commandBonus() { return -1; }
  function attemptOrder() { return "legacy"; }
  function analyzeAssault() { return { legal: false, reason: "legacy" }; }
  function resolveCloseCombat() { return "legacy"; }

  const __logs = [];
  let __renderCount = 0;
  let __finishCount = 0;
  let __orderTests = 0;
  let __orderPasses = 0;
  let __orderFailures = 0;
  let __diceQueue = [];
  let __diceRequests = [];
  let battleStats = {
    blue: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0 }
  };

  const shooter = {
    id: "blue-1", faction: "blue", name: "Squad", role: "line",
    x: 0, y: 0, soldiers: 1, weapons: { rifle: 1 },
    pins: 0, morale: 9, quality: "regular"
  };
  const officer = {
    id: "blue-officer", faction: "blue", name: "Officer", role: "officer",
    x: 5, y: 0, soldiers: 2, weapons: { pistol: 2 },
    pins: 0, morale: 9, quality: "regular"
  };
  const target = {
    id: "red-1", faction: "red", name: "Target", role: "line",
    x: 12, y: 0, soldiers: 2, weapons: { rifle: 2 },
    pins: 0, morale: 9, quality: "regular"
  };
  const units = [shooter, officer, target];

  function livingUnits() { return units.filter(unit => unit.soldiers > 0); }
  function lockActivationTransaction(reason) { window.__lockReason = reason; }
  function rollDice(count) {
    const batch = __diceQueue.shift();
    if (!batch || batch.length !== count) {
      throw new Error("Unexpected dice request: " + count);
    }
    __diceRequests.push(count);
    return batch;
  }
  function addLog(message, style) { __logs.push({ message, style }); }
  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  function qualityLabel() { return "Regular"; }
  function recordCasualties() {}
  function recordUnitDestroyed() {}
  function destroyUnit(unit) { unit.soldiers = 0; }
  function applyCasualties(unit, requested) {
    const actual = Math.min(requested, unit.soldiers);
    unit.soldiers -= actual;
    return actual;
  }
  function fullLoadout(unit) { return unit.soldiers + " rifles"; }
  function renderUnits() { __renderCount += 1; }
  function finishActivationState() { __finishCount += 1; }
  function qualityProfile(unit) { return UNIT_QUALITY[unit.quality]; }
  function findSafeAssaultPosition(unit, targetPosition) { return targetPosition; }
  function occupyBuilding() { return true; }
  function showBattleAnnouncement() {}
  function buildingLabel() { return "building"; }
  function completeActivation() {}
  function checkElimination() { return false; }

  function recordOrderTest(unit, passed) {
    __orderTests += 1;
    if (passed) __orderPasses += 1;
    else __orderFailures += 1;
  }

  window.CrossroadsBattlefieldPresentation.createUnitLayerRenderer({
    isMMGTeam,
    analyzeShot,
    availableFireGroups,
    commandSupport
  });

  __diceQueue = [[6], [6]];
  const trace = analyzeShot(shooter, target);
  const fireResult = resolveShootingCore(shooter, target, trace, {
    label: "Fire",
    movingPenalty: false
  });

  const pinnedActor = {
    id: "blue-2", faction: "blue", name: "Pinned Squad", role: "line",
    x: 0, y: 1, soldiers: 6, weapons: { rifle: 6 },
    pins: 2, morale: 9, quality: "regular", down: false, activated: false
  };
  units.push(pinnedActor);
  __diceQueue = [[4, 4]];
  const orderPassed = attemptOrder(pinnedActor, "Advance");

  const rallyActor = {
    id: "blue-3", faction: "blue", name: "Rally Squad", role: "line",
    x: 0, y: 2, soldiers: 6, weapons: { rifle: 6 },
    pins: 4, morale: 9, quality: "regular", down: false, activated: false
  };
  units.push(rallyActor);
  __diceQueue = [[5, 5]];
  const rallyPassed = attemptOrder(rallyActor, "Rally");

  const failingActor = {
    id: "blue-4", faction: "blue", name: "Failing Squad", role: "line",
    x: 20, y: 20, soldiers: 6, weapons: { rifle: 6 },
    pins: 4, morale: 8, quality: "regular", down: false, activated: false
  };
  units.push(failingActor);
  __diceQueue = [[6, 6]];
  const orderFailed = attemptOrder(failingActor, "Run");

  const unpinnedActor = {
    id: "blue-5", faction: "blue", name: "Ready Squad", role: "line",
    x: 0, y: 3, soldiers: 6, weapons: { rifle: 6 },
    pins: 0, morale: 9, quality: "regular"
  };
  units.push(unpinnedActor);
  const requestsBeforeNoTest = __diceRequests.length;
  const noTestPassed = attemptOrder(unpinnedActor, "Down");

  window.__integrationResult = {
    installed: window.CrossroadsCombatRuntime.isInstalled(),
    extraction: window.CROSSROADS_COMBAT_EXTRACTION,
    rendererUsesPureRules:
      window.__capturedRendererDeps.analyzeShot === analyzeShot &&
      window.__capturedRendererDeps.availableFireGroups === availableFireGroups &&
      window.__capturedRendererDeps.commandSupport === commandSupport,
    traceDistance: trace.distance,
    fireResult,
    targetPins: target.pins,
    targetSoldiers: target.soldiers,
    shotsFired: battleStats.blue.shotsFired,
    hitsScored: battleStats.blue.hitsScored,
    renderCount: __renderCount,
    supportedByOfficer: commandSupport(pinnedActor)?.id,
    commandBonus: commandBonus(pinnedActor),
    orderPassed,
    pinsAfterPass: pinnedActor.pins,
    rallyPassed,
    rallyPinsAwaitEngineCommit: rallyActor.pins,
    orderFailed,
    failureState: {
      down: failingActor.down,
      activated: failingActor.activated,
      order: failingActor.order
    },
    noTestPassed,
    noTestUsedDice: __diceRequests.length !== requestsBeforeNoTest,
    orderTests: __orderTests,
    orderPasses: __orderPasses,
    orderFailures: __orderFailures,
    finishCount: __finishCount,
    logs: __logs.length
  };
`, context);

const result = context.__integrationResult;
const failures = [];
function check(condition, label) { if (!condition) failures.push(label); }
check(result.installed === true, "integration did not install");
check(result.extraction?.active === true, "combat extraction diagnostic missing");
check(result.rendererUsesPureRules === true, "renderer did not receive pure rule callbacks");
check(result.traceDistance === 12, "shot trace distance changed");
check(result.fireResult.hits === 1, "shooting adapter did not report hit");
check(result.targetPins === 1, "shooting adapter did not commit Pin");
check(result.targetSoldiers === 1, "shooting adapter did not commit casualty");
check(result.shotsFired === 1 && result.hitsScored === 1, "shooting stats were not committed");
check(result.renderCount === 1, "shooting adapter did not render once");
check(result.supportedByOfficer === "blue-officer", "morale rules did not find officer support");
check(result.commandBonus === 1, "morale rules did not provide command bonus");
check(result.orderPassed === true && result.pinsAfterPass === 1, "passed order did not remove one Pin");
check(result.rallyPassed === true && result.rallyPinsAwaitEngineCommit === 4, "Rally clearing escaped engine ownership");
check(result.orderFailed === false, "failed order returned success");
check(result.failureState.down && result.failureState.activated, "failed order did not commit Down state");
check(result.failureState.order === "Down · Failed", "failed order label changed");
check(result.noTestPassed === true && result.noTestUsedDice === false, "unpinned order consumed dice");
check(result.orderTests === 3 && result.orderPasses === 2 && result.orderFailures === 1, "Order Test stats changed");
check(result.finishCount === 1, "failed order did not finish activation exactly once");
check(result.logs >= 10, "integration did not reproduce combat and morale logs");

if (failures.length) {
  console.error("FAIL — combat integration", failures, result);
  process.exitCode = 1;
} else {
  console.log("PASS — permanent combat runtime delegates shooting and morale and commits correctly.");
}
