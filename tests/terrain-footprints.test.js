"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window: {}, console });
for (const file of ["data/terrain.js", "src/rules/terrain-geometry.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const types = context.window.CROSSROADS_TERRAIN_TYPES;
const geometry = context.window.CrossroadsTerrainGeometry;
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
function assert(value, message) { if (!value) throw new Error(message); }

test("building definitions expose normalized footprints", () => {
  for (const id of ["small_cottage","medium_cottage","long_farmhouse","barn","shed","church"]) {
    const fp = types[id].presentation.footprint;
    assert(fp && fp.width < 1 && fp.height < 1, `${id} footprint is not inset`);
  }
});

test("visual dimensions remain available while rules dimensions shrink", () => {
  const scenario = { terrain:[{ id:"church", terrainId:"church", x:10, y:10, width:12, height:10 }] };
  const [church] = geometry.setActiveScenario(scenario);
  assert(church.visualRect.width === 12 && church.visualRect.height === 10, "visual rect changed");
  assert(church.width < 12 && church.height < 10, "rules rect did not shrink");
});

test("roof margin is walkable but wall body remains blocked", () => {
  const scenario = { terrain:[{ id:"church", terrainId:"church", x:10, y:10, width:12, height:10 }] };
  const [church] = geometry.setActiveScenario(scenario);
  assert(!geometry.pointInside({x:10.4,y:10.5}, church), "roof margin should be outside footprint");
  assert(geometry.pointInside({x:16,y:16}, church), "wall body should be inside footprint");
});

test("new route and field pieces are registered", () => {
  for (const id of ["road_t","road_end","stream_curve","stream_end","field_tilled","field_wheat","field_cabbage"]) {
    assert(types[id], `${id} missing`);
  }
});

if (!process.exitCode) console.log(`Terrain footprint tests: ${passed}/4 passed.`);
