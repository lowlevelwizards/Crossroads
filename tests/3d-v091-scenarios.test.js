"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
  path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};
vm.runInNewContext(read("data/scenarios.js"),{window:w});
vm.runInNewContext(read("data/terrain.js"),{window:w});
const ids=["hold_the_farm","take_the_crossroads","breakthrough","mokra"];
const scenery=new Set();
for(const id of ids){
  const scenario=w.CROSSROADS_SCENARIOS[id];
  assert(scenario,"scenario missing "+id);
  assert(scenario.objectives?.length>0,"objectives required "+id);
  for(const entry of scenario.terrain||[]){
    const type=w.CROSSROADS_TERRAIN_TYPES[entry.terrainId];
    assert(type,"unknown terrain "+id+":"+entry.terrainId);
    scenery.add(type.renderer);
  }
}
const scene=read("src/diorama/scenario-scene.js");
for(const type of ["foxholes","haystack","woodpile"])
  assert(scene.includes('entry.renderer==="'+type+'"')||
    scene.includes('"'+type+'"'),"Mokra scenery missing "+type);
const engine=read("src/engine.js");
assert(engine.includes('scenarioSession.dispatch("round_ended"'),
  "score points must remain an authoritative round-end transaction");
assert(engine.includes("scores.blue += result.score.blue")&&
  engine.includes("scores.red += result.score.red"));
assert(read("scenarios3d.html").includes("editor3d.html?scenario="));
console.log("PASS — all four scenario terrain registrations, restored Mokra assets, round-end scoring authority and editor links");
