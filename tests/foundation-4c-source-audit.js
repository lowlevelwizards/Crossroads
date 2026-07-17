"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

const index = read("index.html");
const morale = read("src/rules/morale.js");
const shooting = read("src/rules/shooting.js");
const assault = read("src/rules/assault.js");
const runtime = read("src/rules/combat-runtime.js");
const validation = read("src/infrastructure/startup-validation.js");
const buildInfo = read("data/build-info.js");

const order = [
  "src/rules/morale.js",
  "src/rules/shooting.js",
  "src/rules/assault.js",
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

check(runtime.includes("function installCombatRules"), "combat runtime lacks one installation boundary");
check(runtime.includes("attemptOrder = function attemptOrderWithMoraleRules"), "Order Tests are not delegated by the permanent runtime");
check(runtime.includes("resolveShootingCore = function resolveShootingWithPureRules"), "shooting is not delegated by the permanent runtime");
check(runtime.includes("analyzeAssault = assaultRules.analyzeAssault"), "assault analysis is not delegated by the permanent runtime");
check(runtime.includes("resolveCloseCombat = function resolveCloseCombatWithPureRules"), "close combat is not delegated by the permanent runtime");
check(runtime.includes("applyCasualties"), "combat runtime does not retain engine casualty commitment");
check(runtime.includes("occupyBuilding"), "combat runtime does not retain engine building commitment");
check(runtime.includes("completeActivation"), "combat runtime does not retain activation commitment");
check(runtime.includes("window.CrossroadsCombatRuntime"), "permanent combat runtime API is missing");
check(runtime.includes('stage: "Foundation 4C"'), "combat runtime diagnostic has the wrong build stage");

check(validation.includes("CrossroadsMoraleRules"), "startup validation does not require morale rules");
check(validation.includes("CrossroadsShootingRules"), "startup validation does not require shooting rules");
check(validation.includes("CrossroadsAssaultRules"), "startup validation does not require assault rules");
check(validation.includes("CrossroadsCombatRuntime"), "startup validation does not require the permanent runtime");
check(!validation.includes('"CrossroadsCombatIntegration", "src/rules/shooting-integration.js"'), "startup validation still requires the temporary shooting seam");
check(!validation.includes('"CrossroadsAssaultIntegration", "src/rules/assault-integration.js"'), "startup validation still requires the temporary assault seam");

check(buildInfo.includes('version: "Foundation 4C"'), "build metadata was not advanced to Foundation 4C");
check(buildInfo.includes('codename: "Combat Foundation Lock"'), "build codename is incorrect");

if (failures.length) {
  console.error("FAIL — Foundation 4C source audit", failures);
  process.exitCode = 1;
} else {
  console.log("PASS — Foundation 4C combat ownership and permanent load order are valid.");
}
