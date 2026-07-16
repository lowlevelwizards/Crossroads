"use strict";

/*
  BUILD T1 — DYNAMIC TERRAIN FOUNDATION

  Terrain types are immutable reusable definitions. Scenarios place instances of
  those definitions. CROSSROADS_TERRAIN remains a small mutable compatibility
  view for the current rules engine until Build T2 moves geometry queries to the
  instance collection directly.
*/
window.CROSSROADS_TERRAIN_TYPES = Object.freeze({
  road_horizontal: Object.freeze({
    id: "road_horizontal",
    family: "road",
    renderer: "road",
    label: "road",
    rules: Object.freeze({ movement: "open", cover: null, los: "clear" })
  }),
  road_vertical: Object.freeze({
    id: "road_vertical",
    family: "road",
    renderer: "road",
    label: "road",
    rules: Object.freeze({ movement: "open", cover: null, los: "clear" })
  }),
  woods: Object.freeze({
    id: "woods",
    family: "natural",
    renderer: "woods",
    label: "woods",
    rules: Object.freeze({ movement: "rough", cover: "soft", los: "obscuring", save: 5 })
  }),
  wall: Object.freeze({
    id: "wall",
    family: "linear",
    renderer: "wall",
    label: "low wall",
    rules: Object.freeze({ movement: "crossing", cover: "hard", los: "clear", save: 4 })
  }),
  building: Object.freeze({
    id: "building",
    family: "building",
    renderer: "building",
    label: "farmhouse",
    rules: Object.freeze({ movement: "impassable", cover: "hard", los: "blocking", occupiable: true, save: 3 })
  }),
  barn: Object.freeze({
    id: "barn",
    family: "building",
    renderer: "building",
    label: "barn",
    rules: Object.freeze({ movement: "impassable", cover: "hard", los: "blocking", occupiable: true, save: 3 })
  })
});

// Temporary runtime compatibility records used by the existing movement,
// shooting, assault, and building systems. Coordinates are hydrated from the
// active scenario's terrain instances by applyScenarioDefinition().
window.CROSSROADS_TERRAIN = {
  woods: { id: "woods", label: "woods", type: "soft", x: 15, y: 28, width: 18, height: 14, save: 5 },
  wall: { id: "wall", label: "low wall", type: "hard", x: 38, y: 30, width: 17, height: 2.5, save: 4 },
  building: { id: "building", label: "farmhouse", type: "blocking", x: 28, y: 4, width: 13, height: 13 }
};
