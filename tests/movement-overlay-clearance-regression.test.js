"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles", "stabilization.css"), "utf8");
const engine = fs.readFileSync(path.join(root, "src", "engine.js"), "utf8");
const movement = fs.readFileSync(path.join(root, "src", "rules", "movement.js"), "utf8");

assert.match(css, /#routeLayer\s*\{[\s\S]*position:absolute!important;[\s\S]*inset:0!important;/i,
  "route overlay must establish a positioned top-level stacking layer");
assert.match(css, /#routeLayer[^\n]*z-index:7600!important/i,
  "route overlay must sit above promoted terrain and patches");
assert.match(css, /#routeLayer \.route-line\s*\{[\s\S]*position:absolute!important;[\s\S]*transform-origin:0 50%!important;/i,
  "route segments must be positioned inside the overlay and rotate from their start point");
assert.match(engine, /buildingCollisionClearance:\s*0\.55/,
  "engine should use a small building-body clearance rather than the full formation radius");
assert.match(engine, /function destinationOverlapsBuilding\(point\)/,
  "all deployment checks should share the same building footprint helper");
assert.doesNotMatch(engine, /expandRect\(instance, RULES\.unitCollisionRadius\)/,
  "deployment must not inflate buildings by the full unit formation radius");
assert.match(movement, /rules\.buildingCollisionClearance/,
  "movement path collision must use the building clearance rule");
assert.doesNotMatch(movement, /expandRect\(building, rules\.unitCollisionRadius\)/,
  "movement paths must not inflate buildings by the full formation radius");

console.log("movement overlay and building-clearance regression checks passed");
