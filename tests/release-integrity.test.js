"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "release-manifest.json"), "utf8"));
const entryPoints = manifest.entryPoints ?? [];
const retiredFiles = [
  "main.css",
  "src/infrastructure/Infrastructurd",
  "src/input/Input",
  "src/rules/shooting-integration.js",
  "src/rules/assault-integration.js",
  "src/rules/scenario-runtime.js"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function localReferences(html) {
  const references = [];
  const pattern = /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const reference = match[2];
    if (/^(?:https?:|data:|blob:|#)/i.test(reference)) continue;
    references.push(reference);
  }
  return references;
}

function cleanReference(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function queryVersion(reference) {
  const match = reference.match(/[?&]v=([^&#]+)/);
  return match?.[1] ?? null;
}

function rootRelativeReference(htmlPath, reference) {
  const baseDirectory = path.dirname(path.join(root, htmlPath));
  return path.relative(root, path.resolve(baseDirectory, cleanReference(reference)))
    .split(path.sep)
    .join("/");
}

function scriptOrder(htmlPath) {
  return localReferences(read(htmlPath))
    .filter(reference => cleanReference(reference).endsWith(".js"))
    .map(reference => rootRelativeReference(htmlPath, reference));
}

function assertOrdered(htmlPath, before, after) {
  const order = scriptOrder(htmlPath);
  const beforeIndex = order.indexOf(before);
  const afterIndex = order.indexOf(after);
  assert(beforeIndex >= 0, `${htmlPath} is missing ${before}`);
  assert(afterIndex >= 0, `${htmlPath} is missing ${after}`);
  assert(beforeIndex < afterIndex, `${htmlPath} must load ${before} before ${after}`);
}

for (const requiredFile of manifest.requiredFiles ?? []) {
  assert(fs.existsSync(path.join(root, requiredFile)), `Missing required release file: ${requiredFile}`);
}

for (const htmlPath of entryPoints) {
  const absoluteHtml = path.join(root, htmlPath);
  assert(fs.existsSync(absoluteHtml), `Missing entry point: ${htmlPath}`);
  const html = fs.readFileSync(absoluteHtml, "utf8");
  const baseDirectory = path.dirname(absoluteHtml);
  const seen = new Set();

  for (const reference of localReferences(html)) {
    const clean = cleanReference(reference);
    const resolved = path.resolve(baseDirectory, clean);
    assert(
      fs.existsSync(resolved),
      `${htmlPath} references missing local resource: ${reference}`
    );
    assert(!seen.has(clean), `${htmlPath} loads ${clean} more than once`);
    seen.add(clean);

    if (/\.(?:js|css)$/i.test(clean)) {
      assert.strictEqual(
        queryVersion(reference),
        manifest.cacheVersion,
        `${htmlPath} must use cache token v=${manifest.cacheVersion} for ${clean}`
      );
    }
  }
}

for (const retiredFile of retiredFiles) {
  assert(!fs.existsSync(path.join(root, retiredFile)), `Retired file still exists: ${retiredFile}`);
  for (const htmlPath of entryPoints) {
    const loaded = localReferences(read(htmlPath))
      .map(reference => rootRelativeReference(htmlPath, reference));
    assert(!loaded.includes(retiredFile), `${htmlPath} still loads retired file ${retiredFile}`);
  }
}

assertOrdered("index.html", "data/build-info.js", "src/engine.js");
assertOrdered("index.html", "src/scenario/scenario-schema.js", "src/scenario-runtime/scenario-compiler.js");
assertOrdered("index.html", "src/rules/morale.js", "src/rules/combat-runtime.js");
assertOrdered("index.html", "src/rules/shooting.js", "src/rules/combat-runtime.js");
assertOrdered("index.html", "src/rules/assault.js", "src/rules/combat-runtime.js");
assertOrdered("index.html", "src/runtime/building-occupancy.js", "src/rules/combat-runtime.js");
assertOrdered("index.html", "src/rules/combat-runtime.js", "src/infrastructure/startup-validation.js");
assertOrdered("index.html", "src/infrastructure/startup-validation.js", "src/engine.js");
assertOrdered("editor.html", "data/build-info.js", "src/editor/editor.js");
assertOrdered("editor.html", "src/scenario/scenario-schema.js", "src/editor/editor-validation.js");
assertOrdered("editor.html", "src/editor/editor-multiselect.js", "src/editor/editor.js");
assertOrdered("editor.html", "src/editor/editor-persistence.js", "src/editor/editor-shell.js");
assertOrdered("editor.html", "src/editor/editor-shell.js", "src/editor/editor.js");
assertOrdered("tests/startup-smoke.html", "src/runtime/building-occupancy.js", "src/infrastructure/startup-validation.js");

const buildContext = vm.createContext({ window: {} });
vm.runInContext(read("data/build-info.js"), buildContext, { filename: "data/build-info.js" });
const buildInfo = buildContext.window.CROSSROADS_BUILD_INFO;
assert(buildInfo, "Build metadata did not define CROSSROADS_BUILD_INFO");
assert.strictEqual(buildInfo.version, manifest.version, "Build metadata and release manifest versions differ");
assert.strictEqual(buildInfo.codename, manifest.codename, "Build metadata and release manifest codenames differ");

const readme = read("README.md");
assert(
  readme.split(/\r?\n/, 1)[0].includes(manifest.version),
  "README heading does not match the release version"
);
assert(/standalone/i.test(readme), "README must identify this as a standalone release");
assert(read("editor.html").includes(manifest.version), "Editor shell does not display the release version");
assert(read("index.html").includes("data/build-info.js"), "Game shell no longer loads authoritative build metadata");

console.log(
  `PASS — release ${manifest.version} has complete resources, valid load order, ` +
  "consistent metadata, current cache tokens, and no retired production files."
);
