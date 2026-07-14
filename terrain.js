"use strict";

// Foundation 2B.2S: terrain definitions are external data, but intentionally
// mutable because applyScenarioDefinition() writes each scenario's rectangle
// into these runtime terrain records.
window.CROSSROADS_TERRAIN = {
  woods: { id: "woods", label: "woods", type: "soft", x: 15, y: 28, width: 18, height: 14, save: 5 },
  wall: { id: "wall", label: "low wall", type: "hard", x: 38, y: 30, width: 17, height: 2.5, save: 4 },
  building: { id: "building", label: "farmhouse", type: "blocking", x: 28, y: 4, width: 13, height: 13 }
};
