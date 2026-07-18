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
const runtime = read("src/rules/combat-runtime.js");
const validation = read("src/infrastructure/startup-validation.js");

const order = [
  "src/rules/morale.js",
  "src/rules/shooting.js",
  "src/rules/combat-runtime.js",
  "src/infrastructure/startup-validation.js",
  "src/engine.js"
].map(value => index.indexOf(value));

check(order.every(position => position >= 0), "one or more combat scripts are missing from index.html");
check(order.every((position, index) => index === 0 || position > order[index - 1]), "combat script load order is incorrect");
check(morale.includes("analyzeOrderTest"), "morale module lacks Order Test analysis");
check(morale.includes("resolveOrderTest"), "morale module lacks Order Test resolution");
check(morale.includes("findCommandSupport"), "morale module lacks officer support analysis");
check(morale.includes("analyzeIncomingPins"), "morale module lacks incoming-Pin analysis");
check(!/unit\.pins\s*[+-]?=/.test(morale), "morale module mutates unit Pins");
check(!/unit\.down\s*=/.test(morale), "morale module mutates Down state");
check(shooting.includes("analyzeIncomingPins"), "shooting does not depend on morale Pin analysis");
check(shooting.includes("const pinImpact = analyzeIncomingPins"), "shooting still calculates routing internally");
check(runtime.includes("attemptOrder = function attemptOrderWithMoraleRules"), "runtime Order Tests are not delegated");
check(runtime.includes("resolveShootingCore = function resolveShootingWithPureRules"), "runtime shooting is not delegated");
check(runtime.includes("commandSupport = function commandSupportWithMoraleRules"), "runtime command support is not delegated");
check(runtime.includes("window.CrossroadsCombatRuntime"), "permanent combat runtime diagnostic is missing");
check(validation.includes("CrossroadsMoraleRules"), "startup validation does not require morale rules");
check(validation.includes("CrossroadsShootingRules"), "startup validation does not require shooting rules");
check(validation.includes("CrossroadsCombatRuntime"), "startup validation does not require permanent combat runtime");

if (failures.length) {
  console.error("FAIL — Foundation 4B.1 source audit", failures);
  process.exitCode = 1;
} else {
  console.log("PASS — Foundation 4B.1 behavior remains owned by the permanent combat runtime and pure rule modules.");
}
