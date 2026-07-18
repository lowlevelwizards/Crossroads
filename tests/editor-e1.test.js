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

load("src/scenario/scenario-visibility.js");
load("src/scenario/scenario-migrations.js");
load("src/scenario/scenario-schema.js");
load("src/editor/editor-document.js");
load("src/editor/editor-validation.js");
load("src/editor/editor-selection.js");
load("src/editor/editor-multiselect.js");

const DOC = context.window.CrossroadsEditorDocument;
const VALIDATE = context.window.CrossroadsEditorValidation;
const SELECTION = context.window.CrossroadsEditorSelection;
const MULTI = context.window.CrossroadsEditorMultiSelect;

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


const multiA = { kind:"terrain", id:"field-1" };
const multiB = { kind:"linear", id:"road-1" };
assert.strictEqual(MULTI.unique([multiA, multiA, multiB]).length, 2, "multi-selection must deduplicate whole objects");
assert.strictEqual(MULTI.toggle([multiA], multiA).length, 0, "shift-toggle must remove an existing object");
assert.strictEqual(MULTI.toggle([multiA], multiB).length, 2, "shift-toggle must add a new object");
assert.deepStrictEqual(JSON.parse(JSON.stringify(MULTI.unionBounds([{x:1,y:2,width:3,height:4},{x:10,y:1,width:2,height:2}]))), {x:1,y:1,width:11,height:5,centerX:6.5,centerY:3.5}, "multi-selection must compute a collective transform box");
assert.strictEqual(SELECTION.level(SELECTION.withComponent(multiB, "segment", 0)), "component", "formal selection must distinguish component selections");

const clipboardDocument = DOC.create(source);
clipboardDocument.objectives[0].targetId = "field-1";
const copiedPayload = DOC.copySelections(clipboardDocument, [multiA, { kind:"objective", id:"objective-1" }]);
assert.strictEqual(copiedPayload.items.length, 2, "copy must serialize each selected object once");
const pastedSelections = DOC.pasteSelections(clipboardDocument, copiedPayload, {x:3,y:4});
assert.strictEqual(pastedSelections.length, 2, "paste must recreate every copied object");
const pastedTerrain = DOC.find(clipboardDocument, pastedSelections.find(item => item.kind === "terrain"));
const pastedObjective = DOC.find(clipboardDocument, pastedSelections.find(item => item.kind === "objective"));
assert.strictEqual(pastedTerrain.x, 13, "pasted objects must receive the requested table-space offset");
assert.strictEqual(pastedObjective.targetId, pastedTerrain.id, "paste must remap references between copied objects");

const copy = DOC.duplicate(document, { kind:"terrain", id:"field-1" });
assert(copy && copy.id !== "field-1", "duplicate must create a new ID");
assert.strictEqual(document.terrain.length, 2, "duplicate must append to the correct collection");
assert(DOC.remove(document, { kind:"terrain", id:copy.id }), "remove must delete the selected object");


const blank = DOC.createBlankScenario({ id:"blank", title:"Blank", width:60, height:40, rounds:5, type:"control", startingFaction:"red" });
assert.strictEqual(blank.table.width, 60, "blank scenario must use requested table width");
assert.strictEqual(blank.deployment.order[0], "red", "blank scenario must preserve the requested starting faction");

const segmentDocument = DOC.create(source);
segmentDocument.linearTerrain[0].points = [{x:0,y:24},{x:20,y:24},{x:40,y:24},{x:72,y:24}];
const inserted = DOC.insertLinearWaypoint(segmentDocument, "road-1", 1);
assert(inserted && segmentDocument.linearTerrain[0].points.length === 5, "segment waypoint insertion must add a midpoint");
const split = DOC.deleteLinearSegment(segmentDocument, "road-1", 2);
assert(split?.split, "deleting a middle section must split the path");
assert.strictEqual(segmentDocument.linearTerrain.length, 2, "path split must create a second linear terrain object");

const playtest = DOC.playtestScenario(document);
assert.strictEqual(playtest.id, "editor_playtest", "playtest scenario must use the editor runtime ID");
assert.strictEqual(playtest.deployment.mode, "fixed", "playtest must preserve current positions");
assert.strictEqual(playtest.deployment.order.length, 0, "playtest must skip deployment sequencing");

