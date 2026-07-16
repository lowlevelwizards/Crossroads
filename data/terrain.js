"use strict";

/* BUILD T3 — CROSSROADS TERRAIN LIBRARY MVP */
const openRules = Object.freeze({ movement: "open", cover: null, los: "clear" });
const roughSoft = Object.freeze({ movement: "rough", cover: "soft", los: "obscuring", save: 5 });
const crossingHard = Object.freeze({ movement: "crossing", cover: "hard", los: "clear", save: 4 });
const buildingRules = Object.freeze({ movement: "impassable", cover: "hard", los: "blocking", occupiable: true, save: 3 });

function terrainType(id, family, renderer, label, rules, editor = {}) {
  return Object.freeze({ id, family, renderer, label, rules, editor: Object.freeze(editor) });
}

window.CROSSROADS_TERRAIN_MATS = Object.freeze({
  grass_temperate: Object.freeze({ id: "grass_temperate", label: "Temperate Grass", cssClass: "mat-grass-temperate" }),
  grass_dry: Object.freeze({ id: "grass_dry", label: "Dry Grass", cssClass: "mat-grass-dry" }),
  dirt: Object.freeze({ id: "dirt", label: "Dirt", cssClass: "mat-dirt" }),
  forest_floor: Object.freeze({ id: "forest_floor", label: "Forest Floor", cssClass: "mat-forest-floor" }),
  cobblestone: Object.freeze({ id: "cobblestone", label: "Cobblestone", cssClass: "mat-cobblestone" }),
  mud: Object.freeze({ id: "mud", label: "Mud", cssClass: "mat-mud" })
});

window.CROSSROADS_TERRAIN_TYPES = Object.freeze({
  road_horizontal: terrainType("road_horizontal", "transport", "road", "dirt road", openRules),
  road_vertical: terrainType("road_vertical", "transport", "road", "dirt road", openRules),
  road_straight: terrainType("road_straight", "transport", "road", "dirt road", openRules, { rotatable: true, resizable: true }),
  road_curve: terrainType("road_curve", "transport", "road_curve", "road bend", openRules, { rotatable: true }),
  road_crossroads: terrainType("road_crossroads", "transport", "road_crossroads", "crossroads", openRules, { rotatable: true }),
  rail_straight: terrainType("rail_straight", "transport", "rail", "railway", openRules, { rotatable: true, resizable: true }),
  rail_crossing: terrainType("rail_crossing", "transport", "rail_crossing", "rail crossing", openRules, { rotatable: true }),

  woods: terrainType("woods", "natural", "woods", "woods", roughSoft, { rotatable: true, resizable: true }),
  woods_dense: terrainType("woods_dense", "natural", "woods", "dense woods", roughSoft, { rotatable: true, resizable: true }),
  orchard: terrainType("orchard", "natural", "orchard", "orchard", roughSoft, { rotatable: true, resizable: true }),
  hedge: terrainType("hedge", "linear", "hedge", "hedge", crossingHard, { rotatable: true, resizable: true }),
  fence_wood: terrainType("fence_wood", "linear", "fence", "wood fence", crossingHard, { rotatable: true, resizable: true }),
  wall: terrainType("wall", "linear", "wall", "low wall", crossingHard, { rotatable: true, resizable: true }),
  ditch: terrainType("ditch", "linear", "ditch", "ditch", Object.freeze({ movement: "rough", cover: "soft", los: "clear", save: 5 }), { rotatable: true, resizable: true }),
  stream: terrainType("stream", "water", "stream", "stream", Object.freeze({ movement: "rough", cover: null, los: "clear" }), { rotatable: true, resizable: true }),

  building: terrainType("building", "building", "building", "farmhouse", buildingRules),
  farmhouse: terrainType("farmhouse", "building", "building", "farmhouse", buildingRules),
  barn: terrainType("barn", "building", "building", "barn", buildingRules),
  cottage: terrainType("cottage", "building", "building", "cottage", buildingRules),
  shed: terrainType("shed", "building", "building", "shed", buildingRules),

  foxholes: terrainType("foxholes", "defensive", "foxholes", "foxholes", Object.freeze({ movement: "open", cover: "hard", los: "clear", save: 4 })),
  sandbags: terrainType("sandbags", "defensive", "sandbags", "sandbags", crossingHard),
  haystack: terrainType("haystack", "scatter", "haystack", "haystack", Object.freeze({ movement: "open", cover: "soft", los: "obscuring", save: 5 })),
  well: terrainType("well", "scatter", "well", "well", openRules),
  crates: terrainType("crates", "scatter", "crates", "crates", Object.freeze({ movement: "open", cover: "soft", los: "clear", save: 5 })),
  woodpile: terrainType("woodpile", "scatter", "woodpile", "wood pile", Object.freeze({ movement: "open", cover: "soft", los: "clear", save: 5 }))
});

window.CROSSROADS_TERRAIN = {
  woods: { id: "woods", label: "woods", type: "soft", x: 15, y: 28, width: 18, height: 14, save: 5 },
  wall: { id: "wall", label: "low wall", type: "hard", x: 38, y: 30, width: 17, height: 2.5, save: 4 },
  building: { id: "building", label: "farmhouse", type: "blocking", x: 28, y: 4, width: 13, height: 13 }
};
