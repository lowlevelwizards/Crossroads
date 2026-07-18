"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }

const index = read("index.html");
const engine = read("src/engine.js");
const morale = read("src/rules/morale.js");
const shooting = read("src/rules/shooting.js");
const assault = read("src/rules/assault.js");
const runtime = read("src/rules/combat-runtime.js");
const building = read("src/runtime/building-occupancy.js");
const validation = read("src/infrastructure/startup-validation.js");
const buildInfo = read("data/build-info.js");

const order = [
  "src/rules/morale.js",
  "src/rules/shooting.js",
  "src/rules/assault.js",
  "src/runtime/building-occupancy.js",
  "src/rules/combat-runtime.js",
  "src/infrastructure/startup-validation.js",
  "src/engine.js"
].map(value => index.indexOf(value));

check(order.every(position => position >= 0), "one or more permanent combat scripts are missing from index.html");
check(order.every((position, i) => i === 0 || position > order[i - 1]), "permanent combat script load order is incorrect");
check(!index.includes("shooting-integration.js"), "temporary shooting integration still loads at runtime");
check(!index.includes("assault-integration.js"), "temporary assault integration still loads at runtime");

check(morale.includes("analyzeOrderTest"), "morale module lacks Order Test analysis");
check(morale.includes("resolveOrderTest"), "morale module lacks Order Test resolution");
check(morale.includes("findCommandSupport"), "morale module lacks officer support analysis");
check(morale.includes("analyzeIncomingPins"), "morale module lacks incoming-Pin analysis");
check(!/unit\.pins\s*[+-]?=/.test(morale), "morale module mutates unit Pins");
check(!/unit\.down\s*=/.test(morale), "morale module mutates Down state");

check(shooting.includes("const pinImpact = analyzeIncomingPins"), "shooting does not delegate Pin routing to morale");
check(!/addLog\s*\(/.test(shooting), "shooting module writes combat logs");
check(!/applyCasualties\s*\(/.test(shooting), "shooting module commits casualties");

check(assault.includes("function analyzeAssault"), "assault module lacks charge analysis");
check(assault.includes("function resolveCloseCombat"), "assault module lacks close-combat resolution");
check(!/attacker\.soldiers\s*=/.test(assault), "assault module mutates attacker soldiers");
check(!/defender\.soldiers\s*=/.test(assault), "assault module mutates defender soldiers");
check(!/occupyBuilding\s*\(/.test(assault), "assault module commits building occupancy");
check(!/addLog\s*\(/.test(assault), "assault module writes combat logs");

check(runtime.includes("function create(dependencies)"), "combat runtime lacks an explicit factory boundary");
check(runtime.includes("function attemptOrder"), "Order Tests are not delegated by the combat runtime");
check(runtime.includes("function resolveShootingCore"), "shooting is not delegated by the combat runtime");
check(runtime.includes("analyzeAssault: assaultRules.analyzeAssault"), "assault analysis is not delegated by the combat runtime");
check(runtime.includes("function resolveCloseCombat"), "close combat is not delegated by the combat runtime");
check(runtime.includes("applyCasualties"), "combat runtime does not retain engine casualty commitment");
check(runtime.includes("occupyBuilding"), "combat runtime does not retain building commitment through an adapter");
check(runtime.includes("completeActivation"), "combat runtime does not retain activation commitment");
check(runtime.includes("window.CrossroadsCombatRuntime = Object.freeze({ create })"), "explicit combat runtime API is missing");
check(!runtime.includes("CrossroadsBattlefieldPresentation ="), "combat runtime still monkey-patches presentation");
check(!runtime.includes("CrossroadsCombatIntegration"), "combat runtime still exposes retired compatibility aliases");
check(runtime.includes("explicit-pure-rules-with-engine-commit-adapters"), "combat runtime diagnostic does not identify explicit adapters");

check(engine.includes("COMBAT_RUNTIME.create({"), "engine does not construct combat runtime explicitly");
check(engine.includes("BUILDING_OCCUPANCY.create({"), "engine does not construct building occupancy explicitly");
for (const legacyName of [
  "weaponRange", "isMMGTeam", "availableFireGroups", "commandSupport",
  "attemptOrder", "analyzeShot", "resolveShootingCore", "analyzeAssault",
  "resolveCloseCombat", "buildingInstance", "renderBuildingState"
]) {
  check(!new RegExp(`function\\s+${legacyName}\\s*\\(`).test(engine), `engine still contains legacy ${legacyName} implementation`);
}
check(building.includes("function create(dependencies)"), "building occupancy lacks one explicit controller factory");
check(building.includes("reconcileAfterUnitChange"), "building occupancy does not own custody cleanup");

check(validation.includes("CrossroadsMoraleRules"), "startup validation does not require morale rules");
check(validation.includes("CrossroadsShootingRules"), "startup validation does not require shooting rules");
check(validation.includes("CrossroadsAssaultRules"), "startup validation does not require assault rules");
check(validation.includes("CrossroadsCombatRuntime"), "startup validation does not require the combat runtime");
check(validation.includes("CrossroadsBuildingOccupancy"), "startup validation does not require building occupancy");

check(buildInfo.includes('engine: "Infantry Core"'), "build metadata no longer identifies the Infantry Core runtime");
check(buildInfo.includes('version: "S1.1.0"'), "build metadata lacks the canvas-first editor version");

if (failures.length) {
  console.error("FAIL — explicit combat ownership source audit", failures);
  process.exitCode = 1;
} else {
  console.log("PASS — combat and building ownership use explicit factories with no legacy engine implementations.");
}
