"use strict";

/* CROSSROADS modular terrain registry. */
const openRules = Object.freeze({ movement: "open", cover: null, los: "clear" });
const roughSoft = Object.freeze({ movement: "rough", cover: "soft", los: "obscuring", save: 5 });
const crossingHard = Object.freeze({ movement: "crossing", cover: "hard", los: "clear", save: 4 });
const buildingRules = Object.freeze({ movement: "impassable", cover: "hard", los: "blocking", occupiable: true, save: 3 });

function terrainType(id, family, renderer, label, rules, editor = {}, presentation = {}) {
  return Object.freeze({ id, family, renderer, label, rules, editor: Object.freeze(editor), presentation: Object.freeze(presentation) });
}

function buildingPresentation(shape, defaultAppearance, entryX = 0.5, footprint = {}) {
  return Object.freeze({
    shape,
    defaultAppearance,
    footprint: Object.freeze({
      x: footprint.x ?? 0.12,
      y: footprint.y ?? 0.28,
      width: footprint.width ?? 0.76,
      height: footprint.height ?? 0.56
    }),
    depthAnchor: footprint.depthAnchor ?? 0.82,
    entryAnchor: Object.freeze({ x: entryX, y: footprint.entryY ?? 0.82 }),
    entryNormal: Object.freeze({ x: 0, y: 1 })
  });
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
  road_t: terrainType("road_t", "transport", "road_crossroads", "T junction", openRules, { rotatable: true }),
  road_end: terrainType("road_end", "transport", "road", "road end", openRules, { rotatable: true, resizable: true }),
  rail_straight: terrainType("rail_straight", "transport", "rail", "railway", openRules, { rotatable: true, resizable: true }),
  rail_embankment: terrainType("rail_embankment", "transport", "rail", "raised railway embankment", crossingHard, { rotatable: true, resizable: true }),
  rail_crossing: terrainType("rail_crossing", "transport", "rail_crossing", "rail crossing", openRules, { rotatable: true }),

  woods: terrainType("woods", "natural", "woods", "woods", roughSoft, { rotatable: true, resizable: true }),
  woods_dense: terrainType("woods_dense", "natural", "woods", "dense woods", roughSoft, { rotatable: true, resizable: true }),
  orchard: terrainType("orchard", "natural", "orchard", "orchard", roughSoft, { rotatable: true, resizable: true }),
  hedge: terrainType("hedge", "linear", "hedge", "hedge", crossingHard, { rotatable: true, resizable: true }),
  fence_wood: terrainType("fence_wood", "linear", "fence", "wood fence", crossingHard, { rotatable: true, resizable: true }),
  wall: terrainType("wall", "linear", "wall", "low wall", crossingHard, { rotatable: true, resizable: true }),
  ditch: terrainType("ditch", "linear", "ditch", "ditch", Object.freeze({ movement: "rough", cover: "soft", los: "clear", save: 5 }), { rotatable: true, resizable: true }),
  stream: terrainType("stream", "water", "stream", "stream", Object.freeze({ movement: "rough", cover: null, los: "clear" }), { rotatable: true, resizable: true }),
  stream_curve: terrainType("stream_curve", "water", "stream", "stream bend", Object.freeze({ movement: "rough", cover: null, los: "clear" }), { rotatable: true }),
  stream_end: terrainType("stream_end", "water", "stream", "stream end", Object.freeze({ movement: "rough", cover: null, los: "clear" }), { rotatable: true, resizable: true }),

  field_tilled: terrainType("field_tilled", "ground", "field", "tilled field", openRules, { rotatable: true, resizable: true }),
  field_wheat: terrainType("field_wheat", "ground", "field", "wheat field", openRules, { rotatable: true, resizable: true }),
  field_cabbage: terrainType("field_cabbage", "ground", "field", "cabbage rows", openRules, { rotatable: true, resizable: true }),

  small_cottage: terrainType("small_cottage", "building", "building", "small cottage", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("small-cottage", "whitewash_red", 0.50, { x:0.16, y:0.33, width:0.68, height:0.48, entryY:0.78 })),
  medium_cottage: terrainType("medium_cottage", "building", "building", "medium cottage", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("medium-cottage", "peach_plaster_red", 0.50, { x:0.13, y:0.31, width:0.74, height:0.51, entryY:0.80 })),
  long_farmhouse: terrainType("long_farmhouse", "building", "building", "long farmhouse", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("long-farmhouse", "mixed_plaster_red", 0.36, { x:0.10, y:0.34, width:0.80, height:0.47, entryY:0.80 })),
  barn: terrainType("barn", "building", "building", "barn", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("barn", "weathered_charcoal", 0.50, { x:0.10, y:0.30, width:0.80, height:0.52, entryY:0.80 })),
  shed: terrainType("shed", "building", "building", "shed", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("shed", "timber_brown", 0.40, { x:0.17, y:0.34, width:0.66, height:0.46, entryY:0.79 })),
  church: terrainType("church", "building", "building", "church", buildingRules, { rotatable: true, resizable: true }, buildingPresentation("church", "plaster_charcoal", 0.21, { x:0.12, y:0.31, width:0.76, height:0.53, entryY:0.80, depthAnchor:0.86 })),

  foxholes: terrainType("foxholes", "defensive", "foxholes", "foxholes", Object.freeze({ movement: "open", cover: "hard", los: "clear", save: 4 })),
  sandbags: terrainType("sandbags", "defensive", "sandbags", "sandbags", crossingHard),
  haystack: terrainType("haystack", "scatter", "haystack", "haystack", Object.freeze({ movement: "open", cover: "soft", los: "obscuring", save: 5 })),
  well: terrainType("well", "scatter", "well", "well", openRules),
  crates: terrainType("crates", "scatter", "crates", "crates", Object.freeze({ movement: "open", cover: "soft", los: "clear", save: 5 })),
  woodpile: terrainType("woodpile", "scatter", "woodpile", "wood pile", Object.freeze({ movement: "open", cover: "soft", los: "clear", save: 5 }))
});


