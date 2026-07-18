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

const order = [
  "src/rules/morale.js",
  "src/rules/shooting.js",
  "src/rules/assault.js",
  "src/rules/combat-runtime.js",
  "src/infrastructure/startup-validation.js",
  "src/engine.js"
].map(value => index.indexOf(value));

check(order.every(position => position >= 0), "one or more combat scripts are missing from index.html");
check(order.every((position, i) => i === 0 || position > order[i - 1]), "combat script load order is incorrect");

check(morale.includes("analyzeOrderTest"), "morale module lacks Order Test analysis");
check(morale.includes("resolveOrderTest"), "morale module lacks Order Test resolution");
check(morale.includes("findCommandSupport"), "morale module lacks officer support analysis");
check(morale.includes("analyzeIncomingPins"), "morale module lacks incoming-Pin analysis");
check(!/unit\.pins\s*[+-]?=/.test(morale), "morale module mutates unit Pins");
check(!/unit\.down\s*=/.test(morale), "morale module mutates Down state");

check(shooting.includes("analyzeIncomingPins"), "shooting does not depend on morale Pin analysis");
check(shooting.includes("const pinImpact = analyzeIncomingPins"), "shooting still calculates routing internally");
check(runtime.includes("function attemptOrder"), "runtime Order Tests are not delegated");
check(runtime.includes("function resolveShootingCore"), "runtime shooting is not delegated");
check(runtime.includes("function commandSupport"), "runtime command support is not delegated");

check(assault.includes("function analyzeAssault"), "assault module lacks charge analysis");
check(assault.includes("function resolveCloseCombat"), "assault module lacks close-combat resolution");
check(assault.includes("defender-first"), "assault module lacks Defensive Position sequencing");
check(assault.includes("simultaneous"), "assault module lacks simultaneous combat sequencing");
check(!/attacker\.soldiers\s*=/.test(assault), "assault module mutates attacker soldiers");
check(!/defender\.soldiers\s*=/.test(assault), "assault module mutates defender soldiers");
check(!/\.x\s*=/.test(assault), "assault module mutates unit position");
check(!/occupyBuilding\s*\(/.test(assault), "assault module commits building occupancy");
check(!/addLog\s*\(/.test(assault), "assault module writes combat logs");

check(runtime.includes("analyzeAssault: assaultRules.analyzeAssault"), "runtime assault analysis is not delegated");
check(runtime.includes("function resolveCloseCombat"), "runtime close combat is not delegated");
check(runtime.includes("applyCasualties"), "combat runtime does not retain engine casualty commitment");
check(runtime.includes("occupyBuilding"), "combat runtime does not retain engine building commitment");
check(runtime.includes("completeActivation"), "combat runtime does not retain activation commitment");
check(runtime.includes("window.CrossroadsCombatRuntime"), "explicit combat runtime API is missing");

check(validation.includes("CrossroadsMoraleRules"), "startup validation does not require morale rules");
check(validation.includes("CrossroadsShootingRules"), "startup validation does not require shooting rules");
check(validation.includes("CrossroadsAssaultRules"), "startup validation does not require assault rules");
check(validation.includes("CrossroadsCombatRuntime"), "startup validation does not require permanent combat runtime");

if (failures.length) {
  console.error("FAIL — Foundation 4B.2 source audit", failures);
  process.exitCode = 1;
} else {
  console.log("PASS — Foundation 4B.2 behavior remains owned by the permanent combat runtime and pure rule modules.");
}
