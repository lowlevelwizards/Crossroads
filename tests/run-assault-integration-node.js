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
  function analyzeMovementPath() { return { legal: true, reason: "", cost: 7, allowance: 12 }; }

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
  const __casualtyRecords = [];
  let __renderCount = 0;
  let __completeCount = 0;
  let __finishCount = 0;
  let __lockReason = null;
  let __diceQueue = [];
  let __occupiedBuilding = null;
  let __announcement = null;
  let selectedUnitId = "blue-1";
  let chosenOrder = "Assault";
  let activationSnapshot = {};
  let battleStats = {
    blue: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0, assaultsWon: 0 },
    red: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0, assaultsWon: 0 }
  };

  const attacker = {
    id: "blue-1", faction: "blue", name: "Attackers", role: "line",
    x: 0, y: 0, soldiers: 3, weapons: { rifle: 3 }, casualtyOrder: ["rifle"],
    pins: 0, morale: 9, quality: "regular", down: false, ambush: false,
    inBuilding: null
  };
  const defender = {
    id: "red-1", faction: "red", name: "Defenders", role: "line",
    x: 7, y: 0, soldiers: 3, weapons: { rifle: 3 }, casualtyOrder: ["rifle"],
    pins: 0, morale: 9, quality: "regular", down: false, ambush: false,
    inBuilding: null
  };
  const units = [attacker, defender];

  function livingUnits() { return units.filter(unit => unit.soldiers > 0); }
  function lockActivationTransaction(reason) { __lockReason = reason; }
  function rollDice(count) {
    const batch = __diceQueue.shift();
    if (!batch || batch.length !== count) {
      throw new Error("Unexpected dice request: " + count);
    }
    return batch;
  }
  function addLog(message, style) { __logs.push({ message, style }); }
  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  function qualityProfile(unit) { return UNIT_QUALITY[unit.quality]; }
  function qualityLabel(unit) { return qualityProfile(unit).label; }
  function recordCasualties(source, target, count) { __casualtyRecords.push({ source, target, count }); }
  function recordUnitDestroyed() {}
  function destroyUnit(unit) {
    unit.soldiers = 0;
    for (const key of Object.keys(unit.weapons ?? {})) unit.weapons[key] = 0;
  }
  function applyCasualties(unit, requested) {
    const actual = Math.min(requested, unit.soldiers);
    unit.soldiers -= actual;
    if (unit.weapons?.rifle) unit.weapons.rifle = Math.max(0, unit.weapons.rifle - actual);
    return actual;
  }
  function fullLoadout(unit) { return unit.soldiers + " rifles"; }
  function renderUnits() { __renderCount += 1; }
  function finishActivationState() { __finishCount += 1; }
  function completeActivation(order) { __completeCount += 1; window.__completedOrder = order; }
  function checkElimination() { return false; }
  function findSafeAssaultPosition(unit, targetPosition) { return targetPosition; }
  function occupyBuilding(unit, options) { __occupiedBuilding = options.buildingId; return true; }
  function showBattleAnnouncement(title, subtitle) { __announcement = { title, subtitle }; }
  function buildingLabel() { return "farmhouse"; }
  function recordOrderTest() {}

  window.CrossroadsBattlefieldPresentation.createUnitLayerRenderer({
    isMMGTeam,
    analyzeShot,
    availableFireGroups,
    commandSupport,
    analyzeAssault
  });

  const analysis = analyzeAssault(attacker, defender);
  __diceQueue = [[6, 6, 1], [1, 1, 1]];
  const combatResult = resolveCloseCombat(attacker, defender, analysis);

  const buildingAttacker = {
    ...attacker, id: "blue-2", name: "Building Attackers",
    x: 2, y: 2, soldiers: 1, weapons: { rifle: 1 }
  };
  const buildingDefender = {
    ...defender, id: "red-2", name: "Building Defenders",
    x: 9, y: 9, soldiers: 1, weapons: { rifle: 1 }, inBuilding: "farm"
  };
  __diceQueue = [[6], [1]];
  const buildingResult = resolveCloseCombat(
    buildingAttacker,
    buildingDefender,
    { defensivePosition: false, buildingAssault: true, buildingId: "farm" }
  );

  window.__assaultIntegrationResult = {
    assaultInstalled: window.CrossroadsCombatRuntime.isInstalled(),
    extraction: window.CROSSROADS_COMBAT_EXTRACTION,
    rendererUsesPureAssault: window.__capturedRendererDeps.analyzeAssault === analyzeAssault,
    analysis,
    combatResult,
    buildingResult,
    occupiedBuilding: __occupiedBuilding,
    announcement: __announcement,
    lockReason: __lockReason,
    attackerSoldiers: attacker.soldiers,
    defenderSoldiers: defender.soldiers,
    attackerPosition: { x: attacker.x, y: attacker.y },
    assaultsWon: battleStats.blue.assaultsWon,
    completeCount: __completeCount,
    completedOrder: window.__completedOrder,
    finishCount: __finishCount,
    renderCount: __renderCount,
    casualtyTotal: __casualtyRecords.reduce((sum, entry) => sum + entry.count, 0),
    logs: __logs.length
  };
`, context);

const result = context.__assaultIntegrationResult;
const failures = [];
function check(condition, label) { if (!condition) failures.push(label); }

check(result.assaultInstalled === true, "assault integration did not install");
check(result.extraction?.stage === "Foundation 4C", "combat runtime stage was not upgraded");
check(result.rendererUsesPureAssault === true, "renderer did not receive pure assault analysis");
check(result.analysis.legal === true, "legal assault was rejected");
check(result.analysis.reactionFire === true, "reaction-fire eligibility changed");
check(result.combatResult.winner === "attacker", "pure combat result changed the winner");
check(result.lockReason === "close-combat dice rolled", "combat transaction was not locked");
check(result.attackerSoldiers === 3, "attacker casualties changed");
check(result.defenderSoldiers === 0, "loser cleanup was not committed");
check(result.attackerPosition.x === 7 && result.attackerPosition.y === 0, "winner did not occupy target position");
check(result.assaultsWon === 2, "assault statistics were not committed");
check(result.completeCount === 2 && result.completedOrder === "Assault", "winning activation did not complete");
check(result.finishCount === 0, "winning assault incorrectly used failure flow");
check(result.renderCount === 2, "assault adapter did not render exactly once per combat");
check(result.casualtyTotal === 4, "assault casualty records changed");
check(result.buildingResult.winner === "attacker", "building combat winner changed");
check(result.occupiedBuilding === "farm", "building winner did not occupy the captured building");
check(result.announcement?.title === "FARMHOUSE CLEARED", "building-clear announcement changed");
check(result.logs >= 3, "assault adapter did not reproduce combat logs");

if (failures.length) {
  console.error("FAIL — assault integration", failures, result);
  process.exitCode = 1;
} else {
  console.log("PASS — permanent combat runtime delegates assault calculation and commits engine state correctly.");
}
