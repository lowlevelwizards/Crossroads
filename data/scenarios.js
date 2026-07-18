"use strict";

/* Pure scenario data. Blue/red are stable engine sides; faction metadata is player-facing. */
const CROSSROADS_1939_FACTIONS = Object.freeze({
  blue: Object.freeze({ id: "poland", name: "Poland", kitId: "poland_1939" }),
  red: Object.freeze({ id: "germany", name: "Germany", kitId: "germany_1939" })
});

const freezeList = list => Object.freeze(list.map(item => Object.freeze(item)));
const zone = (xMin, xMax, yMin, yMax, label, extra = {}) => Object.freeze({ xMin, xMax, yMin, yMax, label, ...extra });

window.CROSSROADS_CORE_SCENARIO_12A = Object.freeze({
  id: "take_the_crossroads_core",
  title: "Take the Crossroads",
  factions: CROSSROADS_1939_FACTIONS,
  forces: Object.freeze({
    blue: freezeList([
      { id: "blue-officer", unitType: "officer", quality: "veteran", x: 6, y: 6 },
      { id: "blue-rifle", unitType: "rifleSquad", quality: "regular", x: 8, y: 17 },
      { id: "blue-assault", unitType: "assaultSquad", quality: "veteran", x: 8, y: 29 },
      { id: "blue-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 6, y: 41 }
    ]),
    red: freezeList([
      { id: "red-officer", unitType: "officer", quality: "veteran", x: 66, y: 6 },
      { id: "red-rifle", unitType: "rifleSquad", quality: "regular", x: 64, y: 17 },
      { id: "red-assault", unitType: "assaultSquad", quality: "veteran", x: 64, y: 29 },
      { id: "red-mmg", unitType: "mmgTeam", quality: "inexperienced", x: 66, y: 41 }
    ])
  })
});

const takeTheCrossroads = Object.freeze({
  schemaVersion:2,
  id: "take_the_crossroads", title: "Take the Crossroads",
  description: "A six-round 1939 meeting engagement. Poland and Germany race to control the central crossroads.",
  rounds: 6, factions: CROSSROADS_1939_FACTIONS,
  table: Object.freeze({ width: 72, height: 48, mat: "grass_temperate" }),
  deployment: Object.freeze({ mode: "player", order: Object.freeze(["blue", "red"]), zones: Object.freeze({ blue: zone(0,12,0,48,"Poland deployment · 12″"), red: zone(60,72,0,48,"Germany deployment · 12″") }) }),
  terrain: freezeList([
    { id:"main-road", terrainId:"road_straight", x:0, y:22.08, width:72, height:4.32 },
    { id:"cross-road", terrainId:"road_straight", x:33.48, y:0, width:5.04, height:48 },
    { id:"woods", terrainId:"woods", x:15, y:28, width:18, height:14 },
    { id:"wall", terrainId:"wall", x:38, y:30, width:17, height:2.5 },
    { id:"crossroads-cottage", terrainId:"medium_cottage", appearance:"peach_plaster_red", x:40.5, y:4.5, width:13, height:10 }
  ]),
  objectives: freezeList([{ id:"crossroads", type:"control_zone", x:36, y:24, radius:3, label:"Crossroads", roundPoints:1, finalPoints:0 }]),
  victory: Object.freeze({ policy:"points", elimination:true, tiebreaker:"survivingUnits" }),
  forces: window.CROSSROADS_CORE_SCENARIO_12A.forces
});

const holdTheFarm = Object.freeze({
  schemaVersion:2,
  id:"hold_the_farm", title:"Hold the Farm",
  description:"A four-round 1939 validation battle. Poland defends the farm while Germany attacks from the road.",
  rounds:4, factions:CROSSROADS_1939_FACTIONS,
  table:Object.freeze({ width:72, height:48, mat:"grass_dry" }),
  deployment:Object.freeze({ mode:"fixed", order:Object.freeze([]), zones:Object.freeze({ blue:zone(0,30,0,48,"Polish defensive area"), red:zone(54,72,0,48,"German attack area") }) }),
  terrain:freezeList([
    { id:"main-road", terrainId:"road_straight", x:0, y:22.08, width:72, height:4.32 },
    { id:"cross-road", terrainId:"road_straight", x:33.48, y:0, width:5.04, height:48 },
    { id:"north-woods", terrainId:"woods", x:8, y:5, width:18, height:15 },
    { id:"south-copse", terrainId:"woods", x:12, y:34, width:12, height:9 },
    { id:"yard-wall", terrainId:"wall", x:29, y:26, width:18, height:2.5 },
    { id:"garden-wall", terrainId:"wall", x:45, y:11, width:10, height:2.5 },
    { id:"farmhouse", terrainId:"long_farmhouse", appearance:"mixed_plaster_red", x:39.5, y:13.5, width:17, height:8 },
    { id:"east-barn", terrainId:"barn", appearance:"weathered_charcoal", x:49, y:30, width:12, height:8 }
  ]),
  objectives:freezeList([{ id:"farm_yard", type:"control_zone", x:38, y:24, radius:4, label:"Farm Yard", roundPoints:0, finalPoints:2 }]),
  victory:Object.freeze({ policy:"points", elimination:true, tiebreaker:"survivingSoldiers" }),
  forces:Object.freeze({
    blue:freezeList([{id:"blue-officer",unitType:"officer",quality:"veteran",x:24,y:16},{id:"blue-rifle",unitType:"rifleSquad",quality:"veteran",x:25,y:25},{id:"blue-assault",unitType:"assaultSquad",quality:"regular",x:22,y:35},{id:"blue-mmg",unitType:"mmgTeam",quality:"regular",x:26,y:8}]),
    red:freezeList([{id:"red-officer",unitType:"officer",quality:"regular",x:64,y:8},{id:"red-rifle",unitType:"rifleSquad",quality:"inexperienced",x:62,y:18},{id:"red-assault",unitType:"assaultSquad",quality:"veteran",x:61,y:30},{id:"red-mmg",unitType:"mmgTeam",quality:"regular",x:65,y:40}])
  })
});

const breakthrough = Object.freeze({
  schemaVersion:2,
  id:"breakthrough", title:"Breakthrough",
  description:"A six-round asymmetric battle. Germany must break through the Polish defensive edge; Poland must delay and contain.",
  rounds:6, factions:CROSSROADS_1939_FACTIONS, table:Object.freeze({width:72,height:48,mat:"grass_temperate"}),
  deployment:Object.freeze({mode:"player",order:Object.freeze(["blue","red"]),zones:Object.freeze({blue:zone(0,18,0,48,"Polish defensive deployment · 18″"),red:zone(60,72,0,48,"German attack deployment · 12″")})}),
  terrain:freezeList([{id:"main-road",terrainId:"road_straight",x:0,y:22.08,width:72,height:4.32},{id:"cross-road",terrainId:"road_straight",x:33.48,y:0,width:5.04,height:48},{id:"woods",terrainId:"woods",x:13,y:7,width:18,height:16},{id:"wall",terrainId:"wall",x:32,y:25,width:14,height:2.5},{id:"breakthrough-cottage",terrainId:"medium_cottage",appearance:"concrete_thatch",x:49,y:8,width:14,height:10}]),
  objectives:freezeList([{id:"red_exit",type:"exit_unit",edge:"blue",faction:"red",depth:3,radius:0,x:0,y:24,label:"Breakthrough Edge",pointsPerUnit:2,containmentPointsPerUnit:1}]),
  victory:Object.freeze({policy:"points",elimination:false,tiebreaker:"survivingSoldiers"}),
  forces:Object.freeze({
    blue:freezeList([{id:"blue-officer",unitType:"officer",quality:"regular",x:12,y:7},{id:"blue-rifle-a",unitType:"rifleSquad",quality:"veteran",x:13,y:18},{id:"blue-rifle-b",unitType:"rifleSquad",quality:"veteran",x:13,y:31},{id:"blue-mmg",unitType:"mmgTeam",quality:"veteran",x:10,y:41}]),
    red:freezeList([{id:"red-officer",unitType:"officer",quality:"veteran",x:66,y:6},{id:"red-rifle-a",unitType:"rifleSquad",quality:"regular",x:68,y:15},{id:"red-rifle-b",unitType:"rifleSquad",quality:"regular",x:68,y:25},{id:"red-assault",unitType:"assaultSquad",quality:"veteran",x:68,y:35},{id:"red-mmg",unitType:"mmgTeam",quality:"inexperienced",x:68,y:43}])
  })
});

const mokra = Object.freeze({
  schemaVersion:2,
  id:"mokra", title:"Battle of Mokra",
  description:"1 September 1939. Polish dismounted cavalry holds woods, farms, and three railway crossings against a concentrated German attack. This infantry-only M1 abstracts the wider battle before tanks, air attacks, and the armoured train are introduced.",
  rounds:6, factions:CROSSROADS_1939_FACTIONS,
  table:Object.freeze({width:72,height:48,mat:"grass_dry"}),
  deployment:Object.freeze({
    mode:"player", order:Object.freeze(["blue","red"]),
    zones:Object.freeze({
      blue:zone(28,62,0,48,"Polish forward line & reserve",{subzones:Object.freeze([
        zone(28,40,2,46,"Forward positions",{id:"forward"}),
        zone(48,62,4,44,"Officer & reserve",{id:"reserve"})
      ])}),
      red:zone(0,12,0,48,"German deployment · 12″",{id:"attack"})
    })
  }),
  terrain:freezeList([
    {id:"north-field",terrainId:"field_wheat",x:2,y:1,width:13,height:9},
    {id:"center-field",terrainId:"field_tilled",x:18,y:31,width:12,height:8},
    {id:"reserve-field",terrainId:"field_cabbage",x:49,y:3,width:11,height:7},

    {id:"crossing-north",terrainId:"rail_crossing",x:39.5,y:6,width:8,height:5},
    {id:"crossing-central",terrainId:"rail_crossing",x:39.5,y:20,width:8,height:7},
    {id:"crossing-south",terrainId:"rail_crossing",x:39.5,y:34,width:8,height:7},


    {id:"north-dense-wood",terrainId:"woods_dense",x:18,y:1,width:18,height:12,variant:3},
    {id:"north-orchard",terrainId:"orchard",x:4,y:2,width:10,height:9},
    {id:"south-dense-wood",terrainId:"woods_dense",x:1,y:31,width:16,height:15,variant:2},
    {id:"south-wood",terrainId:"woods",x:13,y:38,width:11,height:8,variant:1},
    {id:"reserve-wood",terrainId:"woods",x:54,y:8,width:15,height:14,variant:4},


    {id:"village-church",terrainId:"church",appearance:"wooden_brown_red",x:12,y:12.5,width:13,height:10.5,visualScale:1.30},
    {id:"village-farmhouse",terrainId:"long_farmhouse",appearance:"mixed_plaster_red",x:23,y:16,width:14,height:7.5,visualScale:1.15},
    {id:"village-cottage-a",terrainId:"medium_cottage",appearance:"peach_plaster_red",x:33,y:12.5,width:8.5,height:7,visualScale:1.15},
    {id:"village-cottage-b",terrainId:"small_cottage",appearance:"whitewash_red",x:14.5,y:25.0,width:7.2,height:5.2,visualScale:1.15},
    {id:"village-barn",terrainId:"barn",appearance:"weathered_charcoal",x:23.5,y:24.8,width:9.5,height:5.3,visualScale:1.15},
    {id:"reserve-farm",terrainId:"medium_cottage",appearance:"concrete_thatch",x:49.5,y:15.0,width:9,height:7,visualScale:1.15},

    {id:"north-foxholes",terrainId:"foxholes",x:34,y:10,width:7,height:3.5},
    {id:"central-foxholes",terrainId:"foxholes",x:34,y:25.5,width:7,height:3.5},
    {id:"south-foxholes",terrainId:"foxholes",x:33,y:39,width:7,height:3.5},

    {id:"haystack-a",terrainId:"haystack",x:18.0,y:34.0,width:3.6,height:3.6,rotation:-8},
    {id:"haystack-b",terrainId:"haystack",x:21.2,y:35.8,width:3.0,height:3.0,rotation:14},
    {id:"haystack-c",terrainId:"haystack",x:23.8,y:33.4,width:2.6,height:2.6,rotation:-18},
    {id:"woodpile",terrainId:"woodpile",x:27,y:12.5,width:4,height:3}
  ]),
  linearTerrain:freezeList([
    {id:"rail-north-a",styleId:"railway_embankment",points:[{x:43.5,y:0},{x:43.5,y:6}],start:{cap:"off_table"},end:{cap:"junction"}},
    {id:"rail-north-b",styleId:"railway_embankment",points:[{x:43.5,y:11},{x:43.5,y:20}]},
    {id:"rail-center",styleId:"railway_embankment",points:[{x:43.5,y:27},{x:43.5,y:34}]},
    {id:"rail-south",styleId:"railway_embankment",points:[{x:43.5,y:41},{x:43.5,y:48}],end:{cap:"off_table"}},

    {id:"north-road",styleId:"dirt_road",width:3.2,smoothing:.25,points:[{x:18,y:8.8},{x:28,y:8.4},{x:39.5,y:8.5}],start:{cap:"grass"},end:{cap:"junction"}},
    {id:"central-road-west",styleId:"dirt_road",width:3.8,points:[{x:0,y:23.9},{x:20,y:23.9},{x:39.5,y:23.5}],start:{cap:"off_table"},end:{cap:"junction"}},
    {id:"central-road-east",styleId:"dirt_road",width:3.8,points:[{x:47.5,y:23.5},{x:62,y:23.5}],start:{cap:"junction"},end:{cap:"junction"}},
    {id:"east-road",styleId:"dirt_road",width:3.4,points:[{x:62,y:23.5},{x:62,y:43}],start:{cap:"junction"},end:{cap:"grass"}},
    {id:"south-road-west",styleId:"dirt_road",width:3.2,smoothing:.18,points:[{x:17,y:37.5},{x:28,y:37.2},{x:39.5,y:37.5}],start:{cap:"grass"},end:{cap:"junction"}},
    {id:"south-road-east",styleId:"dirt_road",width:3.2,points:[{x:47.5,y:37.5},{x:60,y:37.5}],start:{cap:"junction"},end:{cap:"grass"}},

    {id:"mokra-stream",styleId:"stream",smoothing:.68,points:[{x:0,y:32.0},{x:10,y:31.5},{x:20,y:31.4},{x:27,y:32.1},{x:36,y:31.9},{x:47,y:32.1},{x:56,y:31.8},{x:66,y:32.0},{x:73,y:32.1}],start:{cap:"off_table"},end:{cap:"off_table"}},
    {id:"south-ditch",styleId:"ditch",smoothing:.42,points:[{x:2,y:34.2},{x:11,y:34.7},{x:20,y:33.8},{x:28,y:34.1}],start:{cap:"taper"},end:{cap:"taper"}},

    {id:"hedge-north-a",styleId:"hedge",points:[{x:4,y:12.8},{x:12,y:12.8}]},
    {id:"hedge-north-b",styleId:"hedge",smoothing:.25,points:[{x:25,y:12.8},{x:30,y:12.5},{x:34,y:12.8}]},
    {id:"hedge-center-a",styleId:"hedge",points:[{x:4,y:27.8},{x:12,y:27.8}]},
    {id:"hedge-center-b",styleId:"hedge",points:[{x:29,y:32.8},{x:38,y:32.8}]},
    {id:"hedge-east",styleId:"hedge",points:[{x:49,y:27.8},{x:58,y:27.8}]},
    {id:"fence-village",styleId:"wood_fence",smoothing:.18,points:[{x:7,y:33.0},{x:13,y:32.8},{x:19,y:33.0}]},
    {id:"fence-north",styleId:"wood_fence",points:[{x:27,y:11.8},{x:33,y:11.8}]},
    {id:"wall-village",styleId:"stone_wall",points:[{x:29,y:21.8},{x:38,y:21.8}]},
    {id:"wall-reserve",styleId:"stone_wall",points:[{x:50,y:41.8},{x:60,y:41.8}]}
  ]),
  junctions:freezeList([
    {id:"east-road-tee",type:"tee",styleId:"dirt_road",x:62,y:23.5,width:3.8,radius:3.2}
  ]),
  crossings:freezeList([
    {id:"reserve-culvert",type:"culvert",pathIds:["east-road","mokra-stream"],length:4.2,width:3.2}
  ]),
  objectives:freezeList([{
    id:"mokra_crossings", type:"control_group", label:"Railway Crossings", x:43.5, y:23.5, radius:3.25,
    points:Object.freeze([
      Object.freeze({id:"north",label:"North Crossing",x:43.5,y:8.5,radius:3}),
      Object.freeze({id:"central",label:"Central Crossing",x:43.5,y:23.5,radius:3.5}),
      Object.freeze({id:"south",label:"South Crossing",x:43.5,y:37.5,radius:3})
    ]),
    roundScoring:Object.freeze([
      Object.freeze({faction:"red",rule:"per_controlled",points:1,maxPoints:2,startRound:2}),
      Object.freeze({faction:"blue",rule:"opponent_none",opponent:"red",points:1,startRound:2})
    ])
  },{
    id:"mokra_breakthrough",type:"presence_zone",label:"Railway Breakthrough",shape:"rect",x:46,y:0,width:26,height:48,showMarker:false,
    finalScoring:Object.freeze([
      Object.freeze({faction:"red",rule:"faction_present",points:2}),
      Object.freeze({faction:"blue",rule:"opponent_absent",opponent:"red",points:2})
    ])
  }]),
  victory:Object.freeze({policy:"points",elimination:true,tiebreaker:"survivingSoldiers"}),
  forces:Object.freeze({
    blue:freezeList([
      {id:"mokra-blue-rifle-a",name:"1st Mounted Rifle Squadron",unitType:"rifleSquad",quality:"veteran",x:35.5,y:8.5,deploymentZone:"forward"},
      {id:"mokra-blue-rifle-b",name:"2nd Mounted Rifle Squadron",unitType:"rifleSquad",quality:"veteran",x:36.5,y:24.5,deploymentZone:"forward"},
      {id:"mokra-blue-rifle-c",name:"3rd Mounted Rifle Squadron",unitType:"rifleSquad",quality:"regular",x:34.5,y:40,deploymentZone:"forward"},
      {id:"mokra-blue-mmg",name:"Heavy Machine-Gun Section",unitType:"mmgTeam",quality:"regular",x:30,y:10,deploymentZone:"forward"},
      {id:"mokra-blue-officer",name:"Regimental Command",unitType:"officer",quality:"veteran",x:50,y:25.5,deploymentZone:"reserve"},
      {id:"mokra-blue-reserve",name:"Reserve Squadron",unitType:"assaultSquad",quality:"regular",x:56,y:34,deploymentZone:"reserve"}
    ]),
    red:freezeList([
      {id:"mokra-red-officer",name:"German Battle Group HQ",unitType:"officer",quality:"regular",x:5,y:5,deploymentZone:"attack"},
      {id:"mokra-red-rifle-a",name:"Northern Rifle Platoon",unitType:"rifleSquad",quality:"regular",x:5,y:13,deploymentZone:"attack"},
      {id:"mokra-red-rifle-b",name:"Central Rifle Platoon",unitType:"rifleSquad",quality:"regular",x:5,y:21,deploymentZone:"attack"},
      {id:"mokra-red-rifle-c",name:"Southern Rifle Platoon",unitType:"rifleSquad",quality:"regular",x:5,y:29,deploymentZone:"attack"},
      {id:"mokra-red-assault",name:"Assault Detachment",unitType:"assaultSquad",quality:"veteran",x:5,y:38,deploymentZone:"attack"},
      {id:"mokra-red-mmg",name:"Machine-Gun Section",unitType:"mmgTeam",quality:"regular",x:5,y:45,deploymentZone:"attack"}
    ])
  })
});

const terrainLibrary = Object.freeze({
  schemaVersion:2,
  id:"terrain_library",title:"Terrain Library",description:"A playable visual catalogue of the modular Crossroads terrain pieces. Use it to compare scale, silhouettes, and zoom readability.",rounds:1,factions:CROSSROADS_1939_FACTIONS,
  table:Object.freeze({width:72,height:48,mat:"grass_temperate"}),deployment:Object.freeze({mode:"fixed",order:Object.freeze([]),zones:Object.freeze({blue:zone(0,10,0,48,"Scale reference"),red:zone(62,72,0,48,"Scale reference")})}),
  terrain:freezeList([
    {id:"road-a",terrainId:"road_straight",x:2,y:4,width:16,height:3,variant:1},{id:"road-b",terrainId:"road_curve",x:20,y:3,width:8,height:7,variant:2},{id:"road-x",terrainId:"road_crossroads",x:31,y:3,width:8,height:7},{id:"rail-a",terrainId:"rail_straight",x:43,y:2,width:4,height:12},{id:"rail-x",terrainId:"rail_crossing",x:51,y:2,width:8,height:12},{id:"woods-a",terrainId:"woods",x:2,y:13,width:13,height:10,variant:1},{id:"woods-b",terrainId:"woods_dense",x:17,y:13,width:13,height:10,variant:3},{id:"orchard-a",terrainId:"orchard",x:32,y:13,width:13,height:10},{id:"hedge-a",terrainId:"hedge",x:48,y:15,width:12,height:2.2},{id:"fence-a",terrainId:"fence_wood",x:48,y:20,width:12,height:2},{id:"wall-a",terrainId:"wall",x:2,y:26,width:13,height:2.2},{id:"ditch-a",terrainId:"ditch",x:17,y:26,width:13,height:2.5},{id:"stream-a",terrainId:"stream",x:32,y:25.5,width:13,height:3},{id:"fox-a",terrainId:"foxholes",x:49,y:25,width:11,height:4},
    {id:"small-cottage-a",terrainId:"small_cottage",appearance:"whitewash_red",x:2,y:30.5,width:7,height:6},{id:"medium-cottage-a",terrainId:"medium_cottage",appearance:"peach_plaster_red",x:10,y:30.5,width:8,height:6.5},{id:"long-farmhouse-a",terrainId:"long_farmhouse",appearance:"mixed_plaster_red",x:19,y:30.5,width:12,height:6},{id:"barn-a",terrainId:"barn",appearance:"weathered_charcoal",x:32,y:30.5,width:10,height:6.5},{id:"shed-a",terrainId:"shed",appearance:"timber_brown",x:43,y:30.5,width:7,height:6},{id:"church-a",terrainId:"church",appearance:"plaster_charcoal",x:51,y:30.5,width:12,height:6.5},
    {id:"small-cottage-b",terrainId:"small_cottage",appearance:"log_thatch",x:2,y:39,width:7,height:6},{id:"medium-cottage-b",terrainId:"medium_cottage",appearance:"concrete_thatch",x:10,y:39,width:8,height:6.5},{id:"long-farmhouse-b",terrainId:"long_farmhouse",appearance:"timber_thatch",x:19,y:39,width:12,height:6},{id:"barn-b",terrainId:"barn",appearance:"straw_thatch",x:32,y:39,width:10,height:6.5},{id:"shed-b",terrainId:"shed",appearance:"concrete_red",x:43,y:39,width:7,height:6},{id:"church-b",terrainId:"church",appearance:"wooden_brown_red",x:51,y:39,width:12,height:6.5}
  ]),
  objectives:freezeList([{id:"library_center",type:"control_zone",x:36,y:24,radius:1,label:"Terrain Library",roundPoints:0,finalPoints:0}]),victory:Object.freeze({policy:"points",elimination:false,tiebreaker:"survivingUnits"}),
  forces:Object.freeze({blue:freezeList([{id:"blue-rifle",unitType:"rifleSquad",quality:"regular",x:68,y:34}]),red:freezeList([{id:"red-rifle",unitType:"rifleSquad",quality:"regular",x:68,y:44}])})
});

window.CROSSROADS_SCENARIOS = Object.freeze({
  take_the_crossroads: takeTheCrossroads,
  hold_the_farm: holdTheFarm,
  breakthrough,
  mokra,
  terrain_library: terrainLibrary
});
