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
const e=read("src/engine.js");
assert(e.includes("roundPoints:Number(item.objective?.roundPoints||0)"),
  "3D snapshot must expose official scoring rate");
assert(e.includes("finalPoints:Number(item.objective?.finalPoints||0)"),
  "3D snapshot must expose final-only bonus");
const aiWindow={};vm.runInNewContext(read("src/diorama/ai-tactics.js"),{window:aiWindow});
const red={id:"r",x:66,y:20,faction:"red",soldiers:4,pins:0,activated:false};
const blue={id:"b",x:12,y:20,faction:"blue",soldiers:5,pins:0,activated:false};
const snap={table:{width:72,height:48},units:[red,blue],
 objectives:[{id:"exit",x:0,y:24,type:"exit_unit",faction:"red",state:"none"}]};
const ai=aiWindow.Crossroads3DAITactics;
const best=ai.chooseMove(snap,red,p=>({legal:true,path:[red,p],cost:3,allowance:6}));
assert(best&&best.x<red.x,"exiting faction advances toward exit");
const defense=ai.chooseMove(snap,blue,p=>({legal:true,path:[blue,p],cost:3,allowance:6}));
assert(defense&&defense.x>blue.x,"defending faction must not chase hostile exit marker");
console.log("PASS — all four scenario terrain registrations, restored Mokra assets, round-end scoring authority and editor links");
