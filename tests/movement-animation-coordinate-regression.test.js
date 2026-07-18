"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const effects = fs.readFileSync(path.join(root, "src/presentation/effects.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "src/engine.js"), "utf8");

assert.match(
  effects,
  /getTableSize\s*=\s*null/,
  "Movement presentation must accept a dynamic table-size lookup."
);
assert.match(
  effects,
  /function currentTableSize\(\)/,
  "Movement presentation must resolve the active scenario dimensions at animation time."
);
assert.match(
  effects,
  /\(from\.x - to\.x\) \/ table\.width\) \* battlefield\.offsetWidth/,
  "Horizontal movement inverse must be calculated in board-local coordinates."
);
assert.match(
  effects,
  /\(from\.y - to\.y\) \/ table\.height\) \* battlefield\.offsetHeight/,
  "Vertical movement inverse must be calculated in board-local coordinates."
);
assert.doesNotMatch(
  effects,
  /screenDeltaBetweenRects\(/,
  "A screen-space delta must not be applied as a transform inside a rotated board."
);
assert.match(
  engine,
  /getTableSize:\s*\(\)\s*=>\s*\(\{[\s\S]*?width:\s*RULES\.tableWidth,[\s\S]*?height:\s*RULES\.tableHeight/,
  "The engine must provide the current scenario dimensions to movement presentation."
);

console.log("movement-animation-coordinate-regression.test.js passed");
