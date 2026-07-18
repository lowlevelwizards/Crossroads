"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
function fakeElement() {
  const classes = new Set();
  return {
    children:[], dataset:{}, attributes:{}, className:"",
    classList:{ add(...values) { values.forEach(value => classes.add(value)); }, contains(value) { return classes.has(value); } },
    style:{ values:{}, setProperty(key, value) { this.values[key] = String(value); }, getPropertyValue(key) { return this.values[key] || ""; } },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    appendChild(child) { this.children.push(child); return child; }
  };
}
const context = vm.createContext({ console, window:{}, document:{ createElement:fakeElement } });
function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, { filename:relativePath });
}

load("src/presentation/layer-policy.js");
load("src/generation/seeded-random.js");
load("src/generation/polygon-geometry.js");
load("src/generation/polygon-scatter.js");
load("src/generation/row-generator.js");
load("src/generation/woodland-generator.js");
load("src/presentation/woodland-trees.js");

const GENERATOR = context.window.CrossroadsWoodlandGenerator;
const POLYGON = context.window.CrossroadsPolygonGeometry;
const points = [{x:5,y:5},{x:25,y:4},{x:30,y:15},{x:24,y:27},{x:7,y:25},{x:3,y:14}];
const patch = {
  id:"test-woods",
  styleId:"woods",
  points,
  generator:{ seed:1234, density:.8, spacing:2.4, edgePadding:.8, scaleVariation:.12, rotationVariation:10 }
};

const first = GENERATOR.generate(patch);
const second = GENERATOR.generate(JSON.parse(JSON.stringify(patch)));
assert.deepStrictEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)), "same seed and polygon must generate the same woodland");
assert(first.length > 10, "woodland fixture should generate a useful number of trees");
assert(first.every(tree => POLYGON.contains(points, tree)), "every generated tree center must remain inside the polygon");
assert(first.every(tree => POLYGON.distanceToEdge(points, tree) >= .8 - 1e-8), "edge padding must be respected");

const changedSeed = GENERATOR.generate({ ...patch, generator:{ ...patch.generator, seed:1235 } });
assert.notDeepStrictEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(changedSeed)), "rerolling the seed must change the layout");

const dense = GENERATOR.generate({ ...patch, styleId:"woods_dense", generator:{ ...patch.generator, density:1, spacing:1.8 } });
assert(dense.length > first.length, "dense woods should generate more trees than standard woods");

const orchard = GENERATOR.generate({ ...patch, styleId:"orchard", generator:{ ...patch.generator, spacing:3, rowSpacing:3, rowAngle:15, rotationVariation:0 } });
assert(orchard.length > 0, "orchard generator should create clipped rows");
assert(orchard.every(tree => tree.rotation === 0), "orchard trees should remain consistently oriented");


const fixtureParent = fakeElement();
const treeFragments = context.window.CrossroadsWoodlandTreePresentation.createTableTreeFragments(
  fixtureParent,
  { id:"layer-tree", x:12, y:24, scale:1, rotation:0, preset:"balanced" },
  { width:72, height:48 },
  { id:"layer-patch", styleId:"woods", material:"temperate", inheritLayer:true }
);
const sharedDepth = context.window.CrossroadsLayerPolicy.depthFromTableY(24, 48);
assert.strictEqual(Number(treeFragments.body.style.zIndex), sharedDepth, "generated tree bodies must use the same table-Y depth contract as units");
assert(Number(treeFragments.canopy.style.zIndex) > Number(treeFragments.body.style.zIndex), "generated tree canopies must render above their body fragments");
assert(treeFragments.body.classList.contains("woodland-tree-body"), "body fragment must be explicitly identifiable");
assert(treeFragments.canopy.classList.contains("woodland-tree-canopy"), "canopy fragment must be explicitly identifiable");
assert.strictEqual(context.window.CrossroadsLayerPolicy.unitLayer({ y:24 }, 48), sharedDepth, "units and generated tree bodies must share the depth band");
const manualTree = context.window.CrossroadsWoodlandTreePresentation.createTableTreeFragments(
  fakeElement(),
  { id:"manual-tree", x:12, y:24, scale:1, rotation:0, preset:"balanced" },
  { width:72, height:48 },
  { id:"manual-patch", styleId:"woods", inheritLayer:false, layerOrder:640 }
);
assert.strictEqual(Number(manualTree.body.style.zIndex), 641, "manual patch layering must move its generated tree body with the patch");
assert(Number(manualTree.canopy.style.zIndex) > Number(manualTree.body.style.zIndex), "manual patch canopy must preserve its fragment offset");

const source = fs.readFileSync(path.join(root, "src/presentation/terrain-patches.js"), "utf8");
assert(source.includes("WOODLAND.generate(patch)"), "runtime patch presentation must use the shared woodland generator");
assert(!source.includes("style.id === \"woods\" || style.id === \"woods_dense\""), "legacy repeating-circle woodland pattern logic must be removed");

const fixtureHtml = fs.readFileSync(path.join(root, "tests/woodland-visual-fixture.html"), "utf8");
assert(fixtureHtml.includes("fixture-woods") && fixtureHtml.includes("fixture-dense") && fixtureHtml.includes("fixture-orchard"), "visual fixture must cover all three woodland generators");
assert(fixtureHtml.includes("CrossroadsLayerPolicy.unitLayer"), "visual fixture must exercise unit/tree depth ordering");
console.log("PASS — deterministic woodland, dense woods, orchard rows, edge padding, shared body/canopy runtime generation, and layering fixture checks passed.");