const visibilityDocument = DOC.create(source);
visibilityDocument.terrain[0].visible = false;
visibilityDocument.forces.red[0].visible = false;
visibilityDocument.objectives[0].visible = false;
const visibilityPlaytest = DOC.playtestScenario(visibilityDocument);
assert.strictEqual(visibilityPlaytest.terrain.length, 0, "hidden terrain must be omitted from playtest");
assert.strictEqual(visibilityPlaytest.forces.red.length, 0, "hidden units must be omitted from playtest");
assert(!visibilityPlaytest.objectives.some(item => item.id === "objective-1"), "hidden objectives must be omitted from playtest");
assert(visibilityPlaytest.objectives.some(item => item.id === "editor-center"), "a fallback objective must be created when all objectives are hidden");

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
const persistenceSource = fs.readFileSync(path.join(root, "src/editor/editor-persistence.js"), "utf8");
assert(editorHtml.includes("src/editor/editor-document.js"), "editor document model must load before editor controller");
assert(editorHtml.includes("src/editor/editor-validation.js"), "editor validation must load before editor controller");
assert(indexHtml.includes("data/editor-playtest.js"), "battle runtime must load the optional editor bridge");
assert(indexHtml.includes("TERRAIN EDITOR"), "main menu must expose the internal editor");
assert(indexHtml.includes("CrossroadsFlow.openEditor"), "main menu editor action must use the shared flow boundary");
assert(indexHtml.includes("restoreScenarioFromUrl"), "game must restore the edited scenario when returning from the editor");
assert(editorHtml.includes("src/editor/editor-persistence.js"), "editor must load persistence before the coordinator");
assert(persistenceSource.includes("requestedScenarioId"), "editor persistence must resolve a scenario from the live-game launch URL");
assert(persistenceSource.includes("crossroads.editor.lastScenario"), "editor persistence must remember the last scenario edited");
assert(editorSource.includes("PERSISTENCE.create"), "editor coordinator must receive one persistence boundary");
assert(editorSource.includes("TERRAIN_PRESENTATION.renderScenarioTerrain"), "editor must reuse the runtime terrain renderer");
assert(editorSource.includes("CrossroadsEditorValidation"), "editor must use the validation boundary");
assert(editorSource.includes("onViewportWheel"), "editor must support wheel zoom");
assert(editorSource.includes("startPan"), "editor must support click-drag panning");
assert(editorSource.includes("finishLinearDraw"), "editor must support waypoint path generation");
assert(editorSource.includes("deleteLinearSegment"), "editor must expose individual path-section deletion");
assert(editorHtml.includes("showUnitsToggle"), "editor must expose unit visibility controls");
assert(editorHtml.includes("newScenarioButton"), "editor must expose new scenario creation at the top of the panel");
assert(editorHtml.includes("objectiveTypeSelect"), "editor must expose objective type selection");
assert(editorHtml.includes("patchStyleSelect"), "editor must expose polygon terrain patch drawing");
assert(editorSource.includes("branchLinear"), "editor must support branching linear terrain");
assert(editorSource.includes("Waypoint width"), "editor must expose per-waypoint widths");
assert(editorSource.includes("layer-back"), "editor must expose manual relayering");
assert(editorSource.includes("makeObjectThumbnail"), "editor must render visual object-list previews");
assert(editorSource.includes("toggleObjectVisibility"), "editor must expose per-object hide/show controls");
assert(editorSource.includes("Visible in editor and playtest"), "selected-item inspector must expose visibility");
assert(editorHtml.includes("src/scenario/scenario-schema.js"), "editor must load the canonical scenario schema");
assert(editorHtml.includes("src/generation/woodland-generator.js"), "editor must load shared woodland generation");
assert(editorHtml.includes("src/editor/editor-selection.js"), "editor must load the formal selection boundary");
assert(editorSource.includes("Lock object on battlefield"), "inspector must expose object locking");
assert(editorSource.includes("reroll-generator"), "woodland inspector must expose deterministic rerolling");
assert(editorHtml.includes("renameScenarioButton"), "editor must expose custom-scenario rename controls");
assert(editorHtml.includes("deleteScenarioButton"), "editor must expose custom-scenario deletion controls");
assert(editorSource.includes("segmentHitWidth"), "linear terrain selection must use authored-width hit regions");
assert(editorSource.includes("data-range-number"), "range controls must expose linked exact-value numeric inputs");


assert(editorHtml.includes("copySelectionButton") && editorHtml.includes("pasteSelectionButton"), "editor must expose copy and paste controls");
assert(editorHtml.includes("src/editor/editor-multiselect.js"), "editor must load the shared multi-selection helper");
assert(editorSource.includes("startMarquee") && editorSource.includes("finishMarquee"), "editor must support drag-marquee selection");
assert(editorSource.includes("selectionSet"), "editor state must preserve an explicit multi-selection set");
assert(editorSource.includes("copySelection") && editorSource.includes("pasteSelection"), "editor must support clipboard authoring");
assert(editorSource.includes("applyGroupTranslation") && editorSource.includes("applyGroupScale") && editorSource.includes("applyGroupRotation"), "collective transforms must use explicit group operations");

const migrated = DOC.create({ ...source, schemaVersion:0, terrain:[{ ...source.terrain[0], hidden:true }] });
assert.strictEqual(migrated.schemaVersion, 2, "scenario documents must migrate to schema version 2");
assert.strictEqual(migrated.terrain[0].visible, false, "legacy hidden state must migrate to visible=false");
assert.strictEqual(migrated.terrain[0].hidden, undefined, "legacy hidden state must not survive canonical serialization");
assert.strictEqual(migrated.terrain[0].locked, false, "placeable objects must receive an explicit lock state");


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

assert(editorHtml.includes("src/scenario-runtime/scenario-runtime.js"), "editor must load the shared scenario runtime boundary");
assert(editorSource.includes("choose-objective-target"), "editor must expose visual objective target picking");
console.log("PASS — Terrain Editor S1.0 schema, objective authoring, formal and multi-selection, collective transforms, clipboard authoring, terrain controls, validation, and playtest checks passed.");
