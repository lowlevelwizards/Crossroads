"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window:{} });
function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, { filename:relativePath });
}

context.window.CrossroadsScenarioVisibility = Object.freeze({ isVisible:item => item?.visible !== false && item?.hidden !== true });
context.window.CROSSROADS_TERRAIN_TYPES = Object.freeze({
  cottage:Object.freeze({ id:"cottage", family:"building", renderer:"building", rules:Object.freeze({ movement:"impassable", cover:"hard", los:"blocking", occupiable:true }), presentation:Object.freeze({ footprint:Object.freeze({ x:.1, y:.2, width:.8, height:.6 }) }) })
});
context.window.CROSSROADS_TERRAIN_PATCH_STYLES = Object.freeze({
  woods:Object.freeze({ id:"woods", family:"natural", label:"Woods", rules:Object.freeze({ movement:"rough", cover:"soft", los:"obscuring", defensivePosition:true }) })
});
context.window.CROSSROADS_LINEAR_TERRAIN_STYLES = Object.freeze({
  stream:Object.freeze({ id:"stream", renderer:"stream", family:"water", label:"Stream", width:2.5, rules:Object.freeze({ movement:"rough", cover:null, los:"clear", maxInfantryCrossingWidth:5, vehicleAccess:"none" }), presentation:Object.freeze({}) })
});

load("src/rules/terrain-semantics.js");
load("src/rules/terrain-spatial.js");
load("src/rules/path-geometry.js");
load("src/rules/linear-terrain.js");
load("src/rules/terrain-geometry.js");

const SEMANTICS = context.window.CrossroadsTerrainSemantics;
const SPATIAL = context.window.CrossroadsTerrainSpatial;
const GEOMETRY = context.window.CrossroadsTerrainGeometry;
const LINEAR = context.window.CrossroadsLinearTerrain;

const square = [{x:10,y:10},{x:30,y:10},{x:30,y:30},{x:10,y:30}];
const clip = SPATIAL.polygonClip({x:0,y:20},{x:40,y:20},square);
assert(clip, "a segment through a terrain polygon must produce a clip");
assert(Math.abs(clip.tEnter - .25) < 1e-8, "polygon clip must report the correct entry point");
assert(Math.abs(clip.tExit - .75) < 1e-8, "polygon clip must report the correct exit point");
assert(Math.abs(clip.insideFraction - .5) < 1e-8, "polygon clip must report distance spent inside terrain");
assert.strictEqual(SPATIAL.pointInPolygon({x:20,y:20}, square), true, "point-in-polygon must recognize interior points");
assert.strictEqual(SPATIAL.pointInPolygon({x:35,y:20}, square), false, "point-in-polygon must reject exterior points");

const normalStream = SEMANTICS.normalize(context.window.CROSSROADS_LINEAR_TERRAIN_STYLES.stream.rules, { width:4.5 });
const wideStream = SEMANTICS.normalize(context.window.CROSSROADS_LINEAR_TERRAIN_STYLES.stream.rules, { width:6 });
assert.strictEqual(normalStream.movement, "rough", "a narrow stream must preserve its crossing movement profile");
assert.strictEqual(wideStream.movement, "impassable", "a stream wider than its threshold must become impassable");
assert.strictEqual(wideStream.blocksMovement, true, "width-derived impassable terrain must block movement");

const scenario = {
  terrain:[{ id:"house", terrainId:"cottage", x:40, y:12, width:10, height:8 }],
  terrainPatches:[{ id:"wood-patch", styleId:"woods", points:square }],
  linearTerrain:[{ id:"wide-river", styleId:"stream", width:6, points:[{x:0,y:40,width:6},{x:72,y:40,width:6}] }]
};
const active = GEOMETRY.setActiveScenario(scenario);
const patch = active.find(item => item.id === "wood-patch");
assert(patch && patch.shape === "polygon", "polygon terrain patches must enter the shared gameplay geometry model");
assert.strictEqual(patch.rules.movement, "rough", "polygon terrain must inherit canonical terrain semantics");
assert(GEOMETRY.terrainAtPoint({x:20,y:20}).some(item => item.id === "wood-patch"), "terrainAtPoint must query polygon footprints");
assert(GEOMETRY.terrainCrossedBySegment({x:0,y:20},{x:40,y:20}).some(entry => entry.instance.id === "wood-patch"), "terrainCrossedBySegment must query polygon footprints");
assert(Math.abs(GEOMETRY.distanceInsideTerrain({x:0,y:20},{x:40,y:20},patch) - 20) < 1e-8, "distanceInsideTerrain must use polygon clipping");

const compiled = LINEAR.compileScenario(scenario);
assert(compiled.instances.length > 0, "semantic linear terrain must compile gameplay corridor instances");
assert(compiled.instances.every(instance => instance.rules.movement === "impassable"), "wide stream corridor instances must carry local width-derived semantics");
assert.strictEqual(GEOMETRY.rulesForTerrain(compiled.instances[0]).vehicleAccess, "none", "shared semantic queries must expose vehicle access");

const movementSource = fs.readFileSync(path.join(root, "src/rules/movement.js"), "utf8");
const shootingSource = fs.readFileSync(path.join(root, "src/rules/shooting.js"), "utf8");
const assaultSource = fs.readFileSync(path.join(root, "src/rules/assault.js"), "utf8");
const engineSource = fs.readFileSync(path.join(root, "src/engine.js"), "utf8");
const combatRuntimeSource = fs.readFileSync(path.join(root, "src/rules/combat-runtime.js"), "utf8");
assert(movementSource.includes("segmentTerrainClip"), "movement rules must accept shape-aware terrain clipping");
assert(movementSource.includes("blocksMovement"), "movement rules must honor canonical impassable terrain");
assert(shootingSource.includes("segmentTerrainClip"), "shooting rules must accept shape-aware terrain clipping");
assert(assaultSource.includes("segmentTerrainClip"), "assault rules must accept shape-aware terrain clipping");
assert(engineSource.includes("TERRAIN_GEOMETRY.segmentClip"), "engine movement integration must inject the shared geometry clipper");
assert(combatRuntimeSource.includes('requireFunction(dependencies, "segmentTerrainClip")'), "combat runtime must accept the shared geometry clipper explicitly");
assert(engineSource.includes("segmentTerrainClip: (start, end, instance)"), "engine must inject the shared geometry clipper into combat runtime");

console.log("PASS — E1.5 polygon geometry, width-aware terrain semantics, shared spatial queries, and combat-rule integration checks passed.");
