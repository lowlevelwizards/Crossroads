"use strict";

global.window = global;
require("../src/rules/morale.js");
require("../src/rules/shooting.js");
require("../src/rules/assault.js");
require("../src/rules/combat-runtime.js");

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
  pistol: { key: "pistol", label: "Pistol", range: 6, shots: 1, assault: true, fixed: false },
  mmg: { key: "mmg", label: "MMG", range: 36, shots: 5, reducedShots: 2, crewWeapon: true, fixed: true, assault: false }
};
const UNIT_QUALITY = {
  regular: { label: "Regular", shootingTargetModifier: 0, assaultDamageTarget: 4 }
};
const TERRAIN = { instances: [] };
const MMG_RULES = { arcDegrees: 90, fullCrew: 3, reducedCrew: 2 };

const logs = [];
let renderCount = 0;
let finishCount = 0;
let orderTests = 0;
let orderPasses = 0;
let orderFailures = 0;
let diceQueue = [];
const diceRequests = [];
const battleStats = {
  blue: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0, assaultsWon: 0 },
  red: { shotsFired: 0, hitsScored: 0, pinsInflicted: 0, assaultsWon: 0 }
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

function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function livingUnits() { return units.filter(unit => unit.soldiers > 0); }
function rollDice(count) {
  const batch = diceQueue.shift();
  if (!batch || batch.length !== count) throw new Error(`Unexpected dice request: ${count}`);
  diceRequests.push(count);
  return batch;
}
function applyCasualties(unit, requested) {
  const actual = Math.min(requested, unit.soldiers);
  unit.soldiers -= actual;
  return actual;
}
function recordOrderTest(unit, passed) {
  orderTests += 1;
  if (passed) orderPasses += 1;
  else orderFailures += 1;
}

const runtime = window.CrossroadsCombatRuntime.create({
  rules: RULES,
  features: FEATURES,
  weaponProfiles: WEAPON_PROFILES,
  unitQuality: UNIT_QUALITY,
  terrain: TERRAIN,
  mmgRules: MMG_RULES,
  distanceBetweenPoints,
  distanceBetweenUnits: distanceBetweenPoints,
  segmentRectClip: () => null,
  segmentTerrainClip: () => null,
  analyzeMovementPath: () => ({ legal: true, reason: "" }),
  getTerrainInstance: () => null,
  getLivingUnits: livingUnits,
  getBattleStats: () => battleStats,
  resolveShooterPoint: (unit, point) => unit ?? point,
  resolveTargetPoint: point => ({ unit: point?.id ? point : null, buildingId: null, point }),
  buildingDoorPoint: () => ({ x: 0, y: 0 }),
  buildingLabel: () => "building",
  occupyBuilding: () => true,
  lockActivationTransaction: reason => { global.__lockReason = reason; },
  recordOrderTest,
  addLog: (message, style) => logs.push({ message, style }),
  capitalize: value => value.charAt(0).toUpperCase() + value.slice(1),
  finishActivationState: () => { finishCount += 1; },
  recordCasualties: () => {},
  recordUnitDestroyed: () => {},
  destroyUnit: unit => { unit.soldiers = 0; },
  applyCasualties,
  fullLoadout: unit => `${unit.soldiers} rifles`,
  renderUnits: () => { renderCount += 1; },
  qualityLabel: () => "Regular",
  qualityProfile: unit => UNIT_QUALITY[unit.quality],
  findSafeAssaultPosition: (unit, point) => point,
  showBattleAnnouncement: () => {},
  completeActivation: () => {},
  checkElimination: () => false,
  clearActivationSelection: () => {},
  rollDice
});

diceQueue = [[6], [6]];
const trace = runtime.analyzeShot(shooter, target);
const fireResult = runtime.resolveShootingCore(shooter, target, trace, {
  label: "Fire",
  movingPenalty: false
});

const pinnedActor = {
  id: "blue-2", faction: "blue", name: "Pinned Squad", role: "line",
  x: 0, y: 1, soldiers: 6, weapons: { rifle: 6 },
  pins: 2, morale: 9, quality: "regular", down: false, activated: false
};
units.push(pinnedActor);
diceQueue = [[4, 4]];
const orderPassed = runtime.attemptOrder(pinnedActor, "Advance");

const rallyActor = {
  id: "blue-3", faction: "blue", name: "Rally Squad", role: "line",
  x: 0, y: 2, soldiers: 6, weapons: { rifle: 6 },
  pins: 4, morale: 9, quality: "regular", down: false, activated: false
};
units.push(rallyActor);
diceQueue = [[5, 5]];
const rallyPassed = runtime.attemptOrder(rallyActor, "Rally");

const failingActor = {
  id: "blue-4", faction: "blue", name: "Failing Squad", role: "line",
  x: 20, y: 20, soldiers: 6, weapons: { rifle: 6 },
  pins: 4, morale: 8, quality: "regular", down: false, activated: false
};
units.push(failingActor);
diceQueue = [[6, 6]];
const orderFailed = runtime.attemptOrder(failingActor, "Run");

const unpinnedActor = {
  id: "blue-5", faction: "blue", name: "Ready Squad", role: "line",
  x: 0, y: 3, soldiers: 6, weapons: { rifle: 6 },
  pins: 0, morale: 9, quality: "regular"
};
units.push(unpinnedActor);
const requestsBeforeNoTest = diceRequests.length;
const noTestPassed = runtime.attemptOrder(unpinnedActor, "Down");

const result = {
  diagnostic: runtime.diagnostic,
  traceDistance: trace.distance,
  fireResult,
  targetPins: target.pins,
  targetSoldiers: target.soldiers,
  shotsFired: battleStats.blue.shotsFired,
  hitsScored: battleStats.blue.hitsScored,
  renderCount,
  supportedByOfficer: runtime.commandSupport(pinnedActor)?.id,
  commandBonus: runtime.commandBonus(pinnedActor),
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
  noTestUsedDice: diceRequests.length !== requestsBeforeNoTest,
  orderTests,
  orderPasses,
  orderFailures,
  finishCount,
  logs: logs.length
};

const failures = [];
function check(condition, label) { if (!condition) failures.push(label); }
check(result.diagnostic?.active === true, "explicit combat runtime diagnostic missing");
check(result.diagnostic?.mode.includes("explicit"), "combat runtime still reports implicit installation");
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
  console.error("FAIL — explicit combat integration", failures, result);
  process.exitCode = 1;
} else {
  console.log("PASS — explicit combat runtime delegates shooting and morale and commits correctly.");
}