window.CROSSROADS_TERRAIN_PATCH_STYLES = Object.freeze({
  woods: Object.freeze({ id:"woods", label:"Woods patch", family:"natural", material:"temperate", materials:Object.freeze({ temperate:"Temperate green", dry:"Dry summer", dark:"Dark forest" }), rules:roughSoft }),
  woods_dense: Object.freeze({ id:"woods_dense", label:"Dense woods patch", family:"natural", material:"temperate", materials:Object.freeze({ temperate:"Temperate green", dry:"Dry summer", dark:"Dark forest" }), rules:roughSoft }),
  orchard: Object.freeze({ id:"orchard", label:"Orchard patch", family:"natural", material:"temperate", materials:Object.freeze({ temperate:"Temperate green", autumn:"Autumn orchard" }), rules:roughSoft }),
  field_tilled: Object.freeze({ id:"field_tilled", label:"Tilled field patch", family:"ground", material:"brown", materials:Object.freeze({ brown:"Brown earth", dark:"Dark earth", dry:"Dry earth" }), rules:openRules }),
  field_wheat: Object.freeze({ id:"field_wheat", label:"Wheat field patch", family:"ground", material:"gold", materials:Object.freeze({ gold:"Ripe gold", green:"Green crop", cut:"Cut stubble" }), rules:openRules }),
  field_cabbage: Object.freeze({ id:"field_cabbage", label:"Cabbage field patch", family:"ground", material:"green", materials:Object.freeze({ green:"Green rows", dark:"Dark rows" }), rules:openRules }),
  concrete: Object.freeze({ id:"concrete", label:"Concrete patch", family:"ground", material:"weathered", materials:Object.freeze({ weathered:"Weathered concrete", pale:"Pale concrete", dark:"Dark concrete" }), rules:openRules }),
  cobblestone: Object.freeze({ id:"cobblestone", label:"Cobblestone patch", family:"ground", material:"grey", materials:Object.freeze({ grey:"Grey cobble", warm:"Warm cobble", dark:"Dark cobble" }), rules:openRules }),
  mud: Object.freeze({ id:"mud", label:"Mud patch", family:"ground", material:"wet", materials:Object.freeze({ wet:"Wet mud", churned:"Churned mud", dry:"Dry mud" }), rules:Object.freeze({ movement:"rough", cover:null, los:"clear" }) }),
  pond: Object.freeze({ id:"pond", label:"Pond / lake patch", family:"water", material:"blue", materials:Object.freeze({ blue:"Clear blue", dark:"Deep water", marsh:"Marsh water" }), rules:Object.freeze({ movement:"rough", cover:null, los:"clear" }) })
});

window.CROSSROADS_TERRAIN = { instances: [] };
