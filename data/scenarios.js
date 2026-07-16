"use strict";

/*
  Scenario definitions remain pure data. Internal blue/red keys are stable game
  sides; faction id, player-facing name, and visual kit are scenario metadata.
*/

const CROSSROADS_1939_FACTIONS = Object.freeze({
  blue: Object.freeze({ id: "poland", name: "Poland", kitId: "poland_1939" }),
  red: Object.freeze({ id: "germany", name: "Germany", kitId: "germany_1939" })
});

window.CROSSROADS_CORE_SCENARIO_12A = Object.freeze({
  id: "take_the_crossroads_core",
  title: "Take the Crossroads",
  factions: CROSSROADS_1939_FACTIONS,
  forces: Object.freeze({
    blue: Object.freeze([
      Object.freeze({ id: "blue-officer", unitType: "officer", quality: "veteran", x: 6, y: 6 }),
      Object.freeze({ id: "blue-rifle", unitType: "rifleSquad", quality: "regular", x: 8, y: 17 }),
      Object.freeze({ id: "blue-assault", unitType: "assaultSquad", quality: "veteran", x: 8, y: 29 }),
      Object.freeze({ id: "blue-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 6, y: 41 })
    ]),
    red: Object.freeze([
      Object.freeze({ id: "red-officer", unitType: "officer", quality: "veteran", x: 66, y: 6 }),
      Object.freeze({ id: "red-rifle", unitType: "rifleSquad", quality: "regular", x: 64, y: 17 }),
      Object.freeze({ id: "red-assault", unitType: "assaultSquad", quality: "veteran", x: 64, y: 29 }),
      Object.freeze({ id: "red-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 66, y: 41 })
    ])
  })
});

window.CROSSROADS_SCENARIOS = Object.freeze({
  take_the_crossroads: Object.freeze({
    id: "take_the_crossroads",
    title: "Take the Crossroads",
    description: "A six-round 1939 meeting engagement. Poland and Germany race to control the central crossroads.",
    rounds: 6,
    factions: CROSSROADS_1939_FACTIONS,
    table: Object.freeze({ width: 72, height: 48 }),
    deployment: Object.freeze({
      mode: "player",
      order: Object.freeze(["blue", "red"]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 12, yMin: 0, yMax: 48, label: "Poland deployment · 12″" }),
        red: Object.freeze({ xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "Germany deployment · 12″" })
      })
    }),
    terrain: Object.freeze({
      woods: Object.freeze({ x: 15, y: 28, width: 18, height: 14 }),
      wall: Object.freeze({ x: 38, y: 30, width: 17, height: 2.5 }),
      building: Object.freeze({ x: 28, y: 4, width: 13, height: 13 })
    }),
    objectives: Object.freeze([
      Object.freeze({ id: "crossroads", x: 36, y: 24, radius: 3, label: "Crossroads" })
    ]),
    scoring: Object.freeze({ roundControl: 1, finalControl: 0 }),
    victory: Object.freeze({ elimination: true, tiebreaker: "survivingUnits" }),
    forces: window.CROSSROADS_CORE_SCENARIO_12A.forces
  }),

  hold_the_farm: Object.freeze({
    id: "hold_the_farm",
    title: "Hold the Farm",
    description: "A four-round 1939 validation battle. Poland defends the farm while Germany attacks from the road.",
    rounds: 4,
    factions: CROSSROADS_1939_FACTIONS,
    table: Object.freeze({ width: 72, height: 48 }),
    deployment: Object.freeze({
      mode: "fixed",
      order: Object.freeze([]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 30, yMin: 0, yMax: 48, label: "Polish defensive area" }),
        red: Object.freeze({ xMin: 54, xMax: 72, yMin: 0, yMax: 48, label: "German attack area" })
      })
    }),
    terrain: Object.freeze({
      woods: Object.freeze({ x: 8, y: 5, width: 18, height: 15 }),
      wall: Object.freeze({ x: 29, y: 26, width: 18, height: 2.5 }),
      building: Object.freeze({ x: 31, y: 14, width: 14, height: 13 })
    }),
    objectives: Object.freeze([
      Object.freeze({ id: "farm_yard", x: 38, y: 24, radius: 4, label: "Farm Yard" })
    ]),
    scoring: Object.freeze({ roundControl: 0, finalControl: 2 }),
    victory: Object.freeze({ elimination: true, tiebreaker: "survivingSoldiers" }),
    forces: Object.freeze({
      blue: Object.freeze([
        Object.freeze({ id: "blue-officer", unitType: "officer", quality: "veteran", x: 24, y: 16 }),
        Object.freeze({ id: "blue-rifle", unitType: "rifleSquad", quality: "veteran", x: 25, y: 25 }),
        Object.freeze({ id: "blue-assault", unitType: "assaultSquad", quality: "regular", x: 22, y: 35 }),
        Object.freeze({ id: "blue-mmg", unitType: "mmgTeam", quality: "regular", x: 26, y: 8 })
      ]),
      red: Object.freeze([
        Object.freeze({ id: "red-officer", unitType: "officer", quality: "regular", x: 64, y: 8 }),
        Object.freeze({ id: "red-rifle", unitType: "rifleSquad", quality: "inexperienced", x: 62, y: 18 }),
        Object.freeze({ id: "red-assault", unitType: "assaultSquad", quality: "veteran", x: 61, y: 30 }),
        Object.freeze({ id: "red-mmg", unitType: "mmgTeam", quality: "regular", x: 65, y: 40 })
      ])
    })
  }),

  breakthrough: Object.freeze({
    id: "breakthrough",
    title: "Breakthrough",
    description: "A six-round asymmetric battle. Germany must break through the Polish defensive edge; Poland must delay and contain.",
    rounds: 6,
    factions: CROSSROADS_1939_FACTIONS,
    table: Object.freeze({ width: 72, height: 48 }),
    deployment: Object.freeze({
      mode: "player",
      order: Object.freeze(["blue", "red"]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 18, yMin: 0, yMax: 48, label: "Polish defensive deployment · 18″" }),
        red: Object.freeze({ xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "German attack deployment · 12″" })
      })
    }),
    terrain: Object.freeze({
      woods: Object.freeze({ x: 13, y: 7, width: 18, height: 16 }),
      wall: Object.freeze({ x: 32, y: 25, width: 14, height: 2.5 }),
      building: Object.freeze({ x: 49, y: 8, width: 15, height: 17 })
    }),
    objectives: Object.freeze([
      Object.freeze({
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
      })
    ]),
    scoring: Object.freeze({
      roundControl: 0,
      finalControl: 0,
      exitPoints: 2,
      containmentPointsPerUnit: 1
    }),
    victory: Object.freeze({
      elimination: false,
      tiebreaker: "survivingSoldiers",
      type: "breakthrough"
    }),
    forces: Object.freeze({
      blue: Object.freeze([
        Object.freeze({ id: "blue-officer", unitType: "officer", quality: "regular", x: 12, y: 7 }),
        Object.freeze({ id: "blue-rifle-a", unitType: "rifleSquad", quality: "veteran", x: 13, y: 18 }),
        Object.freeze({ id: "blue-rifle-b", unitType: "rifleSquad", quality: "veteran", x: 13, y: 31 }),
        Object.freeze({ id: "blue-mmg", unitType: "mmgTeam", quality: "veteran", x: 10, y: 41 })
      ]),
      red: Object.freeze([
        Object.freeze({ id: "red-officer", unitType: "officer", quality: "veteran", x: 66, y: 6 }),
        Object.freeze({ id: "red-rifle-a", unitType: "rifleSquad", quality: "regular", x: 64, y: 15 }),
        Object.freeze({ id: "red-rifle-b", unitType: "rifleSquad", quality: "regular", x: 64, y: 25 }),
        Object.freeze({ id: "red-assault", unitType: "assaultSquad", quality: "veteran", x: 64, y: 35 }),
        Object.freeze({ id: "red-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 66, y: 43 })
      ])
    })
  })
});
