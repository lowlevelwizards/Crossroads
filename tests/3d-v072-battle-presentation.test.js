"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};vm.runInNewContext(read("src/diorama/combat-presentation.js"),{window:w});
const phases=[],director=w.Crossroads3DCombatPresentation.create(s=>phases.push(s.phase));
assert(director.enqueue({id:1,type:"shooting",groups:[{rolls:[3,5],hitTarget:4}]}));
assert(!director.enqueue({id:1,type:"shooting"}));
for(let i=0;i<100;i++)director.update(.05);
assert.equal(phases.join(","),"aim,fire,hit-dice,damage-dice,save-dice,impact,settle");
assert.equal(director.active,false);
const reaction=[];
const d=w.Crossroads3DCombatPresentation.create(s=>reaction.push(s.phase));
d.enqueue({id:2,type:"ambush",decision:"interrupt"});
d.enqueue({id:3,type:"round-score",blue:1,red:0});
for(let i=0;i<50;i++)d.update(.05);
assert.equal(reaction.join(","),"alert,settle,score,settle");
d.reset();reaction.length=0;
assert(d.enqueue({id:1,type:"rally",unitId:"r",removedPins:2}),
  "Restart must accept previously-used event IDs");
for(let i=0;i<30;i++)d.update(.05);
assert.equal(reaction.join(","),"recover,settle");
const a={};
vm.runInNewContext(read("src/diorama/ai-tactics.js"),{window:a});
const tactics=a.Crossroads3DAITactics;
const state={faction:"red",phase:"choose-order",objectives:[{id:"crossroads",x:36,y:24,state:"none"}],
 units:[{id:"r",x:56,y:24,soldiers:5,role:"line",pins:0,faction:"red",activated:false},
 {id:"b",x:44,y:24,soldiers:6,role:"line",faction:"blue",activated:false}]};
const actor=state.units[0];
assert.equal(tactics.chooseUnit(state,"red").id,"r");
assert.equal(tactics.chooseOrder(state,actor,["Advance","Fire"],()=>({legal:false}),
 {fire:new Set(),move:new Set()}),"Fire");
const move=tactics.chooseMove(state,actor,point=>({legal:point.x<60,
 path:[{x:actor.x,y:actor.y},point],cost:4,allowance:6}));
assert(move&&move.x<56&&Number.isFinite(move.y),"Tactics should prefer moving toward objective");
assert.equal(tactics.chooseTarget(state,actor,id=>({legal:id==="b"})).id,"b");
const scene=read("src/diorama/scenario-scene.js");
assert(scene.includes("MAX_PARTICLES=84"),"FX must stay bounded on mobile");
assert(scene.includes("showFirePreview(pickedSquad,assessment)"),"Firing lines available");
assert(scene.includes("movementIntent.consumeIfMatch(position,Date.now())"),"Two-tap movement regression");
assert(scene.includes("updateBuildingRoofs(snapshot)"),"Buildings follow rules state");
console.log("PASS — combat timeline, Ambush and scoring, tactical move choice, 3D release contracts");
