"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, URLSearchParams, window:{} });
vm.runInContext(
  fs.readFileSync(path.join(root, "src/editor/editor-persistence.js"), "utf8"),
  context,
  { filename:"src/editor/editor-persistence.js" }
);

const PERSISTENCE = context.window.CrossroadsEditorPersistence;
assert(PERSISTENCE?.create, "editor persistence factory must load");

const storageValues = new Map();
const storage = {
  getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
  setItem(key, value) { storageValues.set(key, String(value)); }
};
const documentModel = {
  create(source) {
    if (!source || typeof source !== "object" || !source.id) throw new Error("invalid scenario");
    return JSON.parse(JSON.stringify(source));
  }
};
const builtInScenarios = {
  mokra:{ id:"mokra", title:"Mokra" },
  crossroads:{ id:"crossroads", title:"Crossroads" }
};
const scenarioSources = new Map(Object.entries(builtInScenarios));
const persistence = PERSISTENCE.create({ documentModel, builtInScenarios, scenarioSources, storage });

storage.setItem(persistence.keys.customScenarios, JSON.stringify([
  { id:"custom-one", title:"Custom One" },
  { bad:true },
  { id:"mokra", title:"Must Not Replace Built In" }
]));
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(persistence.loadCustomScenarios())),
  ["custom-one"],
  "only valid non-built-in drafts should load"
);
assert.strictEqual(scenarioSources.get("mokra").title, "Mokra", "local storage must not replace built-in scenarios");
assert.strictEqual(scenarioSources.get("custom-one").title, "Custom One", "valid drafts must enter the shared source map");

const persisted = persistence.persistScenario({ id:"custom-two", title:"Custom Two" });
assert.strictEqual(persisted.id, "custom-two", "persist must return the canonical draft");
assert(storage.getItem(persistence.keys.customScenarios).includes("custom-two"), "persist must rewrite custom scenario storage");
assert.throws(
  () => persistence.persistScenario({ id:"mokra", title:"Overwrite" }),
  /Cannot overwrite built-in scenario/,
  "persistence must defend built-in sources"
);

persistence.rememberScenario("custom-two");
assert.strictEqual(persistence.requestedScenarioId(""), "custom-two", "remembered scenario should be restored");
assert.strictEqual(persistence.requestedScenarioId("?scenario=mokra"), "mokra", "URL scenario should take precedence");
assert.strictEqual(persistence.requestedScenarioId("?scenario=missing"), "custom-two", "invalid URL IDs should fall back safely");

const clipboard = { version:1, items:[{ kind:"terrain", source:{id:"field"} }] };
assert.strictEqual(persistence.saveClipboard(clipboard), true, "clipboard save should report success");
assert.deepStrictEqual(JSON.parse(JSON.stringify(persistence.loadClipboard())), clipboard, "clipboard must round-trip");
assert.strictEqual(persistence.savePlaytest({ id:"editor_playtest" }), true, "playtest storage should report success");
assert(storage.getItem(persistence.keys.playtest).includes("editor_playtest"), "playtest document must be stored under the canonical key");

assert.strictEqual(persistence.deleteScenario("mokra"), false, "built-in scenarios cannot be deleted");
assert.strictEqual(persistence.deleteScenario("custom-two"), true, "custom scenarios can be deleted");
assert.strictEqual(scenarioSources.has("custom-two"), false, "deletion must update the shared source map");

const unavailable = PERSISTENCE.create({ documentModel, builtInScenarios, scenarioSources:new Map(Object.entries(builtInScenarios)), storage:null });
assert.strictEqual(unavailable.loadClipboard(), null, "unavailable storage must degrade to an empty clipboard");
assert.strictEqual(unavailable.savePlaytest({ id:"x" }), false, "unavailable storage must fail explicitly without throwing");

console.log("PASS — editor persistence owns local drafts, last-scenario restoration, clipboard state, and playtest handoff with safe storage failure behavior.");
