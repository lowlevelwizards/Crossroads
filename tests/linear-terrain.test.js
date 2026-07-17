"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window:{} , console });
for (const file of ["data/linear-terrain.js","src/rules/path-geometry.js","src/rules/linear-terrain.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"), context, { filename:file });
}
const G = context.window.CrossroadsPathGeometry;
const L = context.window.CrossroadsLinearTerrain;
let passed = 0;
function test(name, fn){ fn(); passed += 1; console.log(`PASS ${name}`); }

test("creates a path from waypoints",()=>{ const p=G.createPath({id:"a",points:[{x:0,y:0},{x:10,y:0}]}); assert.equal(p.length,10); });
test("samples fixed path spacing",()=>{ const p=G.createPath({id:"a",points:[{x:0,y:0},{x:10,y:0}]}); assert.equal(G.samplePath(p,2).length,6); });
test("returns tangent and normal",()=>{ const p=G.createPath({id:"a",points:[{x:0,y:0},{x:10,y:0}]}); const s=G.sampleAt(p,5); assert(Math.abs(s.tangent.x-1)<1e-6); assert(Math.abs(s.normal.y-1)<1e-6); });
test("finds path intersections",()=>{ const a=G.createPath({id:"a",points:[{x:0,y:5},{x:10,y:5}]}); const b=G.createPath({id:"b",points:[{x:5,y:0},{x:5,y:10}]}); assert.equal(G.pathIntersections(a,b).length,1); });
test("smooth paths preserve endpoints",()=>{ const p=G.createPath({id:"a",smoothing:.7,points:[{x:0,y:0},{x:5,y:4},{x:10,y:0}]}); assert.equal(p.points[0].x,0); assert.equal(p.points[p.points.length-1].x,10); });
test("open roads create no rules rectangles",()=>{ const c=L.compilePath({id:"r",styleId:"dirt_road",points:[{x:0,y:0},{x:10,y:0}]}); assert.equal(c.instances.length,0); });
test("streams create gameplay corridor rectangles",()=>{ const c=L.compilePath({id:"s",styleId:"stream",points:[{x:0,y:0},{x:10,y:0}]}); assert(c.instances.length>1); assert.equal(c.instances[0].rules.movement,"rough"); });
test("railway corridors retain crossing rules",()=>{ const c=L.compilePath({id:"rr",styleId:"railway_embankment",points:[{x:0,y:0},{x:0,y:10}]}); assert.equal(c.instances[0].rules.cover,"hard"); });
test("unknown style fails loudly",()=>{ assert.throws(()=>L.compilePath({id:"bad",styleId:"missing",points:[{x:0,y:0},{x:1,y:1}]})); });
test("scenario compiler combines paths",()=>{ const c=L.compileScenario({linearTerrain:[{id:"s",styleId:"stream",points:[{x:0,y:0},{x:4,y:0}]},{id:"h",styleId:"hedge",points:[{x:0,y:1},{x:4,y:1}]}]}); assert.equal(c.paths.length,2); assert(c.instances.length>2); });
console.log(`${passed}/10 linear-terrain tests passed.`);
