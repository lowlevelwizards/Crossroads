"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function classList() {
  const values = new Set();
  return {
    add(...names) { for (const name of names) values.add(name); },
    remove(...names) { for (const name of names) values.delete(name); },
    toggle(name, force) {
      if (force === undefined) force = !values.has(name);
      if (force) values.add(name); else values.delete(name);
      return force;
    },
    contains(name) { return values.has(name); }
  };
}

function node(dataset = {}) {
  const listeners = {};
  return {
    dataset:{ ...dataset },
    hidden:false,
    tabIndex:0,
    classList:classList(),
    attributes:{},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener(type, handler) { listeners[type] = handler; },
    click() { listeners.click?.({ stopPropagation() {} }); }
  };
}

const workspaceButtons = ["build", "organize", "scenario"].map(value => node({ editorWorkspaceButton:value }));
const workspacePanels = ["build", "organize", "scenario"].map(value => node({ editorWorkspacePanel:value }));
const panelButtons = ["inspector", "validation", "data"].map(value => node({ editorPanelButton:value }));
const panelSections = ["inspector", "validation", "data"].map(value => node({ editorPanel:value }));
const leftToggle = node();
const rightToggle = node();
const root = {
  dataset:{},
  classList:classList(),
  querySelectorAll(selector) {
    if (selector === "[data-editor-workspace-button]") return workspaceButtons;
    if (selector === "[data-editor-workspace-panel]") return workspacePanels;
    if (selector === "[data-editor-panel-button]") return panelButtons;
    if (selector === "[data-editor-panel]") return panelSections;
    if (selector === "[data-editor-popover-button]") return [];
    if (selector === "[data-editor-popover]") return [];
    return [];
  },
  querySelector(selector) {
    if (selector === "[data-editor-toggle-left]") return leftToggle;
    if (selector === "[data-editor-toggle-right]") return rightToggle;
    return null;
  },
  addEventListener() {}
};
const values = new Map();
const storage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, value); }
};
const context = vm.createContext({
  console,
  document:{ body:root },
  window:{
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {}
  }
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src/editor/editor-shell.js"), "utf8"),
  context,
  { filename:"src/editor/editor-shell.js" }
);

const shell = context.window.CrossroadsEditorShell.create({ root, storage });
assert.strictEqual(shell.workspace(), "build", "shell must start in the Build workspace");
assert.strictEqual(workspacePanels[0].hidden, false, "Build workspace panel must be visible");
assert.strictEqual(workspacePanels[1].hidden, true, "inactive workspace panels must be hidden");

shell.setWorkspace("organize");
assert.strictEqual(root.dataset.editorWorkspace, "organize", "workspace must be reflected on the editor root");
assert(workspaceButtons[1].classList.contains("is-active"), "active workspace button must be marked");
assert.strictEqual(values.get("crossroads.editor.workspace"), "organize", "workspace preference must persist");

shell.setPanel("validation");
assert.strictEqual(root.dataset.editorPanel, "validation", "right panel must be reflected on the editor root");
assert.strictEqual(panelSections[1].hidden, false, "selected right panel must be visible");
assert.strictEqual(panelSections[0].hidden, true, "inactive right panels must be hidden");

shell.showValidation();
assert(root.classList.contains("is-right-drawer-open"), "validation shortcut must open the right drawer on narrow layouts");

console.log("PASS — editor shell owns focused workspace, right-panel, persistence, and responsive-drawer state.");
