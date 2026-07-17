"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window: {}, console });
for (const file of ["data/terrain.js", "data/scenarios.js", "src/rules/terrain-geometry.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename:file });
}
const scenario = context.window.CROSSROADS_SCENARIOS.mokra;
const geometry = context.window.CrossroadsTerrainGeometry;
const terrain = geometry.setActiveScenario(scenario);
const collisionRadius = 1.6;
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
function assert(value, message) { if (!value) throw new Error(message); }
function zonesFor(faction) {
  const rootZone = scenario.deployment.zones[faction];
  return rootZone.subzones?.length ? rootZone.subzones : [rootZone];
}
function zoneFor(unit) {
  return zonesFor(unit.faction).find(zone => zone.id === unit.deploymentZone) || zonesFor(unit.faction)[0];
}
function insideZone(unit, zone) {
  return unit.x >= zone.xMin && unit.x <= zone.xMax && unit.y >= zone.yMin && unit.y <= zone.yMax;
}
const units = [
  ...scenario.forces.blue.map(unit => ({...unit,faction:"blue"})),
  ...scenario.forces.red.map(unit => ({...unit,faction:"red"}))
];

test("all units begin inside their named deployment zone", () => {
  for (const unit of units) assert(insideZone(unit, zoneFor(unit)), `${unit.id} outside ${unit.deploymentZone}`);
});

test("no unit begins inside an expanded impassable footprint", () => {
  const impassable = terrain.filter(piece => piece.rules.movement === "impassable");
  for (const unit of units) {
    for (const piece of impassable) {
      assert(!geometry.pointInside(unit, geometry.expand(piece, collisionRadius)), `${unit.id} overlaps ${piece.id}`);
    }
  }
});

test("starting units do not overlap one another", () => {
  for (let a=0; a<units.length; a+=1) for (let b=a+1; b<units.length; b+=1) {
    const dx=units[a].x-units[b].x, dy=units[a].y-units[b].y;
    assert(Math.hypot(dx,dy) >= 3.4, `${units[a].id} overlaps ${units[b].id}`);
  }
});

test("every unit has at least one nearby legal destination", () => {
  const impassable = terrain.filter(piece => piece.rules.movement === "impassable");
  const offsets = [[3,0],[-3,0],[0,3],[0,-3],[2.2,2.2],[-2.2,2.2],[2.2,-2.2],[-2.2,-2.2]];
  for (const unit of units) {
    const legal = offsets.some(([dx,dy]) => {
      const point={x:unit.x+dx,y:unit.y+dy};
      if (point.x < 0 || point.x > 72 || point.y < 0 || point.y > 48) return false;
      return !impassable.some(piece => geometry.pointInside(point, geometry.expand(piece, collisionRadius)));
    });
    assert(legal, `${unit.id} has no nearby legal move`);
  }
});

if (!process.exitCode) console.log(`Mokra deployment tests: ${passed}/4 passed.`);
