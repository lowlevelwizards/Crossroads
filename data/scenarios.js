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
    table: Object.freeze({ width: 72, height: 48, mat: "grass_temperate" }),
    deployment: Object.freeze({
      mode: "player",
      order: Object.freeze(["blue", "red"]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 12, yMin: 0, yMax: 48, label: "Poland deployment · 12″" }),
        red: Object.freeze({ xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "Germany deployment · 12″" })
      })
    }),
    terrain: Object.freeze([
      Object.freeze({ id: "main-road", terrainId: "road_straight", x: 0, y: 22.08, width: 72, height: 4.32 }),
      Object.freeze({ id: "cross-road", terrainId: "road_straight", x: 33.48, y: 0, width: 5.04, height: 48, rotation: 0 }),
      Object.freeze({ id: "woods", terrainId: "woods", x: 15, y: 28, width: 18, height: 14 }),
      Object.freeze({ id: "wall", terrainId: "wall", x: 38, y: 30, width: 17, height: 2.5 }),
      Object.freeze({ id: "building", terrainId: "farmhouse", x: 28, y: 4, width: 13, height: 13 })
    ]),
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
    table: Object.freeze({ width: 72, height: 48, mat: "grass_dry" }),
    deployment: Object.freeze({
      mode: "fixed",
      order: Object.freeze([]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 30, yMin: 0, yMax: 48, label: "Polish defensive area" }),
        red: Object.freeze({ xMin: 54, xMax: 72, yMin: 0, yMax: 48, label: "German attack area" })
      })
    }),
    terrain: Object.freeze([
      Object.freeze({ id: "main-road", terrainId: "road_straight", x: 0, y: 22.08, width: 72, height: 4.32 }),
      Object.freeze({ id: "cross-road", terrainId: "road_straight", x: 33.48, y: 0, width: 5.04, height: 48, rotation: 0 }),
      Object.freeze({ id: "north-woods", terrainId: "woods", x: 8, y: 5, width: 18, height: 15 }),
      Object.freeze({ id: "south-copse", terrainId: "woods", x: 12, y: 34, width: 12, height: 9 }),
      Object.freeze({ id: "yard-wall", terrainId: "wall", x: 29, y: 26, width: 18, height: 2.5 }),
      Object.freeze({ id: "garden-wall", terrainId: "wall", x: 45, y: 11, width: 10, height: 2.5 }),
      Object.freeze({ id: "farmhouse", terrainId: "farmhouse", x: 31, y: 14, width: 14, height: 13 }),
      Object.freeze({ id: "east-barn", terrainId: "barn", x: 49, y: 30, width: 11, height: 10 })
    ]),
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
    table: Object.freeze({ width: 72, height: 48, mat: "grass_temperate" }),
    deployment: Object.freeze({
      mode: "player",
      order: Object.freeze(["blue", "red"]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 18, yMin: 0, yMax: 48, label: "Polish defensive deployment · 18″" }),
        red: Object.freeze({ xMin: 60, xMax: 72, yMin: 0, yMax: 48, label: "German attack deployment · 12″" })
      })
    }),
    terrain: Object.freeze([
      Object.freeze({ id: "main-road", terrainId: "road_straight", x: 0, y: 22.08, width: 72, height: 4.32 }),
      Object.freeze({ id: "cross-road", terrainId: "road_straight", x: 33.48, y: 0, width: 5.04, height: 48, rotation: 0 }),
      Object.freeze({ id: "woods", terrainId: "woods", x: 13, y: 7, width: 18, height: 16 }),
      Object.freeze({ id: "wall", terrainId: "wall", x: 32, y: 25, width: 14, height: 2.5 }),
      Object.freeze({ id: "building", terrainId: "farmhouse", x: 49, y: 8, width: 15, height: 17 })
    ]),
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
        Object.freeze({ id: "red-rifle-a", unitType: "rifleSquad", quality: "regular", x: 68, y: 15 }),
        Object.freeze({ id: "red-rifle-b", unitType: "rifleSquad", quality: "regular", x: 68, y: 25 }),
        Object.freeze({ id: "red-assault", unitType: "assaultSquad", quality: "veteran", x: 68, y: 35 }),
        Object.freeze({ id: "red-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 68, y: 43 })
      ])
    })
  }),

  terrain_library: Object.freeze({
    id: "terrain_library",
    title: "Terrain Library",
    description: "A playable visual catalogue of the modular Crossroads terrain pieces. Use it to compare scale, silhouettes, and zoom readability.",
    rounds: 1,
    factions: CROSSROADS_1939_FACTIONS,
    table: Object.freeze({ width: 72, height: 48, mat: "grass_temperate" }),
    deployment: Object.freeze({
      mode: "fixed",
      order: Object.freeze([]),
      zones: Object.freeze({
        blue: Object.freeze({ xMin: 0, xMax: 10, yMin: 0, yMax: 48, label: "Scale reference" }),
        red: Object.freeze({ xMin: 62, xMax: 72, yMin: 0, yMax: 48, label: "Scale reference" })
      })
    }),
    terrain: Object.freeze([
      Object.freeze({ id:"road-a", terrainId:"road_straight", x:2, y:4, width:16, height:3, variant:1 }),
      Object.freeze({ id:"road-b", terrainId:"road_curve", x:20, y:3, width:8, height:7, variant:2 }),
      Object.freeze({ id:"road-x", terrainId:"road_crossroads", x:31, y:3, width:8, height:7 }),
      Object.freeze({ id:"rail-a", terrainId:"rail_straight", x:43, y:2, width:4, height:12 }),
      Object.freeze({ id:"rail-x", terrainId:"rail_crossing", x:51, y:2, width:8, height:12 }),
      Object.freeze({ id:"woods-a", terrainId:"woods", x:2, y:13, width:13, height:10, variant:1 }),
      Object.freeze({ id:"woods-b", terrainId:"woods_dense", x:17, y:13, width:13, height:10, variant:3 }),
      Object.freeze({ id:"orchard-a", terrainId:"orchard", x:32, y:13, width:13, height:10 }),
      Object.freeze({ id:"hedge-a", terrainId:"hedge", x:48, y:15, width:12, height:2.2 }),
      Object.freeze({ id:"fence-a", terrainId:"fence_wood", x:48, y:20, width:12, height:2 }),
      Object.freeze({ id:"wall-a", terrainId:"wall", x:2, y:26, width:13, height:2.2 }),
      Object.freeze({ id:"ditch-a", terrainId:"ditch", x:17, y:26, width:13, height:2.5 }),
      Object.freeze({ id:"stream-a", terrainId:"stream", x:32, y:25.5, width:13, height:3 }),
      Object.freeze({ id:"fox-a", terrainId:"foxholes", x:49, y:25, width:11, height:4 }),
      Object.freeze({ id:"farm-a", terrainId:"farmhouse", x:2, y:32, width:9, height:8 }),
      Object.freeze({ id:"barn-a", terrainId:"barn", x:13, y:32, width:10, height:8 }),
      Object.freeze({ id:"cottage-a", terrainId:"cottage", x:25, y:33, width:8, height:7 }),
      Object.freeze({ id:"shed-a", terrainId:"shed", x:35, y:34, width:6, height:5 }),
      Object.freeze({ id:"bags-a", terrainId:"sandbags", x:44, y:33, width:10, height:2.2 }),
      Object.freeze({ id:"hay-a", terrainId:"haystack", x:57, y:33, width:4, height:4 }),
      Object.freeze({ id:"well-a", terrainId:"well", x:63, y:33, width:3.5, height:3.5 }),
      Object.freeze({ id:"crate-a", terrainId:"crates", x:44, y:38, width:4, height:3 }),
      Object.freeze({ id:"wood-a", terrainId:"woodpile", x:51, y:38, width:5, height:3 })
    ]),
    objectives: Object.freeze([Object.freeze({ id:"library_center", x:36, y:24, radius:1, label:"Terrain Library" })]),
    scoring: Object.freeze({ roundControl:0, finalControl:0 }),
    victory: Object.freeze({ elimination:false, tiebreaker:"survivingUnits" }),
    forces: Object.freeze({
      blue: Object.freeze([Object.freeze({ id:"blue-rifle", unitType:"rifleSquad", quality:"regular", x:7, y:44 })]),
      red: Object.freeze([Object.freeze({ id:"red-rifle", unitType:"rifleSquad", quality:"regular", x:65, y:44 })])
    })
  })
});
