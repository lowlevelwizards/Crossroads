"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root,"index.html"),"utf8");
const scenarios = fs.readFileSync(path.join(root,"data/scenarios.js"),"utf8");
const terrain = fs.readFileSync(path.join(root,"data/terrain.js"),"utf8");
const runtime = fs.readFileSync(path.join(root,"src/scenario-runtime/scenario-runtime.js"),"utf8");
const order = [
  "data/scenarios.js",
  "src/scenario/scenario-schema.js",
  "src/rules/objectives/objective-registry.js",
  "src/scenario-runtime/scenario-compiler.js",
  "src/scenario-runtime/scenario-runtime.js",
  "src/presentation/terrain.js",
  "src/infrastructure/startup-validation.js",
  "src/engine.js"
];
for (let i=1;i<order.length;i++) assert(index.indexOf(order[i-1]) < index.indexOf(order[i]), `Bad load order: ${order[i-1]} before ${order[i]}`);
assert(index.includes("selectScenario('mokra')"));
assert(scenarios.includes('type:"control_group"'));
assert(scenarios.includes('deploymentZone:"forward"'));
assert(scenarios.includes('id:"mokra_breakthrough"'));
assert(terrain.includes('rail_embankment'));
assert(!runtime.includes('scenarioIsMokra'));
assert(!runtime.includes('activeScenario.id === "mokra"'));
console.log("Mokra source audit: 9/9 passed");
