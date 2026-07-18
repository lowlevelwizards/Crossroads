"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window:{} });

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, { filename:relativePath });
}

load("src/camera/table-viewport.js");
load("src/camera/coordinates.js");
load("src/editor/editor-tools.js");

const VIEWPORT = context.window.CrossroadsTableViewport;
const TOOLS = context.window.CrossroadsEditorTools;

const landscape = VIEWPORT.boardPixels({ width:72, height:48 }, 15);
const portrait = VIEWPORT.boardPixels({ width:72, height:96 }, 15);
assert.deepStrictEqual(
  { width:landscape.width, height:landscape.height },
  { width:1080, height:720 },
  "landscape table pixels must derive from authored dimensions"
);
assert.deepStrictEqual(
  { width:portrait.width, height:portrait.height },
  { width:1080, height:1440 },
  "portrait table pixels must derive from authored dimensions"
);

const landscapeFit = VIEWPORT.fitZoom({
  viewportWidth:1000,
  viewportHeight:700,
  boardWidth:landscape.width,
  boardHeight:landscape.height,
  margin:20
});
const portraitFit = VIEWPORT.fitZoom({
  viewportWidth:1000,
  viewportHeight:700,
  boardWidth:portrait.width,
  boardHeight:portrait.height,
  margin:20
});
assert(portraitFit < landscapeFit, "a taller battlefield must fit by its height rather than a fixed 6×4 ratio");

const geometry = VIEWPORT.surfaceGeometry({
  viewportWidth:900,
  viewportHeight:650,
  boardWidth:portrait.width,
  boardHeight:portrait.height,
  zoom:1,
  minimumMargin:120,
  marginRatio:.5
});
assert(geometry.surfaceHeight > portrait.height, "camera surface must retain vertical pan margins around portrait maps");
assert(geometry.surfaceWidth > portrait.width, "camera surface must retain horizontal pan margins around any map");

function coordinateFactory(rotated) {
  const battlefield = {
    offsetWidth:1080,
    getBoundingClientRect() {
      return rotated
        ? { left:100, top:50, width:720, height:540 }
        : { left:100, top:50, width:540, height:720 };
    }
  };
  return context.window.CrossroadsCoordinates.create({
    battlefield,
    getTableSize:() => ({ width:72, height:96 }),
    clamp:(value, min, max) => Math.min(max, Math.max(min, value)),
    cameraIsRotated:() => rotated
  });
}

const unrotatedPoint = coordinateFactory(false).eventToTablePoint({ clientX:370, clientY:410 });
assert(Math.abs(unrotatedPoint.x - 36) < 1e-8, "unrotated pointer conversion must ignore visual zoom and use table fractions");
assert(Math.abs(unrotatedPoint.y - 48) < 1e-8, "unrotated pointer conversion must support non-6×4 heights");
const rotatedPoint = coordinateFactory(true).eventToTablePoint({ clientX:460, clientY:320 });
assert(Math.abs(rotatedPoint.x - 36) < 1e-8, "rotated pointer conversion must preserve table X");
assert(Math.abs(rotatedPoint.y - 48) < 1e-8, "rotated pointer conversion must preserve table Y");

const state = {
  placement:null,
  drawingPath:{ points:[] },
  drawingPatch:null,
  pointEdit:{ kind:"linear", id:"road" },
  pan:null,
  scaleSession:null
};
TOOLS.beginPlacement(state, { assetKey:"terrain:cottage", label:"Cottage" });
assert.strictEqual(TOOLS.mode(state), TOOLS.MODES.PLACE, "placement mode must own pointer input before selection");
assert.strictEqual(state.drawingPath, null, "starting placement must cancel an unfinished path");
assert.strictEqual(state.pointEdit, null, "starting placement must leave point-edit mode");
TOOLS.cancelPlacement(state);
assert.strictEqual(TOOLS.mode(state), TOOLS.MODES.SELECT, "cancelling placement must return to selection mode");

TOOLS.beginPointEdit(state, { kind:"linear", id:"road" });
assert(TOOLS.isPointEditing(state, { kind:"linear", id:"road" }), "point edit must be tied to one selected path");
assert(!TOOLS.isPointEditing(state, { kind:"linear", id:"rail" }), "point edit must not leak to another path");
TOOLS.leavePointEdit(state);
assert.strictEqual(state.pointEdit, null, "leaving point edit must clear its overlay state");

assert.strictEqual(TOOLS.nudgeDistance({ snap:true }), .25, "arrow nudge must use the current quarter-inch snap");
assert.strictEqual(TOOLS.nudgeDistance({ shift:true }), 1, "Shift+Arrow must use the faster one-inch nudge");
assert.strictEqual(TOOLS.nudgeDistance({ alt:true }), .05, "Alt+Arrow must retain a precise fine nudge");

const editorSource = fs.readFileSync(path.join(root, "src/editor/editor.js"), "utf8");
const editorCss = fs.readFileSync(path.join(root, "styles/editor.css"), "utf8");
const mainCss = fs.readFileSync(path.join(root, "styles/main.css"), "utf8");
assert(editorSource.includes("document.elementsFromPoint"), "dense-scene selection must inspect the complete hit stack");
assert(editorSource.includes("isItemLocked(item)"), "locked objects must be excluded by canvas hit testing");
assert(editorSource.includes("preferSelected:!event.shiftKey"), "the already-selected object must win ordinary dense-scene clicks");
assert(editorSource.includes("placeActiveAsset(boardPoint(event), event.shiftKey)"), "Shift placement must preserve stamp mode");
assert(editorSource.includes("TOOLS.isPointEditing"), "path handles must derive from explicit point-edit state");
assert(editorSource.includes("state.showPatches") && editorSource.includes("state.showObjects") && editorSource.includes("state.showLinear"), "canvas visibility must separate patches, objects, and linear terrain");
assert(editorCss.includes(".editor-asset-library { flex:1 1 auto; min-height:0; overflow:auto"), "object library must own an independent scroll region");
assert(editorCss.includes(".editor-object-list { flex:1 1 auto; min-height:0; overflow:auto"), "scene hierarchy must own an independent scroll region");
assert(mainCss.includes("var(--table-grid-x") && mainCss.includes("var(--table-grid-y"), "game grid spacing must derive from active table dimensions");

console.log("PASS — S1.1.1 arbitrary-size viewport, zoom-safe coordinates, explicit interaction modes, keyboard nudges, scrolling, placement, and visibility contracts passed.");
