"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window:{} });

function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename:relativePath });
}

load("src/editor/editor-document.js");
load("src/editor/editor-validation.js");

const DOC = context.window.CrossroadsEditorDocument;
const VALIDATE = context.window.CrossroadsEditorValidation;

const terrainTypes = {
  cottage:{ id:"cottage", label:"cottage", rules:{ movement:"impassable" }, presentation:{ footprint:{ x:.1, y:.2, width:.8, height:.6 } } },
  field:{ id:"field", label:"field", rules:{ movement:"open" }, presentation:{} }
};
const linearStyles = { road:{ id:"road", label:"road", width:3, rules:{ movement:"open" } } };
const unitTypes = { rifle:{ name:"Rifle" } };
const pathGeometry = { createPath(definition) { if (!definition.points || definition.points.length < 2) throw new Error("bad path"); return definition; } };

const source = Object.freeze({
  id:"test",
  title:"Test",
  rounds:1,
  table:Object.freeze({ width:72, height:48, mat:"grass_temperate" }),
  terrain:Object.freeze([{ id:"field-1", terrainId:"field", x:10, y:10, width:8, height:6 }]),
  linearTerrain:Object.freeze([{ id:"road-1", styleId:"road", points:[{x:0,y:24},{x:72,y:24}] }]),
  objectives:Object.freeze([{ id:"objective-1", label:"Objective", x:36, y:12, radius:3 }]),
  deployment:Object.freeze({ mode:"player", order:["blue","red"], zones:{ blue:{xMin:0,xMax:12,yMin:0,yMax:48}, red:{xMin:60,xMax:72,yMin:0,yMax:48} } }),
  forces:Object.freeze({ blue:Object.freeze([{id:"blue-1",unitType:"rifle",x:6,y:8}]), red:Object.freeze([{id:"red-1",unitType:"rifle",x:66,y:40}]) })
});

const document = DOC.create(source);
assert.notStrictEqual(document, source, "editor document must be a clone");
document.terrain[0].x = 12;
assert.strictEqual(source.terrain[0].x, 10, "editing the document must not mutate source data");
assert.strictEqual(DOC.nextId(document, "field-1"), "field-1-2", "ID generation must avoid collisions");

const copy = DOC.duplicate(document, { kind:"terrain", id:"field-1" });
assert(copy && copy.id !== "field-1", "duplicate must create a new ID");
assert.strictEqual(document.terrain.length, 2, "duplicate must append to the correct collection");
assert(DOC.remove(document, { kind:"terrain", id:copy.id }), "remove must delete the selected object");

const playtest = DOC.playtestScenario(document);
assert.strictEqual(playtest.id, "editor_playtest", "playtest scenario must use the editor runtime ID");
assert.strictEqual(playtest.deployment.mode, "fixed", "playtest must preserve current positions");
assert.strictEqual(playtest.deployment.order.length, 0, "playtest must skip deployment sequencing");

document.linearTerrain.push({ id:"off-table-stream", styleId:"road", points:[{x:-1,y:10},{x:20,y:10}], start:{cap:"off_table"}, end:{cap:"taper"} });
const cleanIssues = VALIDATE.validateScenario(document, { terrainTypes, linearStyles, unitTypes, pathGeometry });
assert.strictEqual(cleanIssues.filter(item => item.level === "error").length, 0, "valid scenario should not produce errors");
assert(!cleanIssues.some(item => item.code === "waypoint-bounds" && item.selection?.id === "off-table-stream"), "off-table caps must permit endpoints outside the board");

document.terrain.push({ id:"field-1", terrainId:"missing", x:80, y:0, width:0, height:3 });
document.forces.blue[0].x = 30;
const badIssues = VALIDATE.validateScenario(document, { terrainTypes, linearStyles, unitTypes, pathGeometry });
assert(badIssues.some(item => item.code === "duplicate-id"), "duplicate IDs must be reported");
assert(badIssues.some(item => item.code === "unknown-terrain"), "unknown terrain must be reported");
assert(badIssues.some(item => item.code === "unit-zone"), "deployment-zone violations must be reported");

const editorHtml = fs.readFileSync(path.join(root, "editor.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const editorSource = fs.readFileSync(path.join(root, "src/editor/editor.js"), "utf8");
assert(editorHtml.includes("src/editor/editor-document.js"), "editor document model must load before editor controller");
assert(editorHtml.includes("src/editor/editor-validation.js"), "editor validation must load before editor controller");
assert(indexHtml.includes("data/editor-playtest.js"), "battle runtime must load the optional editor bridge");
assert(indexHtml.includes("TERRAIN EDITOR"), "main menu must expose the internal editor");
assert(indexHtml.includes("CrossroadsFlow.openEditor"), "main menu editor action must use the shared flow boundary");
assert(indexHtml.includes("restoreScenarioFromUrl"), "game must restore the edited scenario when returning from the editor");
assert(editorSource.includes("requestedScenarioId"), "editor must resolve a scenario from the live-game launch URL");
assert(editorSource.includes("crossroads.editor.lastScenario"), "editor must remember the last scenario edited");
assert(editorSource.includes("TERRAIN_PRESENTATION.renderScenarioTerrain"), "editor must reuse the runtime terrain renderer");
assert(editorSource.includes("CrossroadsEditorValidation"), "editor must use the validation boundary");

const playtestSelect = { value:"", appendChild(node) { this.option = node; } };
const playtestMainMenu = { style:{} };
const playtestScenarioMenu = { hidden:false };
const playtestBody = { dataset:{}, classList:{ remove() {} } };
const playtestContext = vm.createContext({
  console,
  URLSearchParams,
  localStorage:{ getItem() { return JSON.stringify({ id:"source", title:"Editor Test", table:{width:72,height:48}, forces:{blue:[],red:[]}, objectives:[] }); } },
  document:{
    body:playtestBody,
    createElement() { return {}; },
    getElementById(id) {
      if (id === "scenarioSelect") return playtestSelect;
      if (id === "mainMenuOverlay") return playtestMainMenu;
      if (id === "scenarioMenuOverlay") return playtestScenarioMenu;
      return null;
    }
  },
  window:{ location:{ search:"?editorPlaytest=1" }, CROSSROADS_SCENARIOS:{ base:{id:"base"} } }
});
vm.runInContext(fs.readFileSync(path.join(root, "data/editor-playtest.js"), "utf8"), playtestContext, { filename:"data/editor-playtest.js" });
assert(playtestContext.window.CROSSROADS_SCENARIOS.editor_playtest, "playtest bridge must inject the saved scenario");
assert.strictEqual(playtestSelect.value, "editor_playtest", "playtest bridge must select the injected scenario before engine startup");
assert.strictEqual(playtestBody.dataset.editorPlaytest, "true", "playtest bridge must mark the runtime document");

console.log("PASS — Terrain Editor E1 document, validation, source wiring, and playtest bridge checks passed.");
