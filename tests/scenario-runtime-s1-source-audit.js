"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const index = read("index.html");
const editor = read("editor.html");
const engine = read("src/engine.js");
const editorSource = read("src/editor/editor.js");
const scenarios = read("data/scenarios.js");
const migrations = read("src/scenario/scenario-migrations.js");

const ordered = [
  "src/scenario/scenario-schema.js",
  "src/rules/objectives/objective-registry.js",
  "src/rules/objectives/control-objective.js",
  "src/rules/objectives/exit-objective.js",
  "src/rules/objectives/destroy-objective.js",
  "src/rules/objectives/protect-objective.js",
  "src/rules/objectives/hold-objective.js",
  "src/rules/objectives/victory-policies.js",
  "src/scenario-runtime/scenario-compiler.js",
  "src/scenario-runtime/scenario-events.js",
  "src/scenario-runtime/scenario-runtime.js",
  "src/scenario-runtime/scenario-presentation.js",
  "src/engine.js"
];
for (let indexPosition = 1; indexPosition < ordered.length; indexPosition += 1) {
  assert(index.indexOf(ordered[indexPosition - 1]) < index.indexOf(ordered[indexPosition]), `Bad load order: ${ordered[indexPosition - 1]} before ${ordered[indexPosition]}`);
}

for (const script of ordered.slice(0, -1)) {
  if (script.includes("scenario-presentation")) continue;
  assert(editor.includes(script), `Scenario Composer must load ${script}`);
}

assert(migrations.includes("CURRENT_VERSION = 2"), "scenario schema migration must identify version 2");
assert(migrations.includes("migrateLegacyObjectives"), "legacy scoring must migrate through one boundary");
assert(!scenarios.includes("scoring:Object.freeze"), "built-in scenarios must not retain the old scoring object");
assert(scenarios.includes('type:"destroy_target"') || editorSource.includes('{ id:"destroy_target"'), "destroy objectives must be authorable");
assert(engine.includes("SCENARIO_RUNTIME.createSession"), "engine must create one scenario runtime session");
assert(engine.includes('scenarioSession.dispatch("round_ended"'), "round scoring must dispatch through the scenario runtime");
assert(engine.includes('scenarioSession.dispatch("unit_destroyed"'), "destruction must dispatch through the scenario runtime");
assert(!engine.includes('activeScenario.id === "mokra"'), "engine must not branch on the Mokra scenario ID");
assert(!engine.includes("activeScenario.scoring"), "engine must not read the superseded scoring object");
assert(!fs.existsSync(path.join(root, "src/rules/scenario-runtime.js")), "obsolete Mokra wrapper file must be deleted");
assert(editor.includes("victoryPolicySelect"), "Scenario Composer must expose victory policy controls");
assert(read("src/editor/editor.js").includes("choose-objective-target"), "Scenario Composer must expose visual target picking");
assert(read("data/build-info.js").includes('version: "S1.1.0"'), "build metadata must identify S1.0");

console.log("PASS — Scenario Runtime S1.1.0 load order, schema, evaluator ownership, engine delegation, editor integration, and legacy cleanup audit passed.");
