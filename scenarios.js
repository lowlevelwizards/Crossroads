"use strict";

/*
  CROSSROADS Foundation 2B.3 — scenario definitions

  Pure scenario data only:
  - force lists
  - deployment zones
  - terrain layouts
  - objectives
  - scoring and victory configuration

  Scenario execution remains in index.html.
*/

const CORE_SCENARIO_12A = Object.freeze({
      id: "take_the_crossroads_core",
      title: "Take the Crossroads",
      factions: { blue: { name: "Blue Force" }, red: { name: "Red Force" } },
      forces: {
        blue: [
          { id: "blue-officer", unitType: "officer", x: 6, y: 6 },
          { id: "blue-rifle", unitType: "rifleSquad", x: 8, y: 17 },
          { id: "blue-assault", unitType: "assaultSquad", x: 8, y: 29 },
          { id: "blue-mmg", unitType: "mmgTeam", x: 6, y: 41 }
        ],
        red: [
          { id: "red-officer", unitType: "officer", x: 66, y: 6 },
          { id: "red-rifle", unitType: "rifleSquad", x: 64, y: 17 },
          { id: "red-assault", unitType: "assaultSquad", x: 64, y: 29 },
          { id: "red-mmg", unitType: "mmgTeam", x: 66, y: 41 }
        ]
      }
    });

const SCENARIOS = Object.freeze({
      take_the_crossroads: Object.freeze({
        id: "take_the_crossroads",
        title: "Take the Crossroads",
        description: "A six-round meeting engagement. Control the central crossroads at the end of each round.",
        rounds: 6,
        factions: { blue: { name: "Blue Force" }, red: { name: "Red Force" } },
        table: { width: 72, height: 48 },
        deployment: {
          mode: "player",
          order: ["blue", "red"],
          zones: {
            blue: { xMin: 0, xMax: 12, yMin: 0, yMax: 48, label: "Blue deployment · 12″" },
            red: { xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "Red deployment · 12″" }
          }
        },
        terrain: {
          woods: { x: 15, y: 28, width: 18, height: 14 },
          wall: { x: 38, y: 30, width: 17, height: 2.5 },
          building: { x: 28, y: 4, width: 13, height: 13 }
        },
        objectives: [{ id: "crossroads", x: 36, y: 24, radius: 3, label: "Crossroads" }],
        scoring: { roundControl: 1, finalControl: 0 },
        victory: { elimination: true, tiebreaker: "survivingUnits" },
        forces: CORE_SCENARIO_12A.forces
      }),
      hold_the_farm: Object.freeze({
        id: "hold_the_farm",
        title: "Hold the Farm",
        description: "A four-round validation scenario with fixed deployment. No points are scored each round; control of the farm objective at battle end is worth two points.",
        rounds: 4,
        factions: { blue: { name: "Farm Defenders" }, red: { name: "Road Attackers" } },
        table: { width: 72, height: 48 },
        deployment: {
          mode: "fixed",
          order: [],
          zones: {
            blue: { xMin: 0, xMax: 30, yMin: 0, yMax: 48, label: "Defender area" },
            red: { xMin: 54, xMax: 72, yMin: 0, yMax: 48, label: "Attacker area" }
          }
        },
        terrain: {
          woods: { x: 8, y: 5, width: 18, height: 15 },
          wall: { x: 29, y: 26, width: 18, height: 2.5 },
          building: { x: 31, y: 14, width: 14, height: 13 }
        },
        objectives: [{ id: "farm_yard", x: 38, y: 24, radius: 4, label: "Farm Yard" }],
        scoring: { roundControl: 0, finalControl: 2 },
        victory: { elimination: true, tiebreaker: "survivingSoldiers" },
        forces: {
          blue: [
            { id: "blue-officer", unitType: "officer", x: 24, y: 16 },
            { id: "blue-rifle", unitType: "rifleSquad", x: 25, y: 25 },
            { id: "blue-assault", unitType: "assaultSquad", x: 22, y: 35 },
            { id: "blue-mmg", unitType: "mmgTeam", x: 26, y: 8 }
          ],
          red: [
            { id: "red-officer", unitType: "officer", x: 64, y: 8 },
            { id: "red-rifle", unitType: "rifleSquad", x: 62, y: 18 },
            { id: "red-assault", unitType: "assaultSquad", x: 61, y: 30 },
            { id: "red-mmg", unitType: "mmgTeam", x: 65, y: 40 }
          ]
        }
      }),
      breakthrough: Object.freeze({
        id: "breakthrough",
        title: "Breakthrough",
        description: "A six-round asymmetric battle. Red must exit surviving units through the Blue edge; Blue must delay and contain.",
        rounds: 6,
        factions: {
          blue: { name: "Blue Defenders" },
          red: { name: "Red Attackers" }
        },
        table: { width: 72, height: 48 },
        deployment: {
          mode: "player",
          order: ["blue", "red"],
          zones: {
            blue: { xMin: 0, xMax: 18, yMin: 0, yMax: 48, label: "Blue defensive deployment · 18″" },
            red: { xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "Red attack deployment · 12″" }
          }
        },
        terrain: {
          woods: { x: 13, y: 7, width: 18, height: 16 },
          wall: { x: 32, y: 25, width: 14, height: 2.5 },
          building: { x: 49, y: 8, width: 15, height: 17 }
        },
        objectives: [{
          id: "red_exit",
          type: "exit_unit",
          edge: "blue",
          faction: "red",
          depth: 3,
          radius: 0,
          x: 0,
          y: 24,
          label: "Breakthrough Edge",
          pointsPerUnit: 2
        }],
        scoring: {
          roundControl: 0,
          finalControl: 0,
          exitPoints: 2,
          containmentPointsPerUnit: 1
        },
        victory: {
          elimination: false,
          tiebreaker: "survivingSoldiers",
          type: "breakthrough"
        },
        forces: {
          blue: [
            { id: "blue-officer", unitType: "officer", x: 12, y: 7 },
            { id: "blue-rifle-a", unitType: "rifleSquad", x: 13, y: 18 },
            { id: "blue-rifle-b", unitType: "rifleSquad", x: 13, y: 31 },
            { id: "blue-mmg", unitType: "mmgTeam", x: 10, y: 41 }
          ],
          red: [
            { id: "red-officer", unitType: "officer", x: 66, y: 6 },
            { id: "red-rifle-a", unitType: "rifleSquad", x: 64, y: 15 },
            { id: "red-rifle-b", unitType: "rifleSquad", x: 64, y: 25 },
            { id: "red-assault", unitType: "assaultSquad", x: 64, y: 35 },
            { id: "red-mmg", unitType: "mmgTeam", x: 66, y: 43 }
          ]
        }
      })
    });

window.CROSSROADS_CORE_SCENARIO_12A = CORE_SCENARIO_12A;
window.CROSSROADS_SCENARIOS = SCENARIOS;
