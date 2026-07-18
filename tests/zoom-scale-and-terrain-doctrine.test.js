"use strict";
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const stabilization = fs.readFileSync("styles/stabilization.css", "utf8");
assert.match(stabilization, /unit-representation-medium[\s\S]*unit-representation-close[\s\S]*--unit-visual-scale:\.86!important/);

const context = { window:{} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("data/terrain.js", "utf8"), context);
const types = context.window.CROSSROADS_TERRAIN_TYPES;
const patches = context.window.CROSSROADS_TERRAIN_PATCH_STYLES;

assert.equal(types.field_wheat.rules.movement, "open");
assert.equal(types.orchard.rules.movement, "open");
assert.equal(types.fence_wood.rules.crossingCost, 1);
assert.equal(types.hedge.rules.crossingCost, 1);
assert.equal(types.wall.rules.crossingCost, 2);
assert.equal(types.woods.rules.movementMultiplier, 1.5);
assert.equal(types.woods_dense.rules.movementMultiplier, 2);
assert.equal(patches.mud.rules.movementMultiplier, 1.5);
console.log("zoom scale and terrain doctrine regression: ok");
