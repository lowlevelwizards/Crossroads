"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const editorHtml = read("editor.html");
const indexHtml = read("index.html");
const editorSource = read("src/editor/editor.js");
const patchSource = read("src/presentation/terrain-patches.js");
const buildInfo = read("data/build-info.js");

const sharedScripts = [
  "src/scenario/scenario-visibility.js",
  "src/scenario/scenario-migrations.js",
  "src/scenario/scenario-schema.js",
  "src/generation/seeded-random.js",
  "src/generation/polygon-geometry.js",
  "src/generation/polygon-scatter.js",
  "src/generation/row-generator.js",
  "src/generation/woodland-generator.js",
  "src/presentation/woodland-trees.js",
  "src/presentation/terrain-patches.js",
  "src/rules/terrain-semantics.js",
  "src/rules/terrain-spatial.js"
];
for (const script of sharedScripts) {
  assert(editorHtml.includes(script), `editor must load ${script}`);
  assert(indexHtml.includes(script), `game must load ${script}`);
}
assert(editorHtml.includes("src/editor/editor-state.js"), "editor state boundary must load");
assert(editorHtml.includes("src/editor/editor-selection.js"), "editor selection boundary must load");
assert(editorHtml.includes("src/editor/editor-tools.js"), "editor tool boundary must load");
assert(editorHtml.includes("src/editor/editor-multiselect.js"), "editor multi-selection boundary must load");
assert(editorSource.includes("SELECTION.sameObject"), "controller must delegate object selection comparison");
assert(!editorSource.includes("function sameGroup"), "superseded selection wrapper must be removed");
assert(editorSource.includes("Lock object on battlefield"), "locking must be exposed in the inspector");
assert(editorSource.includes("mutateGroup"), "object-browser groups must support locking");
assert(patchSource.includes("WOODLAND.generate(patch)"), "patch runtime must use deterministic woodland generation");
assert(!patchSource.includes("woods-tree-dot"), "legacy dot-fill woodland output must not remain");
assert(buildInfo.includes('version: "S1.0.1"'), "build metadata must identify Scenario Runtime S1.0.1");
assert(buildInfo.includes('codename: "Release Integrity & Coordinator Cleanup"'), "build codename must match the release");
assert(fs.existsSync(path.join(root, "tests/woodland-visual-fixture.html")), "woodland visual fixture must be packaged");


const semanticsSource = fs.readFileSync(path.join(root, "src/rules/terrain-semantics.js"), "utf8");
const spatialSource = fs.readFileSync(path.join(root, "src/rules/terrain-spatial.js"), "utf8");
const multiSource = fs.readFileSync(path.join(root, "src/editor/editor-multiselect.js"), "utf8");
assert(semanticsSource.includes("CrossroadsTerrainSemantics"), "E1.5 must expose canonical terrain semantics");
assert(spatialSource.includes("polygonClip"), "E1.5 must expose polygon spatial clipping");
assert(multiSource.includes("unionBounds"), "E1.5 must expose collective selection geometry");

console.log("PASS — Scenario Runtime S1.0 preserves the E1.5 editor, woodland, depth, and terrain-semantics foundations.");
