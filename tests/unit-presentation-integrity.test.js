"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window:{} });

vm.runInContext(
  fs.readFileSync(path.join(root, "src/presentation/layer-policy.js"), "utf8"),
  context,
  { filename:"src/presentation/layer-policy.js" }
);
vm.runInContext(
  fs.readFileSync(path.join(root, "src/presentation/formation-geometry.js"), "utf8"),
  context,
  { filename:"src/presentation/formation-geometry.js" }
);

const layers = context.window.CrossroadsLayerPolicy;
const geometry = context.window.CrossroadsFormationGeometry;

const terrainSamples = [
  layers.terrainLayer({ y:47, height:10 }, { renderer:"building", presentation:{ depthAnchor:.82 } }, 48),
  layers.buildingForegroundLayer({ y:47, height:10 }, { renderer:"building", presentation:{ depthAnchor:.82 } }, 48),
  layers.woodlandCanopyLayer({ inheritLayer:true }, 48, 48),
  layers.fragmentLayer(6999, "canopy")
];
const unitSamples = [
  layers.unitLayer({ y:0 }, 48),
  layers.unitLayer({ y:24 }, 48),
  layers.unitLayer({ y:48 }, 48)
];

assert(Math.min(...unitSamples) > Math.max(...terrainSamples), "all units must render above every terrain fragment");
assert(Math.max(...unitSamples) < layers.BANDS.objective, "units must remain below objective and interaction overlays");

assert.strictEqual(geometry.facingFromScreenDelta(20, 1, "up"), "right");
assert.strictEqual(geometry.facingFromScreenDelta(-20, 1, "up"), "left");
assert.strictEqual(geometry.facingFromScreenDelta(1, 20, "left"), "down");
assert.strictEqual(geometry.facingFromScreenDelta(1, -20, "left"), "up");
assert.strictEqual(geometry.facingFromScreenDelta(0.1, 0.1, "left"), "left");

const effects = fs.readFileSync(path.join(root, "src/presentation/effects.js"), "utf8");
assert(effects.includes("facingFromScreenDelta"), "movement presentation must derive facing from measured screen displacement");
assert(effects.includes("-inverse.x") && effects.includes("-inverse.y"), "measured movement must use actual end-minus-start screen direction");

console.log("PASS — units occupy a terrain-safe presentation band and movement facing follows actual screen displacement.");
