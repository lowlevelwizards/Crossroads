"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const enginePath = path.resolve(__dirname, "..", "src", "engine.js");
const source = fs.readFileSync(enginePath, "utf8");

function indexOfOrFail(fragment, label) {
  const index = source.indexOf(fragment);
  assert(index >= 0, `engine.js is missing ${label}`);
  return index;
}

const movementComposition = indexOfOrFail(
  "const movementRules = window.CrossroadsMovementRules.create({",
  "movement runtime composition"
);
const movementDependency = indexOfOrFail(
  "const {\n      analyzeMovementPath,",
  "movement dependency destructuring"
);
const buildingComposition = indexOfOrFail(
  "const buildingOccupancy = BUILDING_OCCUPANCY.create({",
  "building occupancy composition"
);
const combatComposition = indexOfOrFail(
  "const combatRuntime = COMBAT_RUNTIME.create({",
  "combat runtime composition"
);

assert(
  movementComposition < movementDependency,
  "movement runtime must be created before its dependencies are destructured"
);
assert(
  movementDependency < buildingComposition,
  "analyzeMovementPath must be initialized before building occupancy receives it"
);
assert(
  movementDependency < combatComposition,
  "analyzeMovementPath must be initialized before combat runtime receives it"
);

console.log(
  "PASS — engine runtime dependencies are initialized before building and combat composition."
);
