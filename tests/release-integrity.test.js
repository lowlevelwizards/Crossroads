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

assertOrdered("classic.html", "data/build-info.js", "src/engine.js");
assertOrdered("classic.html", "src/camera/table-viewport.js", "src/camera/camera.js");
assertOrdered("classic.html", "src/camera/camera.js", "src/camera/coordinates.js");
assertOrdered("classic.html", "src/scenario/scenario-schema.js", "src/scenario-runtime/scenario-compiler.js");
assertOrdered("classic.html", "src/rules/morale.js", "src/rules/combat-runtime.js");
assertOrdered("classic.html", "src/rules/shooting.js", "src/rules/combat-runtime.js");
assertOrdered("classic.html", "src/rules/assault.js", "src/rules/combat-runtime.js");
assertOrdered("classic.html", "src/runtime/building-occupancy.js", "src/rules/combat-runtime.js");
assertOrdered("classic.html", "src/rules/combat-runtime.js", "src/infrastructure/startup-validation.js");
assertOrdered("classic.html", "src/infrastructure/startup-validation.js", "src/engine.js");
assertOrdered("editor.html", "data/build-info.js", "src/editor/editor.js");
assertOrdered("editor.html", "src/camera/table-viewport.js", "src/editor/editor.js");
assertOrdered("editor.html", "src/scenario/scenario-schema.js", "src/editor/editor-validation.js");
assertOrdered("editor.html", "src/editor/editor-multiselect.js", "src/editor/editor.js");
assertOrdered("editor.html", "src/editor/editor-persistence.js", "src/editor/editor-shell.js");
assertOrdered("editor.html", "src/editor/editor-shell.js", "src/editor/editor.js");
assertOrdered("tests/startup-smoke.html", "src/camera/table-viewport.js", "src/camera/camera.js");
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
assert(read("classic.html").includes("data/build-info.js"), "Classic game shell no longer loads authoritative build metadata");
const frontDoor = read("index.html");
assert(frontDoor.includes('href="./battle3d.html"'), "Homepage Play link must open the authoritative 3D battle");
assert(!frontDoor.includes('href="./diorama.html"'), "Homepage must not launch the old movement study");
const battleDoor = read("battle3d.html");
assert(battleDoor.includes('id="battleSessionFrame"'), "Battle page must load its authoritative engine host");
assert(battleDoor.includes("src/diorama/battle-client.js"), "Battle page must load the 3D battle client");
assert(battleDoor.includes("src/diorama/scenario-scene.js"), "Battle page must load the 3D scene");
assert(battleDoor.includes("src/diorama/combat-presentation.js"), "Battle must load the structured combat presentation");
assert(battleDoor.includes("src/diorama/movement-intent.js"), "The 3D battle must load its movement confirmation state");
assertOrdered("battle3d.html", "src/diorama/movement-intent.js", "src/diorama/scenario-scene.js");
assertOrdered("battle3d.html", "src/diorama/combat-presentation.js", "src/diorama/battle-client.js");
assertOrdered("battle3d.html", "src/diorama/ai-opponent.js", "src/diorama/battle-client.js");
assert(read("scenarios3d.html").includes("CROSSROADS_SCENARIOS"), "3D scenario selection must read official scenario data");
assert(read("src/engine.js").includes("combatEventCount:combatEventSequence"), "Authoritative engine must expose sequenced combat events");
assert(read("src/rules/combat-runtime.js").includes('emitBattleEvent("shooting"'), "Pure combat runtime adapter must emit shooting events");

assert(read("classic-session.html").includes("CROSSROADS_3D_SESSION_HOST=true"), "The battle's engine host must be configured");
assert(read("diorama.html").includes("src/diorama/scenario-scene.js"), "Preserve the 3D scenic study as a fallback");
assert(!frontDoor.includes("src/engine.js"), "Homepage must not load the old 2D engine");
assert(!frontDoor.includes("editor.html"), "The public homepage should not expose the editor");
assert(read("classic.html").includes('id="scenarioSelect"'), "Classic 2D game must remain preserved");

console.log(
  `PASS — release ${manifest.version} has complete resources, valid load order, ` +
  "consistent metadata, current cache tokens, and no retired production files."
);
