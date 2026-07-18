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
const casualtyRecords = [];
let renderCount = 0;
let completeCount = 0;
let finishCount = 0;
let lockReason = null;
let diceQueue = [];
let occupiedBuilding = null;
let announcement = null;
let completedOrder = null;
let clearedSelection = 0;
const battleStats = {
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

function distanceBetweenPoints(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function livingUnits() { return units.filter(unit => unit.soldiers > 0); }
function rollDice(count) {
  const batch = diceQueue.shift();
  if (!batch || batch.length !== count) throw new Error(`Unexpected dice request: ${count}`);
  return batch;
}
function applyCasualties(unit, requested) {
  const actual = Math.min(requested, unit.soldiers);
  unit.soldiers -= actual;
  if (unit.weapons?.rifle) unit.weapons.rifle = Math.max(0, unit.weapons.rifle - actual);
  return actual;
}
function destroyUnit(unit) {
  unit.soldiers = 0;
  for (const key of Object.keys(unit.weapons ?? {})) unit.weapons[key] = 0;
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
  analyzeMovementPath: () => ({ legal: true, reason: "", cost: 7, allowance: 12 }),
  getTerrainInstance: () => null,
  getLivingUnits: livingUnits,
  getBattleStats: () => battleStats,
  resolveShooterPoint: (unit, point) => unit ?? point,
  resolveTargetPoint: point => ({ unit: point?.id ? point : null, buildingId: point?.inBuilding ?? null, point }),
  buildingDoorPoint: () => ({ x: 0, y: 0 }),
  buildingLabel: () => "farmhouse",
  occupyBuilding: (unit, options) => { occupiedBuilding = options.buildingId; return true; },
  lockActivationTransaction: reason => { lockReason = reason; },
  recordOrderTest: () => {},
  addLog: (message, style) => logs.push({ message, style }),
  capitalize: value => value.charAt(0).toUpperCase() + value.slice(1),
  finishActivationState: () => { finishCount += 1; },
  recordCasualties: (source, target, count) => casualtyRecords.push({ source, target, count }),
  recordUnitDestroyed: () => {},
  destroyUnit,
  applyCasualties,
  fullLoadout: unit => `${unit.soldiers} rifles`,
  renderUnits: () => { renderCount += 1; },
  qualityLabel: () => "Regular",
  qualityProfile: unit => UNIT_QUALITY[unit.quality],
  findSafeAssaultPosition: (unit, point) => point,
  showBattleAnnouncement: (title, subtitle) => { announcement = { title, subtitle }; },
  completeActivation: order => { completeCount += 1; completedOrder = order; },
  checkElimination: () => false,
  clearActivationSelection: () => { clearedSelection += 1; },
  rollDice
});

const analysis = runtime.analyzeAssault(attacker, defender);
diceQueue = [[6, 6, 1], [1, 1, 1]];
const combatResult = runtime.resolveCloseCombat(attacker, defender, analysis);

const buildingAttacker = {
  ...attacker,
  id: "blue-2",
  name: "Building Attackers",
  x: 2,
  y: 2,
  soldiers: 1,
  weapons: { rifle: 1 }
};
const buildingDefender = {
  ...defender,
  id: "red-2",
  name: "Building Defenders",
  x: 9,
  y: 9,
  soldiers: 1,
  weapons: { rifle: 1 },
  inBuilding: "farm"
};
diceQueue = [[6], [1]];
const buildingResult = runtime.resolveCloseCombat(
  buildingAttacker,
  buildingDefender,
  { defensivePosition: false, buildingAssault: true, buildingId: "farm" }
);

const result = {
  diagnostic: runtime.diagnostic,
  analysis,
  combatResult,
  buildingResult,
  occupiedBuilding,
  announcement,
  lockReason,
  attackerSoldiers: attacker.soldiers,
  defenderSoldiers: defender.soldiers,
  attackerPosition: { x: attacker.x, y: attacker.y },
  assaultsWon: battleStats.blue.assaultsWon,
  completeCount,
  completedOrder,
  finishCount,
  renderCount,
  clearedSelection,
  casualtyTotal: casualtyRecords.reduce((sum, entry) => sum + entry.count, 0),
  logs: logs.length
};

const failures = [];
function check(condition, label) { if (!condition) failures.push(label); }
check(result.diagnostic?.active === true, "explicit assault runtime diagnostic missing");
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
check(result.clearedSelection === 0, "winning assault incorrectly cleared activation selection");
check(result.casualtyTotal === 4, "assault casualty records changed");
check(result.buildingResult.winner === "attacker", "building combat winner changed");
check(result.occupiedBuilding === "farm", "building winner did not occupy the captured building");
check(result.announcement?.title === "FARMHOUSE CLEARED", "building-clear announcement changed");
check(result.logs >= 3, "assault adapter did not reproduce combat logs");

if (failures.length) {
  console.error("FAIL — explicit assault integration", failures, result);
  process.exitCode = 1;
} else {
  console.log("PASS — explicit combat runtime delegates assault calculation and commits engine state correctly.");
}
