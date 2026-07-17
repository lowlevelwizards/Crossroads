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

run("src/rules/shooting.js");
run("src/rules/shooting-integration.js");

vm.runInContext(`
  const RULES = {
    baseHitTarget: 4,
    regularDamageTarget: 4,
    wallProtectionDepth: 4
  };
  const WEAPON_PROFILES = {
    rifle: { key: "rifle", label: "Rifle", range: 24, shots: 1, assault: false, fixed: false },
    smg: { key: "smg", label: "SMG", range: 12, shots: 2, assault: true, fixed: false },
    mmg: { key: "mmg", label: "MMG", range: 36, shots: 5, reducedShots: 2, crewWeapon: true, fixed: true, assault: false }
  };
  const UNIT_QUALITY = {
    regular: { shootingTargetModifier: 0 }
  };
  const TERRAIN = { instances: [] };
  const MMG_RULES = { arcDegrees: 90, fullCrew: 3, reducedCrew: 2 };
  const TERRAIN_GEOMETRY = { get() { return null; } };

  function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function segmentRectClip() { return null; }
  function buildingWindowPointToward(id, target) { return target; }
  function buildingCenterPoint() { return { x: 0, y: 0 }; }

  function isMMGTeam() { return "legacy"; }
  function analyzeMMGFireArc() { return { insideArc: false }; }
  function targetInsideMMGArc() { return false; }
  function availableFireGroups() { return []; }
  function weaponRange() { return -1; }
  function determineLineCover() { return null; }
  function analyzeShot() { return null; }
  function analyzeShotAtPoint() { return null; }
  function resolveShootingCore() { return null; }

  const __logs = [];
  let __renderCount = 0;
  let battleStats = {
    blue: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0 }
  };
  function lockActivationTransaction(reason) { window.__lockReason = reason; }
  function rollDice(count) { return Array.from({ length: count }, () => 6); }
  function addLog(message, style) { __logs.push({ message, style }); }
  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
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

  window.CrossroadsBattlefieldPresentation.createUnitLayerRenderer({
    isMMGTeam,
    analyzeShot,
    availableFireGroups
  });

  const shooter = {
    id: "blue-1", faction: "blue", name: "Squad",
    x: 0, y: 0, soldiers: 1, weapons: { rifle: 1 },
    pins: 0, morale: 9, quality: "regular"
  };
  const target = {
    id: "red-1", faction: "red", name: "Target",
    x: 12, y: 0, soldiers: 2, weapons: { rifle: 2 },
    pins: 0, morale: 9, quality: "regular"
  };
  const trace = analyzeShot(shooter, target);
  const result = resolveShootingCore(shooter, target, trace, {
    label: "Fire",
    movingPenalty: false
  });

  window.__integrationResult = {
    installed: window.CrossroadsShootingIntegration.isInstalled(),
    extraction: window.CROSSROADS_SHOOTING_EXTRACTION,
    rendererUsesPureRules:
      window.__capturedRendererDeps.analyzeShot === analyzeShot &&
      window.__capturedRendererDeps.availableFireGroups === availableFireGroups,
    traceDistance: trace.distance,
    result,
    targetPins: target.pins,
    targetSoldiers: target.soldiers,
    shotsFired: battleStats.blue.shotsFired,
    hitsScored: battleStats.blue.hitsScored,
    renderCount: __renderCount,
    logs: __logs.length
  };
`, context);

const result = context.__integrationResult;
const failures = [];
function check(condition, label) { if (!condition) failures.push(label); }
check(result.installed === true, "integration did not install");
check(result.extraction?.active === true, "extraction diagnostic missing");
check(result.rendererUsesPureRules === true, "renderer did not receive pure rule callbacks");
check(result.traceDistance === 12, "shot trace distance changed");
check(result.result.hits === 1, "adapter did not report hit");
check(result.targetPins === 1, "adapter did not commit Pin");
check(result.targetSoldiers === 1, "adapter did not commit casualty");
check(result.shotsFired === 1 && result.hitsScored === 1, "stats were not committed");
check(result.renderCount === 1, "adapter did not render once");
check(result.logs >= 4, "adapter did not reproduce shooting logs");

if (failures.length) {
  console.error("FAIL — shooting integration", failures, result);
  process.exitCode = 1;
} else {
  console.log("PASS — staged shooting integration delegates and commits correctly.");
}
