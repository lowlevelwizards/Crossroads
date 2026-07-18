"use strict";

global.window = global;
require("../src/runtime/building-occupancy.js");

const buildings = [
  {
    id: "farm",
    x: 10,
    y: 10,
    width: 8,
    height: 6,
    definition: { label: "farmhouse" }
  }
];
const units = [
  {
    id: "blue-1",
    faction: "blue",
    name: "Blue Squad",
    x: 6,
    y: 13,
    soldiers: 6,
    pins: 0,
    outcome: "active",
    inBuilding: null
  },
  {
    id: "red-1",
    faction: "red",
    name: "Red Squad",
    x: 40,
    y: 20,
    soldiers: 6,
    pins: 0,
    outcome: "active",
    inBuilding: null
  }
];
let selectedUnitId = "blue-1";
let phase = "choose-order";
let chosenOrder = null;
let completedOrder = null;
let orderAttempts = 0;

const terrainGeometry = {
  get(id) { return buildings.find(building => building.id === id) ?? null; },
  buildings() { return buildings; },
  center(building) { return { x: building.x + building.width / 2, y: building.y + building.height / 2 }; },
  entryPoint(building) { return { x: building.x, y: building.y + building.height / 2 }; },
  approachPoint(building) { return { x: building.x - 1.8, y: building.y + building.height / 2 }; },
  entryMarker() { return { x: 0, y: 0.5 }; }
};

const controller = window.CrossroadsBuildingOccupancy.create({
  terrainGeometry,
  commands: { makeCommand: definition => Object.freeze({ ...definition }) },
  terrainPresentation: { elementForInstance: () => null },
  terrainLayer: {},
  actionButton: null,
  unitOutcomeActive: "active",
  livingUnits: () => units.filter(unit => unit.outcome === "active" && unit.soldiers > 0),
  getUnit: id => units.find(unit => unit.id === id) ?? null,
  getSelectedUnitId: () => selectedUnitId,
  clearSelectedUnit: id => { if (selectedUnitId === id) selectedUnitId = null; },
  getPhase: () => phase,
  setChosenOrder: order => { chosenOrder = order; },
  analyzeMovementPath: (unit, path) => ({
    legal: true,
    reason: "",
    cost: Math.hypot(path[1].x - unit.x, path[1].y - unit.y),
    allowance: 6
  }),
  attemptOrder: () => { orderAttempts += 1; return true; },
  completeActivation: order => { completedOrder = order; },
  addLog: () => {},
  capitalize: value => value.charAt(0).toUpperCase() + value.slice(1),
  showAnnouncement: () => {},
  getActiveScenario: () => ({ factions: { blue: { name: "Poland" }, red: { name: "Germany" } } }),
  unitIsEligibleForCurrentDie: () => true,
  unitNameplateHtml: () => "",
  gestureSuppressed: () => false,
  chooseTarget: () => {},
  chooseAssaultTarget: () => {},
  selectDeploymentUnit: () => {},
  selectUnit: id => { selectedUnitId = id; }
});

const entry = controller.entryAnalysis(units[0]);
if (!entry.legal || entry.building.id !== "farm") {
  throw new Error("Expected reachable empty farmhouse entry.");
}

const command = controller.command(units[0]);
if (!command.enabled || command.label !== "Enter Farmhouse") {
  throw new Error("Expected enabled Enter Farmhouse command.");
}

controller.enterAction();
if (units[0].inBuilding !== "farm") throw new Error("Unit did not occupy farmhouse.");
if (units[0].x !== 14 || units[0].y !== 13) throw new Error("Unit did not move to building center.");
if (chosenOrder !== "Enter Building" || completedOrder !== "Enter Building") {
  throw new Error("Enter action did not use the expected order flow.");
}
if (orderAttempts !== 1) throw new Error("Enter action did not attempt exactly one order test.");

const occupiedEntry = controller.entryAnalysis(units[1], "farm");
if (occupiedEntry.legal || !occupiedEntry.reason.includes("occupied")) {
  throw new Error("Occupied building was not rejected.");
}

units[0].soldiers = 0;
controller.reconcileAfterUnitChange(units[0]);
if (units[0].inBuilding !== null) throw new Error("Destroyed unit retained building custody.");
if (selectedUnitId !== null) throw new Error("Destroyed selected occupant remained selected.");

console.log("PASS — building occupancy owns entry, commands, custody, and cleanup through one explicit controller.");
