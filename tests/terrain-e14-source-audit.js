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
  "src/presentation/terrain-patches.js"
];
for (const script of sharedScripts) {
  assert(editorHtml.includes(script), `editor must load ${script}`);
  assert(indexHtml.includes(script), `game must load ${script}`);
}
assert(editorHtml.includes("src/editor/editor-state.js"), "editor state boundary must load");
assert(editorHtml.includes("src/editor/editor-selection.js"), "editor selection boundary must load");
assert(editorHtml.includes("src/editor/editor-tools.js"), "editor tool boundary must load");
assert(editorSource.includes("SELECTION.sameObject"), "controller must delegate object selection comparison");
assert(!editorSource.includes("function sameGroup"), "superseded selection wrapper must be removed");
assert(editorSource.includes("Lock object on battlefield"), "locking must be exposed in the inspector");
assert(editorSource.includes("mutateGroup"), "object-browser groups must support locking");
assert(patchSource.includes("WOODLAND.generate(patch)"), "patch runtime must use deterministic woodland generation");
assert(!patchSource.includes("woods-tree-dot"), "legacy dot-fill woodland output must not remain");
assert(buildInfo.includes('version: "E1.4.1"'), "build metadata must identify E1.4.1");
assert(buildInfo.includes('codename: "Procedural Terrain Containers"'), "build codename must match the release");
assert(fs.existsSync(path.join(root, "tests/woodland-visual-fixture.html")), "woodland visual fixture must be packaged");

console.log("PASS — Terrain Editor E1.4.1 schema, modular editor boundary, shared woodland runtime, locking, and fixture source audit passed.");
